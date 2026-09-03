import MedicalRecordAccessLog from '#models/medical_record_access_log'
import DomainError from '#exceptions/domain_error'

export type MedicalRecordAccessPurpose =
  'patient_care' | 'care_coordination' | 'legal_obligation' | 'other'

export function validateAccessPurpose({
  purposeCode,
  purposeNote,
}: {
  purposeCode: MedicalRecordAccessPurpose
  purposeNote?: string | null
}) {
  if (purposeCode === 'other' && !purposeNote) {
    throw new DomainError(
      'invalid',
      'A finalidade deve ser detalhada quando o código informado for other'
    )
  }
}

export async function registerMedicalRecordAccess({
  medicalRecordId,
  patientId,
  clinicId,
  patientClinicId,
  userId,
  accessAction,
  purposeCode,
  purposeNote,
  attachmentId = null,
}: {
  medicalRecordId: string
  patientId: string
  clinicId: string
  patientClinicId: string
  userId: string
  accessAction: 'view_timeline' | 'view_entry' | 'list_attachments' | 'download_attachment'
  purposeCode: MedicalRecordAccessPurpose
  purposeNote?: string | null
  attachmentId?: string | null
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
    medicalRecordAttachmentId: attachmentId,
  })
}
