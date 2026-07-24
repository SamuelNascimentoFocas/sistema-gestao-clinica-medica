import type { HttpContext } from '@adonisjs/core/http'
import PatientClinic from '#models/patient_clinic'
import MedicalRecordEntry from '#models/medical_record_entry'
import MedicalRecordAccessLog from '#models/medical_record_access_log'
import { readMedicalRecordValidator } from '#validators/medical_record'

type MedicalRecordRequestStatus = 404 | 409 | 422

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
}: {
  clinicId: string
  patientId: string
}) {
  const patientLink = await PatientClinic.query()
    .where('clinic_id', clinicId)
    .where('patient_id', patientId)
    .preload('patient', (patientQuery) => {
      patientQuery.preload('medicalRecord')
    })
    .first()

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
}
