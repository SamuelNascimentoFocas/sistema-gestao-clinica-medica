import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Patient from '#models/patient'
import PatientClinic from '#models/patient_clinic'
import MedicalRecord from '#models/medical_record'
import {
  createPatientValidator,
  listPatientsValidator,
  updatePatientLinkStatusValidator,
  updatePatientValidator,
} from '#validators/patient'

class PatientConflictError extends Error {}

type PostgreSqlError = {
  code?: string
  constraint?: string
}

function getUniqueConstraint(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return null
  }

  const databaseError = error as PostgreSqlError

  if (databaseError.code !== '23505') {
    return null
  }

  return databaseError.constraint ?? null
}

function conflictMessageForConstraint(constraint: string | null) {
  switch (constraint) {
    case 'patients_cpf_unique':
      return 'Já existe um paciente cadastrado com este CPF'

    case 'patient_clinics_patient_clinic_unique':
      return 'Este paciente já está vinculado ao consultório'

    case 'patient_clinics_local_record_unique':
      return 'Este número de prontuário local já está em uso no consultório'

    case 'medical_records_patient_unique':
      return 'Este paciente já possui um prontuário'

    default:
      return null
  }
}

async function loadPatientLink({ clinicId, patientId }: { clinicId: string; patientId: string }) {
  return PatientClinic.query()
    .where('clinic_id', clinicId)
    .where('patient_id', patientId)
    .preload('clinic')
    .preload('patient', (patientQuery) => {
      patientQuery.preload('medicalRecord')
    })
    .first()
}

