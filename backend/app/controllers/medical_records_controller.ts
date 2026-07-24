import type { HttpContext } from '@adonisjs/core/http'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'
import PatientClinic from '#models/patient_clinic'
import ClinicProfessional from '#models/clinic_professional'
import Appointment from '#models/appointment'
import MedicalRecordEntry from '#models/medical_record_entry'
import MedicalRecordAccessLog from '#models/medical_record_access_log'
import {
  correctMedicalRecordEntryValidator,
  createMedicalRecordEntryValidator,
  readMedicalRecordValidator,
} from '#validators/medical_record'

type MedicalRecordRequestStatus = 403 | 404 | 409 | 422

type PostgreSqlError = {
  code?: string
  constraint?: string
}

function getPostgreSqlError(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return null
  }

  return error as PostgreSqlError
}

class MedicalRecordRequestError extends Error {
  constructor(
    public status: MedicalRecordRequestStatus,
    message: string
  ) {
    super(message)
  }
}

async function loadPatientContext({
  clinicId,
  patientId,
  client,
  lock = false,
}: {
  clinicId: string
  patientId: string
  client?: TransactionClientContract
  lock?: boolean
}) {
  const query = client ? PatientClinic.query({ client }) : PatientClinic.query()

  query
    .where('clinic_id', clinicId)
    .where('patient_id', patientId)
    .preload('patient', (patientQuery) => {
      patientQuery.preload('medicalRecord')
    })

  if (lock) {
    query.forUpdate()
  }

  const patientLink = await query.first()

  if (!patientLink) {
    throw new MedicalRecordRequestError(404, 'Paciente não encontrado neste consultório')
  }

  if (!patientLink.isActive || !patientLink.patient.isActive) {
    throw new MedicalRecordRequestError(
      409,
      'O paciente ou seu vínculo com o consultório está inativo'
    )
  }

  const medicalRecord = patientLink.patient.medicalRecord

  if (!medicalRecord) {
    throw new MedicalRecordRequestError(409, 'O paciente não possui um prontuário associado')
  }

  return {
    patientLink,
    patient: patientLink.patient,
    medicalRecord,
  }
}

async function loadClinicalAuthor({
  clinicId,
  userId,
  client,
  lock = false,
}: {
  clinicId: string
  userId: string
  client?: TransactionClientContract
  lock?: boolean
}) {
  const query = client ? ClinicProfessional.query({ client }) : ClinicProfessional.query()

  query
    .where('clinic_id', clinicId)
    .where('is_active', true)
    .whereHas('professional', (professionalQuery) => {
      professionalQuery.where('user_id', userId).where('is_active', true)
    })
    .preload('professional')

  if (lock) {
    query.forUpdate()
  }

  const professionalLink = await query.first()

  if (!professionalLink) {
    throw new MedicalRecordRequestError(
      403,
      'O usuário não possui um perfil profissional clínico ativo neste consultório'
    )
  }

  return professionalLink
}

async function loadMedicalRecordEntry({
  medicalRecordId,
  entryId,
}: {
  medicalRecordId: string
  entryId: string
}) {
  return MedicalRecordEntry.query()
    .where('medical_record_id', medicalRecordId)
    .where('id', entryId)
    .preload('clinic')
    .preload('clinicProfessional', (professionalQuery) => {
      professionalQuery.preload('professional')
    })
    .preload('appointment')
    .preload('authorUser')
    .preload('correctedEntry', (correctedEntryQuery) => {
      correctedEntryQuery
        .preload('authorUser')
        .preload('clinic')
        .preload('clinicProfessional', (professionalQuery) => {
          professionalQuery.preload('professional')
        })
    })
    .preload('corrections', (correctionQuery) => {
      correctionQuery
        .preload('authorUser')
        .preload('clinic')
        .preload('clinicProfessional', (professionalQuery) => {
          professionalQuery.preload('professional')
        })
        .orderBy('created_at', 'asc')
    })
    .first()
}

function validateAccessPurpose({
  purposeCode,
  purposeNote,
}: {
  purposeCode: 'patient_care' | 'care_coordination' | 'legal_obligation' | 'other'
  purposeNote?: string | null
}) {
  if (purposeCode === 'other' && !purposeNote) {
    throw new MedicalRecordRequestError(
      422,
      'A finalidade deve ser detalhada quando o código informado for other'
    )
  }
}

async function registerAccess({
  medicalRecordId,
  patientId,
  clinicId,
  patientClinicId,
  userId,
  accessAction,
  purposeCode,
  purposeNote,
}: {
  medicalRecordId: string
  patientId: string
  clinicId: string
  patientClinicId: string
  userId: string
  accessAction: 'view_timeline' | 'view_entry'
  purposeCode: 'patient_care' | 'care_coordination' | 'legal_obligation' | 'other'
  purposeNote?: string | null
}) {
  await MedicalRecordAccessLog.create({
    medicalRecordId,
    patientId,
    clinicId,
    patientClinicId,
    userId,
    accessAction,
    purposeCode,
    purposeNote: purposeNote ?? null,
  })
}

