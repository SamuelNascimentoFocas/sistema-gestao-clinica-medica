import type { Infer } from '@vinejs/vine/types'
import db from '@adonisjs/lucid/services/db'
import Patient from '#models/patient'
import PatientClinic from '#models/patient_clinic'
import DomainError from '#exceptions/domain_error'
import { getUniqueConstraint } from '#services/postgres_error'
import type { listPatientsValidator, updatePatientValidator } from '#validators/patient'

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

export function rethrowPatientError(error: unknown): never {
  const message = conflictMessageForConstraint(getUniqueConstraint(error))
  if (message) throw new DomainError('conflict', message)
  throw error
}

export async function loadPatientLink({
  clinicId,
  patientId,
}: {
  clinicId: string
  patientId: string
}) {
  return PatientClinic.query()
    .where('clinic_id', clinicId)
    .where('patient_id', patientId)
    .preload('clinic')
    .preload('patient', (patientQuery) => {
      patientQuery.preload('medicalRecord')
    })
    .first()
}

export async function listPatients(clinicId: string, filters: Infer<typeof listPatientsValidator>) {
  const page = filters.page ?? 1
  const perPage = filters.perPage ?? 20

  const query = PatientClinic.query()
    .where('clinic_id', clinicId)
    .preload('patient', (patientQuery) => {
      patientQuery.preload('medicalRecord')
    })
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')

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

  return patientLinks
}

export async function findPatientLinkForStatus(clinicId: string, patientId: string) {
  const patientLink = await PatientClinic.query()
    .where('clinic_id', clinicId)
    .where('patient_id', patientId)
    .preload('patient')
    .first()

  return patientLink
}

export async function updatePatient(
  clinicId: string,
  patientId: string,
  payload: Infer<typeof updatePatientValidator>
) {
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
        throw new DomainError('not_found', 'Paciente não encontrado neste consultório')
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
            throw new DomainError('conflict', 'Já existe um paciente cadastrado com este CPF')
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
            throw new DomainError(
              'conflict',
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

    return patientLink!
  } catch (error) {
    rethrowPatientError(error)
  }
}

export async function setPatientLinkStatus(
  clinicId: string,
  patientLink: PatientClinic,
  isActive: boolean
) {
  if (isActive && !patientLink.patient.isActive) {
    throw new DomainError(
      'conflict',
      'Não é possível ativar o vínculo de um paciente globalmente inativo'
    )
  }

  patientLink.isActive = isActive
  await patientLink.save()

  const loadedPatientLink = await loadPatientLink({
    clinicId,
    patientId: patientLink.patientId,
  })

  return loadedPatientLink!
}
