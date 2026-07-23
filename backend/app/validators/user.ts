import vine from '@vinejs/vine'

export const listUsersValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).withoutDecimals().optional(),
    perPage: vine.number().min(1).max(100).withoutDecimals().optional(),
    search: vine.string().trim().minLength(1).maxLength(254).optional(),
    isActive: vine.boolean().optional(),
    isGlobalAdmin: vine.boolean().optional(),
  })
)

export const createUserValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(3).maxLength(180),
    email: vine.string().trim().email().maxLength(254),
    password: vine.string().minLength(12).maxLength(72),
  })
)

export const updateUserValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(3).maxLength(180).optional(),

    email: vine.string().trim().email().maxLength(254).optional(),

    password: vine.string().minLength(12).maxLength(72).optional(),
  })
)

export const updateUserStatusValidator = vine.compile(
  vine.object({
    isActive: vine.boolean({ strict: true }),
  })
)
