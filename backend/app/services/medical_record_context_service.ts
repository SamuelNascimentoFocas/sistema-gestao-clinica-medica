import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import PatientClinic from '#models/patient_clinic'
import ClinicProfessional from '#models/clinic_professional'
import MedicalRecordEntry from '#models/medical_record_entry'
import DomainError from '#exceptions/domain_error'

export async function loadPatientContext({
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
    throw new DomainError('not_found', 'Paciente não encontrado neste consultório')
  }

  if (!patientLink.isActive || !patientLink.patient.isActive) {
    throw new DomainError('conflict', 'O paciente ou seu vínculo com o consultório está inativo')
  }

  const medicalRecord = patientLink.patient.medicalRecord

  if (!medicalRecord) {
    throw new DomainError('conflict', 'O paciente não possui um prontuário associado')
  }

  return {
    patientLink,
    patient: patientLink.patient,
    medicalRecord,
  }
}

export async function loadClinicalAuthor({
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
    throw new DomainError(
      'forbidden',
      'O usuário não possui um perfil profissional clínico ativo neste consultório'
    )
  }

  return professionalLink
}

export async function loadWritableEntry({
  clinicId,
  patientId,
  medicalRecordId,
  entryId,
  client,
  lock = false,
}: {
  clinicId: string
  patientId: string
  medicalRecordId: string
  entryId: string
  client?: TransactionClientContract
  lock?: boolean
}) {
  const query = client ? MedicalRecordEntry.query({ client }) : MedicalRecordEntry.query()

  query
    .where('id', entryId)
    .where('clinic_id', clinicId)
    .where('patient_id', patientId)
    .where('medical_record_id', medicalRecordId)

  if (lock) {
    query.forUpdate()
  }

  const entry = await query.first()

  if (!entry) {
    throw new DomainError('not_found', 'Entrada do prontuário não encontrada neste consultório')
  }

  return entry
}

export async function loadReadableEntry({
  patientId,
  medicalRecordId,
  entryId,
}: {
  patientId: string
  medicalRecordId: string
  entryId: string
}) {
  const entry = await MedicalRecordEntry.query()
    .where('id', entryId)
    .where('patient_id', patientId)
    .where('medical_record_id', medicalRecordId)
    .first()

  if (!entry) {
    throw new DomainError('not_found', 'Entrada do prontuário não encontrada')
  }

  return entry
}
