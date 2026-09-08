import vine from '@vinejs/vine'
import attachmentConfig from '#config/attachments'

export const readMedicalRecordAttachmentsValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).withoutDecimals().optional(),

    perPage: vine.number().min(1).max(100).withoutDecimals().optional(),

    purposeCode: vine.enum(['patient_care', 'care_coordination', 'legal_obligation', 'other']),

    purposeNote: vine.string().trim().minLength(1).maxLength(500).nullable().optional(),
  })
)

export const uploadMedicalRecordAttachmentsValidator = vine.compile(
  vine.object({
    files: vine
      .array(
        vine.file({
          size: attachmentConfig.maxBytes,
        })
      )
      .minLength(1)
      .maxLength(2),
  })
)
