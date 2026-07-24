import vine from '@vinejs/vine'

export const readMedicalRecordValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).withoutDecimals().optional(),

    perPage: vine.number().min(1).max(100).withoutDecimals().optional(),

    purposeCode: vine.enum(['patient_care', 'care_coordination', 'legal_obligation', 'other']),

    purposeNote: vine.string().trim().minLength(1).maxLength(500).nullable().optional(),
  })
)

export const createMedicalRecordEntryValidator = vine.compile(
  vine.object({
    appointmentId: vine.string().uuid().nullable().optional(),

    entryTypeCode: vine.enum(['consultation', 'evolution', 'other']),

    content: vine.string().trim().minLength(1).maxLength(20000),
  })
)

export const correctMedicalRecordEntryValidator = vine.compile(
  vine.object({
    content: vine.string().trim().minLength(1).maxLength(20000),
  })
)
