import type { Infer } from '@vinejs/vine/types'
import db from '@adonisjs/lucid/services/db'
import MedicalRecordAttachment from '#models/medical_record_attachment'
import DomainError from '#exceptions/domain_error'
import type {
  readMedicalRecordAttachmentsValidator,
  uploadMedicalRecordAttachmentsValidator,
} from '#validators/medical_record_attachment'
import {
  loadPatientContext,
  loadWritableEntry,
  loadReadableEntry,
} from '#services/medical_record_context_service'
import {
  validateAccessPurpose,
  registerMedicalRecordAccess,
} from '#services/medical_record_access_service'
import {
  ATTACHMENT_STORAGE_DISK,
  prepareAttachmentFiles,
  moveAttachmentFile,
  removeMovedAttachments,
  readAttachmentBytes,
} from '#services/attachment_storage_service'

type AttachmentContext = {
  clinicId: string
  patientId: string
  entryId: string
  userId: string
  permissionCodes: readonly string[]
}
type ReadFilters = Infer<typeof readMedicalRecordAttachmentsValidator>
type UploadPayload = Infer<typeof uploadMedicalRecordAttachmentsValidator>

async function loadAttachment({
  patientId,
  medicalRecordId,
  entryId,
  attachmentId,
}: {
  patientId: string
  medicalRecordId: string
  entryId: string
  attachmentId: string
}) {
  const attachment = await MedicalRecordAttachment.query()
    .where('id', attachmentId)
    .where('patient_id', patientId)
    .where('medical_record_id', medicalRecordId)
    .where('medical_record_entry_id', entryId)
    .first()

  if (!attachment) {
    throw new DomainError('not_found', 'Anexo do prontuário não encontrado')
  }

  return attachment
}

export async function listAttachments(
  { clinicId, patientId, entryId, userId, permissionCodes }: AttachmentContext,
  filters: ReadFilters
) {
  validateAccessPurpose(filters)

  const { patientLink, patient, medicalRecord } = await loadPatientContext({
    clinicId,
    patientId,
    authorization: { userId, permissionCodes },
  })

  const entry = await loadReadableEntry({
    patientId: patient.id,
    medicalRecordId: medicalRecord.id,
    entryId,
  })

  const page = filters.page ?? 1
  const perPage = filters.perPage ?? 20

  const attachments = await MedicalRecordAttachment.query()
    .where('patient_id', patient.id)
    .where('medical_record_id', medicalRecord.id)
    .where('medical_record_entry_id', entry.id)
    .where('status', 'available')
    .orderBy('created_at', 'desc')
    .paginate(page, perPage)

  await registerMedicalRecordAccess({
    medicalRecordId: medicalRecord.id,
    patientId: patient.id,
    clinicId,
    patientClinicId: patientLink.id,
    userId,
    accessAction: 'list_attachments',
    purposeCode: filters.purposeCode,
    purposeNote: filters.purposeNote,
  })

  return attachments
}

export async function uploadAttachments(
  { clinicId, patientId, entryId, userId, permissionCodes }: AttachmentContext,
  payload: UploadPayload
) {
  const movedStorageKeys: string[] = []
  try {
    const { patient, medicalRecord } = await loadPatientContext({
      clinicId,
      patientId,
      authorization: { userId, permissionCodes },
    })

    const entry = await loadWritableEntry({
      clinicId,
      patientId: patient.id,
      medicalRecordId: medicalRecord.id,
      entryId,
    })

    const preparedFiles = await prepareAttachmentFiles(payload.files, medicalRecord.id, entry.id)

    for (const preparedFile of preparedFiles) {
      await moveAttachmentFile(preparedFile)

      movedStorageKeys.push(preparedFile.storageKey)
    }

    const attachments = await db.transaction(async (trx) => {
      const currentContext = await loadPatientContext({
        clinicId,
        patientId,
        authorization: { userId, permissionCodes },
        client: trx,
        lock: true,
      })

      const currentEntry = await loadWritableEntry({
        clinicId,
        patientId: currentContext.patient.id,
        medicalRecordId: currentContext.medicalRecord.id,
        entryId,
        client: trx,
        lock: true,
      })

      const createdAttachments: MedicalRecordAttachment[] = []

      for (const preparedFile of preparedFiles) {
        const attachment = new MedicalRecordAttachment()
        attachment.useTransaction(trx)

        attachment.merge({
          medicalRecordEntryId: currentEntry.id,
          medicalRecordId: currentContext.medicalRecord.id,
          patientId: currentContext.patient.id,
          clinicId,
          uploadedByUserId: userId,
          originalName: preparedFile.originalName,
          storageDisk: ATTACHMENT_STORAGE_DISK,
          storageKey: preparedFile.storageKey,
          contentType: preparedFile.contentType,
          sizeInBytes: preparedFile.file.size,
          sha256: preparedFile.sha256,
          status: 'available',
          statusReason: null,
        })

        await attachment.save()
        createdAttachments.push(attachment)
      }

      return createdAttachments
    })

    return {
      attachments,
      compensate: () => removeMovedAttachments(movedStorageKeys),
    }
  } catch (error) {
    if (movedStorageKeys.length > 0) {
      await removeMovedAttachments(movedStorageKeys)
    }
    throw error
  }
}

export async function downloadAttachment(
  { clinicId, patientId, entryId, userId, permissionCodes }: AttachmentContext,
  attachmentId: string,
  filters: ReadFilters
) {
  validateAccessPurpose(filters)

  const { patientLink, patient, medicalRecord } = await loadPatientContext({
    clinicId,
    patientId,
    authorization: { userId, permissionCodes },
  })

  const entry = await loadReadableEntry({
    patientId: patient.id,
    medicalRecordId: medicalRecord.id,
    entryId,
  })

  const attachment = await loadAttachment({
    patientId: patient.id,
    medicalRecordId: medicalRecord.id,
    entryId: entry.id,
    attachmentId,
  })

  if (attachment.status !== 'available') {
    throw new DomainError('conflict', 'O anexo ainda não está disponível para download')
  }

  const fileContents = await readAttachmentBytes(attachment.storageDisk, attachment.storageKey)

  await registerMedicalRecordAccess({
    medicalRecordId: medicalRecord.id,
    patientId: patient.id,
    clinicId,
    patientClinicId: patientLink.id,
    userId,
    accessAction: 'download_attachment',
    purposeCode: filters.purposeCode,
    purposeNote: filters.purposeNote,
    attachmentId: attachment.id,
  })

  return { attachment, fileContents }
}
