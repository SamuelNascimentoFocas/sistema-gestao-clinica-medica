import vine from '@vinejs/vine'

export const listClinicMembersValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).withoutDecimals().optional(),
    perPage: vine.number().min(1).max(100).withoutDecimals().optional(),
    search: vine.string().trim().minLength(1).maxLength(180).optional(),
    roleCode: vine.enum(['clinic_admin', 'receptionist', 'doctor']).optional(),
    isActive: vine.boolean().optional(),
  })
)

export const createClinicMemberValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(3).maxLength(180),
    email: vine.string().trim().email().maxLength(254),
    password: vine.string().minLength(12).maxLength(72),
    roleCode: vine.enum(['clinic_admin', 'receptionist', 'doctor']),
  })
)

export const updateClinicMemberRoleValidator = vine.compile(
  vine.object({
    roleCode: vine.enum(['clinic_admin', 'receptionist', 'doctor']),
  })
)

export const updateClinicMemberStatusValidator = vine.compile(
  vine.object({
    isActive: vine.boolean({ strict: true }),
  })
)
