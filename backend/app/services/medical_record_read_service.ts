import type { Infer } from '@vinejs/vine/types'
import MedicalRecordEntry from '#models/medical_record_entry'
import DomainError from '#exceptions/domain_error'
import type { readMedicalRecordValidator } from '#validators/medical_record'
import { loadPatientContext } from '#services/medical_record_context_service'
import {
  validateAccessPurpose,
  registerMedicalRecordAccess,
} from '#services/medical_record_access_service'

export type MedicalRecordContext = { clinicId: string; patientId: string; userId: string }
type ReadFilters = Infer<typeof readMedicalRecordValidator>

function medicalRecordEntriesQuery(medicalRecordId: string) {
  return MedicalRecordEntry.query()
    .where('medical_record_id', medicalRecordId)
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
}

export async function loadMedicalRecordEntry({
  medicalRecordId,
  entryId,
}: {
  medicalRecordId: string
  entryId: string
}) {
  return medicalRecordEntriesQuery(medicalRecordId).where('id', entryId).first()
}

export async function listMedicalRecordEntries(
  { clinicId, patientId, userId }: MedicalRecordContext,
  filters: ReadFilters
) {
  validateAccessPurpose(filters)

  const { patientLink, patient, medicalRecord } = await loadPatientContext({
    clinicId,
    patientId,
  })

  const page = filters.page ?? 1
  const perPage = filters.perPage ?? 20

  const entries = await medicalRecordEntriesQuery(medicalRecord.id)
    .orderBy('created_at', 'desc')
    .paginate(page, perPage)

  await registerMedicalRecordAccess({
    medicalRecordId: medicalRecord.id,
    patientId: patient.id,
    clinicId,
    patientClinicId: patientLink.id,
    userId,
    accessAction: 'view_timeline',
    purposeCode: filters.purposeCode,
    purposeNote: filters.purposeNote,
  })

  return { patientLink, patient, medicalRecord, entries }
}

export async function readMedicalRecordEntry(
  { clinicId, patientId, userId }: MedicalRecordContext,
  entryId: string,
  filters: ReadFilters
) {
  validateAccessPurpose(filters)

  const { patientLink, patient, medicalRecord } = await loadPatientContext({
    clinicId,
    patientId,
  })

  const entry = await loadMedicalRecordEntry({ medicalRecordId: medicalRecord.id, entryId })

  if (!entry) {
    throw new DomainError('not_found', 'Entrada do prontuário não encontrada')
  }

  await registerMedicalRecordAccess({
    medicalRecordId: medicalRecord.id,
    patientId: patient.id,
    clinicId,
    patientClinicId: patientLink.id,
    userId,
    accessAction: 'view_entry',
    purposeCode: filters.purposeCode,
    purposeNote: filters.purposeNote,
  })

  return entry
}
