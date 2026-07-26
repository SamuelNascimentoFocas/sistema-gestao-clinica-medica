import vine from '@vinejs/vine'

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