function respondForMedicalRecordError({
  error,
  response,
}: {
  error: MedicalRecordRequestError
  response: HttpContext['response']
}) {
  switch (error.status) {
    case 403:
      return response.forbidden({
        message: error.message,
      })
    case 404:
      return response.notFound({
        message: error.message,
      })

    case 409:
      return response.conflict({
        message: error.message,
      })

    case 422:
      return response.unprocessableEntity({
        message: error.message,
      })
  }
}

export default class MedicalRecordsController {
  async index({ auth, clinicAuthorization, params, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const user = auth.getUserOrFail()
    const filters = await readMedicalRecordValidator.validate(request.qs())

    try {
      validateAccessPurpose(filters)

      const { patientLink, patient, medicalRecord } = await loadPatientContext({
        clinicId: clinicAuthorization.clinic.id,
        patientId: params.patientId,
      })

      const page = filters.page ?? 1
      const perPage = filters.perPage ?? 20

      const entries = await MedicalRecordEntry.query()
        .where('medical_record_id', medicalRecord.id)
        .preload('clinic')
        .preload('clinicProfessional', (professionalQuery) => {
          professionalQuery.preload('professional')
        })
        .preload('appointment')
        .preload('authorUser')
        .preload('correctedEntry', (correctedEntryQuery) => {
          correctedEntryQuery
            .preload('authorUser')
            .preload('clinic')
            .preload('clinicProfessional', (professionalQuery) => {
              professionalQuery.preload('professional')
            })
        })
        .preload('corrections', (correctionQuery) => {
          correctionQuery
            .preload('authorUser')
            .preload('clinic')
            .preload('clinicProfessional', (professionalQuery) => {
              professionalQuery.preload('professional')
            })
            .orderBy('created_at', 'asc')
        })
        .orderBy('created_at', 'desc')
        .paginate(page, perPage)

      await registerAccess({
        medicalRecordId: medicalRecord.id,
        patientId: patient.id,
        clinicId: clinicAuthorization.clinic.id,
        patientClinicId: patientLink.id,
        userId: user.id,
        accessAction: 'view_timeline',
        purposeCode: filters.purposeCode,
        purposeNote: filters.purposeNote,
      })

      response.header('Cache-Control', 'private, no-store')

      return response.ok({
        medicalRecord: medicalRecord.serialize(),

        patient: patient.serialize(),

        patientLink: {
          id: patientLink.id,
          clinicId: patientLink.clinicId,
          localRecordNumber: patientLink.localRecordNumber,
          isActive: patientLink.isActive,
        },

        entries: entries.all().map((entry) => entry.serialize()),

        meta: entries.getMeta(),
      })
    } catch (error) {
      if (error instanceof MedicalRecordRequestError) {
        return respondForMedicalRecordError({
          error,
          response,
        })
      }

      throw error
    }
  }

  async showEntry({ auth, clinicAuthorization, params, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const user = auth.getUserOrFail()
    const filters = await readMedicalRecordValidator.validate(request.qs())

    try {
      validateAccessPurpose(filters)

      const { patientLink, patient, medicalRecord } = await loadPatientContext({
        clinicId: clinicAuthorization.clinic.id,
        patientId: params.patientId,
      })

      const entry = await MedicalRecordEntry.query()
        .where('medical_record_id', medicalRecord.id)
        .where('id', params.entryId)
        .preload('clinic')
        .preload('clinicProfessional', (professionalQuery) => {
          professionalQuery.preload('professional')
        })
        .preload('appointment')
        .preload('authorUser')
        .preload('correctedEntry', (correctedEntryQuery) => {
          correctedEntryQuery
            .preload('authorUser')
            .preload('clinic')
            .preload('clinicProfessional', (professionalQuery) => {
              professionalQuery.preload('professional')
            })
        })
        .preload('corrections', (correctionQuery) => {
          correctionQuery
            .preload('authorUser')
            .preload('clinic')
            .preload('clinicProfessional', (professionalQuery) => {
              professionalQuery.preload('professional')
            })
            .orderBy('created_at', 'asc')
        })
        .first()

      if (!entry) {
        throw new MedicalRecordRequestError(404, 'Entrada do prontuário não encontrada')
      }

      await registerAccess({
        medicalRecordId: medicalRecord.id,
        patientId: patient.id,
        clinicId: clinicAuthorization.clinic.id,
        patientClinicId: patientLink.id,
        userId: user.id,
        accessAction: 'view_entry',
        purposeCode: filters.purposeCode,
        purposeNote: filters.purposeNote,
      })

      response.header('Cache-Control', 'private, no-store')

      return response.ok({
        entry: entry.serialize(),
      })
    } catch (error) {
      if (error instanceof MedicalRecordRequestError) {
        return respondForMedicalRecordError({
          error,
          response,
        })
      }

      throw error
    }
  }

  async storeEntry({ auth, clinicAuthorization, params, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(createMedicalRecordEntryValidator)

    const clinicId = clinicAuthorization.clinic.id

    try {
      const result = await db.transaction(async (trx) => {
        const { patientLink, patient, medicalRecord } = await loadPatientContext({
          clinicId,
          patientId: params.patientId,
          client: trx,
          lock: true,
        })

        const professionalLink = await loadClinicalAuthor({
          clinicId,
          userId: user.id,
          client: trx,
          lock: true,
        })

        let appointmentId: string | null = null

        if (payload.appointmentId) {
          const appointment = await Appointment.query({
            client: trx,
          })
            .where('clinic_id', clinicId)
            .where('id', payload.appointmentId)
            .where('patient_clinic_id', patientLink.id)
            .where('clinic_professional_id', professionalLink.id)
            .forUpdate()
            .first()

          if (!appointment) {
            throw new MedicalRecordRequestError(
              404,
              'Agendamento compatível não encontrado neste consultório'
            )
          }

          if (appointment.status === 'cancelled' || appointment.status === 'no_show') {
            throw new MedicalRecordRequestError(
              409,
              'Agendamentos cancelados ou marcados como falta não podem receber entradas clínicas'
            )
          }

          appointmentId = appointment.id
        }

        const entry = new MedicalRecordEntry()
        entry.useTransaction(trx)

        entry.merge({
          medicalRecordId: medicalRecord.id,
          patientId: patient.id,
          clinicId,
          patientClinicId: patientLink.id,
          clinicProfessionalId: professionalLink.id,
          appointmentId,
          authorUserId: user.id,
          entryTypeCode: payload.entryTypeCode,
          content: payload.content,
          correctsEntryId: null,
        })

        await entry.save()

        return {
          medicalRecordId: medicalRecord.id,
          entryId: entry.id,
        }
      })

      const entry = await loadMedicalRecordEntry(result)

      response.header('Cache-Control', 'private, no-store')

      return response.created({
        entry: entry!.serialize(),
      })
    } catch (error) {
      if (error instanceof MedicalRecordRequestError) {
        return respondForMedicalRecordError({
          error,
          response,
        })
      }

      throw error
    }
  }

  async correctEntry({ auth, clinicAuthorization, params, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(correctMedicalRecordEntryValidator)

    const clinicId = clinicAuthorization.clinic.id

    try {
      const result = await db.transaction(async (trx) => {
        const { patientLink, patient, medicalRecord } = await loadPatientContext({
          clinicId,
          patientId: params.patientId,
          client: trx,
          lock: true,
        })

        const professionalLink = await loadClinicalAuthor({
          clinicId,
          userId: user.id,
          client: trx,
          lock: true,
        })

        const originalEntry = await MedicalRecordEntry.query({
          client: trx,
        })
          .where('medical_record_id', medicalRecord.id)
          .where('clinic_id', clinicId)
          .where('id', params.entryId)
          .forUpdate()
          .first()

        if (!originalEntry) {
          throw new MedicalRecordRequestError(
            404,
            'Entrada do prontuário não encontrada neste consultório'
          )
        }

        const existingCorrection = await MedicalRecordEntry.query({
          client: trx,
        })
          .where('corrects_entry_id', originalEntry.id)
          .first()

        if (existingCorrection) {
          throw new MedicalRecordRequestError(
            409,
            'Esta entrada já possui uma correção direta; atualize a timeline e corrija a entrada mais recente'
          )
        }

        const correction = new MedicalRecordEntry()
        correction.useTransaction(trx)

        correction.merge({
          medicalRecordId: medicalRecord.id,
          patientId: patient.id,
          clinicId,
          patientClinicId: patientLink.id,
          clinicProfessionalId: professionalLink.id,
          appointmentId: null,
          authorUserId: user.id,
          entryTypeCode: 'correction',
          content: payload.content,
          correctsEntryId: originalEntry.id,
        })

        await correction.save()

        return {
          medicalRecordId: medicalRecord.id,
          entryId: correction.id,
        }
      })

      const entry = await loadMedicalRecordEntry(result)

      response.header('Cache-Control', 'private, no-store')

      return response.created({
        entry: entry!.serialize(),
      })
    } catch (error) {
      if (error instanceof MedicalRecordRequestError) {
        return respondForMedicalRecordError({
          error,
          response,
        })
      }

      const databaseError = getPostgreSqlError(error)

      if (
        databaseError?.code === '23505' &&
        databaseError.constraint === 'medical_record_entries_corrects_entry_unique'
      ) {
        return response.conflict({
          message: 'Esta entrada já foi corrigida por outra operação; atualize a timeline',
        })
      }

      throw error
    }
  }
}