export default class PatientsController {
  async index({ clinicAuthorization, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const filters = await listPatientsValidator.validate(request.qs())

    const page = filters.page ?? 1
    const perPage = filters.perPage ?? 20

    const query = PatientClinic.query()
      .where('clinic_id', clinicAuthorization.clinic.id)
      .preload('patient', (patientQuery) => {
        patientQuery.preload('medicalRecord')
      })
      .orderBy('created_at', 'desc')

    if (filters.isActive !== undefined) {
      query.where('is_active', filters.isActive)
    }

    if (filters.search) {
      const search = `%${filters.search}%`

      query.where((scope) => {
        scope
          .whereRaw('local_record_number ILIKE ?', [search])
          .orWhereHas('patient', (patientQuery) => {
            patientQuery
              .whereRaw('full_name ILIKE ?', [search])
              .orWhereRaw('cpf ILIKE ?', [search])
              .orWhereRaw('phone ILIKE ?', [search])
          })
      })
    }

    const patientLinks = await query.paginate(page, perPage)

    return response.ok({
      data: patientLinks.all().map((patientLink) => patientLink.serialize()),
      meta: patientLinks.getMeta(),
    })
  }

  async store({ clinicAuthorization, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const payload = await request.validateUsing(createPatientValidator)
    const clinicId = clinicAuthorization.clinic.id

    try {
      const result = await db.transaction(async (trx) => {
        let patient: Patient | null = null

        if (payload.cpf) {
          patient = await Patient.query({ client: trx }).where('cpf', payload.cpf).first()
        }

        if (patient) {
          if (!patient.isActive) {
            throw new PatientConflictError(
              'Não é possível vincular um paciente globalmente inativo'
            )
          }

          if (patient.birthDate.toISODate() !== payload.birthDate.toISODate()) {
            throw new PatientConflictError(
              'O CPF informado pertence a um paciente com outra data de nascimento'
            )
          }

          const existingLink = await PatientClinic.query({
            client: trx,
          })
            .where('patient_id', patient.id)
            .where('clinic_id', clinicId)
            .first()

          if (existingLink) {
            throw new PatientConflictError('Este paciente já está vinculado ao consultório')
          }
        } else {
          patient = new Patient()
          patient.useTransaction(trx)

          patient.merge({
            fullName: payload.fullName,
            birthDate: payload.birthDate,
            cpf: payload.cpf ?? null,
            phone: payload.phone ?? null,
            email: payload.email?.toLowerCase() ?? null,
            addressStreet: payload.addressStreet ?? null,
            addressNumber: payload.addressNumber ?? null,
            addressComplement: payload.addressComplement ?? null,
            addressNeighborhood: payload.addressNeighborhood ?? null,
            addressCity: payload.addressCity ?? null,
            addressState: payload.addressState?.toUpperCase() ?? null,
            addressPostalCode: payload.addressPostalCode ?? null,
            isActive: true,
          })

          await patient.save()
        }

        if (payload.localRecordNumber) {
          const existingLocalRecord = await PatientClinic.query({
            client: trx,
          })
            .where('clinic_id', clinicId)
            .where('local_record_number', payload.localRecordNumber)
            .first()

          if (existingLocalRecord) {
            throw new PatientConflictError(
              'Este número de prontuário local já está em uso no consultório'
            )
          }
        }

        let medicalRecord = await MedicalRecord.query({
          client: trx,
        })
          .where('patient_id', patient.id)
          .first()

        if (!medicalRecord) {
          medicalRecord = new MedicalRecord()
          medicalRecord.useTransaction(trx)
          medicalRecord.patientId = patient.id
          await medicalRecord.save()
        }

        const patientLink = new PatientClinic()
        patientLink.useTransaction(trx)
        patientLink.patientId = patient.id
        patientLink.clinicId = clinicId
        patientLink.localRecordNumber = payload.localRecordNumber ?? null
        patientLink.isActive = true

        await patientLink.save()

        return {
          patientId: patient.id,
        }
      })

      const patientLink = await loadPatientLink({
        clinicId,
        patientId: result.patientId,
      })

      return response.created({
        patientLink: patientLink!.serialize(),
      })
    } catch (error) {
      if (error instanceof PatientConflictError) {
        return response.conflict({
          message: error.message,
        })
      }

      const constraint = getUniqueConstraint(error)
      const message = conflictMessageForConstraint(constraint)

      if (message) {
        return response.conflict({
          message,
        })
      }

      throw error
    }
  }

  async show({ clinicAuthorization, params, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const patientLink = await loadPatientLink({
      clinicId: clinicAuthorization.clinic.id,
      patientId: params.patientId,
    })

    if (!patientLink) {
      return response.notFound({
        message: 'Paciente não encontrado neste consultório',
      })
    }

    return response.ok({
      patientLink: patientLink.serialize(),
    })
  }

  async update({ clinicAuthorization, params, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const payload = await request.validateUsing(updatePatientValidator)

    if (Object.keys(payload).length === 0) {
      return response.badRequest({
        message: 'Informe pelo menos um campo para atualização',
      })
    }

    const clinicId = clinicAuthorization.clinic.id
    const patientId = params.patientId

    try {
      await db.transaction(async (trx) => {
        const patientLink = await PatientClinic.query({
          client: trx,
        })
          .where('clinic_id', clinicId)
          .where('patient_id', patientId)
          .preload('patient')
          .first()

        if (!patientLink) {
          throw new PatientConflictError('Paciente não encontrado neste consultório')
        }

        const patient = patientLink.patient

        if (payload.cpf !== undefined && payload.cpf !== patient.cpf) {
          if (payload.cpf) {
            const patientWithCpf = await Patient.query({
              client: trx,
            })
              .where('cpf', payload.cpf)
              .whereNot('id', patient.id)
              .first()

            if (patientWithCpf) {
              throw new PatientConflictError('Já existe um paciente cadastrado com este CPF')
            }
          }

          patient.cpf = payload.cpf
        }

        if (
          payload.localRecordNumber !== undefined &&
          payload.localRecordNumber !== patientLink.localRecordNumber
        ) {
          if (payload.localRecordNumber) {
            const linkWithLocalRecord = await PatientClinic.query({
              client: trx,
            })
              .where('clinic_id', clinicId)
              .where('local_record_number', payload.localRecordNumber)
              .whereNot('id', patientLink.id)
              .first()

            if (linkWithLocalRecord) {
              throw new PatientConflictError(
                'Este número de prontuário local já está em uso no consultório'
              )
            }
          }

          patientLink.localRecordNumber = payload.localRecordNumber
        }

        if (payload.fullName !== undefined) {
          patient.fullName = payload.fullName
        }

        if (payload.birthDate !== undefined) {
          patient.birthDate = payload.birthDate
        }

        if (payload.phone !== undefined) {
          patient.phone = payload.phone
        }

        if (payload.email !== undefined) {
          patient.email = payload.email?.toLowerCase() ?? null
        }

        if (payload.addressStreet !== undefined) {
          patient.addressStreet = payload.addressStreet
        }

        if (payload.addressNumber !== undefined) {
          patient.addressNumber = payload.addressNumber
        }

        if (payload.addressComplement !== undefined) {
          patient.addressComplement = payload.addressComplement
        }

        if (payload.addressNeighborhood !== undefined) {
          patient.addressNeighborhood = payload.addressNeighborhood
        }

        if (payload.addressCity !== undefined) {
          patient.addressCity = payload.addressCity
        }

        if (payload.addressState !== undefined) {
          patient.addressState = payload.addressState?.toUpperCase() ?? null
        }

        if (payload.addressPostalCode !== undefined) {
          patient.addressPostalCode = payload.addressPostalCode
        }

        await patient.save()
        await patientLink.save()
      })

      const patientLink = await loadPatientLink({
        clinicId,
        patientId,
      })

      return response.ok({
        patientLink: patientLink!.serialize(),
      })
    } catch (error) {
      if (error instanceof PatientConflictError) {
        if (error.message === 'Paciente não encontrado neste consultório') {
          return response.notFound({
            message: error.message,
          })
        }

        return response.conflict({
          message: error.message,
        })
      }

      const constraint = getUniqueConstraint(error)
      const message = conflictMessageForConstraint(constraint)

      if (message) {
        return response.conflict({
          message,
        })
      }

      throw error
    }
  }

  async updateStatus({ clinicAuthorization, params, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const patientLink = await PatientClinic.query()
      .where('clinic_id', clinicAuthorization.clinic.id)
      .where('patient_id', params.patientId)
      .preload('patient')
      .first()

    if (!patientLink) {
      return response.notFound({
        message: 'Paciente não encontrado neste consultório',
      })
    }

    const { isActive } = await request.validateUsing(updatePatientLinkStatusValidator)

    if (isActive && !patientLink.patient.isActive) {
      return response.conflict({
        message: 'Não é possível ativar o vínculo de um paciente globalmente inativo',
      })
    }

    patientLink.isActive = isActive
    await patientLink.save()

    const loadedPatientLink = await loadPatientLink({
      clinicId: clinicAuthorization.clinic.id,
      patientId: patientLink.patientId,
    })

    return response.ok({
      patientLink: loadedPatientLink!.serialize(),
    })
  }
}
