import vine from '@vinejs/vine'

export const uploadMedicalRecordAttachmentsValidator = vine.compile(
  vine.object({
    files: vine
      .array(
        vine.file({
          size: '10mb',
          extnames: ['pdf', 'jpg', 'jpeg', 'png'],
        })
      )
      .minLength(1)
      .maxLength(2),
  })
)
