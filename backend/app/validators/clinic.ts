import vine from '@vinejs/vine'

export const listClinicsValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).withoutDecimals().optional(),
    perPage: vine.number().min(1).max(100).withoutDecimals().optional(),
    search: vine.string().trim().minLength(1).maxLength(180).optional(),
    isActive: vine.boolean().optional(),
  })
)

export const createClinicValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(180),

    cnpj: vine
      .string()
      .trim()
      .regex(/^[0-9]{14}$/)
      .nullable()
      .optional(),

    phone: vine.string().trim().minLength(1).maxLength(20).nullable().optional(),

    addressStreet: vine.string().trim().minLength(1).maxLength(180).nullable().optional(),

    addressNumber: vine.string().trim().minLength(1).maxLength(30).nullable().optional(),

    addressComplement: vine.string().trim().minLength(1).maxLength(120).nullable().optional(),

    addressNeighborhood: vine.string().trim().minLength(1).maxLength(120).nullable().optional(),

    addressCity: vine.string().trim().minLength(1).maxLength(120).nullable().optional(),

    addressState: vine.string().trim().minLength(2).maxLength(2).nullable().optional(),

    addressPostalCode: vine
      .string()
      .trim()
      .regex(/^[0-9]{8}$/)
      .nullable()
      .optional(),
  })
)

export const updateClinicValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(180).optional(),

    cnpj: vine
      .string()
      .trim()
      .regex(/^[0-9]{14}$/)
      .nullable()
      .optional(),

    phone: vine.string().trim().minLength(1).maxLength(20).nullable().optional(),

    addressStreet: vine.string().trim().minLength(1).maxLength(180).nullable().optional(),

    addressNumber: vine.string().trim().minLength(1).maxLength(30).nullable().optional(),

    addressComplement: vine.string().trim().minLength(1).maxLength(120).nullable().optional(),

    addressNeighborhood: vine.string().trim().minLength(1).maxLength(120).nullable().optional(),

    addressCity: vine.string().trim().minLength(1).maxLength(120).nullable().optional(),

    addressState: vine.string().trim().minLength(2).maxLength(2).nullable().optional(),

    addressPostalCode: vine
      .string()
      .trim()
      .regex(/^[0-9]{8}$/)
      .nullable()
      .optional(),
  })
)

export const updateClinicStatusValidator = vine.compile(
  vine.object({
    isActive: vine.boolean({ strict: true }),
  })
)
