import { DateTime } from 'luxon'
import vine from '@vinejs/vine'

export const listPatientsValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).withoutDecimals().optional(),
    perPage: vine.number().min(1).max(100).withoutDecimals().optional(),
    search: vine.string().trim().minLength(1).maxLength(180).optional(),
    isActive: vine.boolean().optional(),
  })
)

export const createPatientValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(3).maxLength(180),

    birthDate: vine
      .date({
        formats: ['YYYY-MM-DD'],
      })
      .beforeOrEqual('today')
      .transform((value) => DateTime.fromJSDate(value)),

    cpf: vine
      .string()
      .trim()
      .regex(/^[0-9]{11}$/)
      .nullable()
      .optional(),

    phone: vine.string().trim().minLength(1).maxLength(20).nullable().optional(),

    email: vine.string().trim().email().maxLength(254).nullable().optional(),

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

    localRecordNumber: vine.string().trim().minLength(1).maxLength(60).nullable().optional(),
  })
)

export const updatePatientValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(3).maxLength(180).optional(),

    birthDate: vine
      .date({
        formats: ['YYYY-MM-DD'],
      })
      .beforeOrEqual('today')
      .transform((value) => DateTime.fromJSDate(value))
      .optional(),

    cpf: vine
      .string()
      .trim()
      .regex(/^[0-9]{11}$/)
      .nullable()
      .optional(),

    phone: vine.string().trim().minLength(1).maxLength(20).nullable().optional(),

    email: vine.string().trim().email().maxLength(254).nullable().optional(),

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

    localRecordNumber: vine.string().trim().minLength(1).maxLength(60).nullable().optional(),
  })
)

export const updatePatientLinkStatusValidator = vine.compile(
  vine.object({
    isActive: vine.boolean({ strict: true }),
  })
)
