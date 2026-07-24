import vine from '@vinejs/vine'

export const listProfessionalsValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).withoutDecimals().optional(),
    perPage: vine.number().min(1).max(100).withoutDecimals().optional(),
    search: vine.string().trim().minLength(1).maxLength(180).optional(),
    isActive: vine.boolean().optional(),
    acceptsAppointments: vine.boolean().optional(),
  })
)

export const createProfessionalValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(3).maxLength(180),

    crmNumber: vine
      .string()
      .trim()
      .minLength(1)
      .maxLength(30)
      .transform((value) => value.toUpperCase()),

    crmState: vine
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/)
      .transform((value) => value.toUpperCase()),

    specialty: vine.string().trim().minLength(2).maxLength(120),

    phone: vine.string().trim().minLength(1).maxLength(20).nullable().optional(),

    email: vine.string().trim().email().maxLength(254).nullable().optional(),

    userId: vine.string().uuid().nullable().optional(),

    localCode: vine.string().trim().minLength(1).maxLength(60).nullable().optional(),

    defaultAppointmentDurationMinutes: vine
      .number({ strict: true })
      .withoutDecimals()
      .min(5)
      .max(480)
      .optional(),

    acceptsAppointments: vine.boolean({ strict: true }).optional(),
  })
)

export const updateProfessionalLinkValidator = vine.compile(
  vine.object({
    localCode: vine.string().trim().minLength(1).maxLength(60).nullable().optional(),

    defaultAppointmentDurationMinutes: vine
      .number({ strict: true })
      .withoutDecimals()
      .min(5)
      .max(480)
      .optional(),

    acceptsAppointments: vine.boolean({ strict: true }).optional(),
  })
)

export const updateProfessionalLinkStatusValidator = vine.compile(
  vine.object({
    isActive: vine.boolean({ strict: true }),
  })
)
