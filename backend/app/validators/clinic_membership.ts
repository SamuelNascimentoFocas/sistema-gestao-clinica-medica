import vine from '@vinejs/vine'

export const listClinicMembershipsValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).withoutDecimals().optional(),
    perPage: vine.number().min(1).max(100).withoutDecimals().optional(),
    userId: vine.string().uuid().optional(),
    clinicId: vine.string().uuid().optional(),
    roleCode: vine.enum(['clinic_admin', 'receptionist', 'doctor']).optional(),
    isActive: vine.boolean().optional(),
  })
)

export const createClinicMembershipValidator = vine.compile(
  vine.object({
    userId: vine.string().uuid(),
    clinicId: vine.string().uuid(),
    roleCode: vine.enum(['clinic_admin', 'receptionist', 'doctor']),
  })
)

export const updateClinicMembershipValidator = vine.compile(
  vine.object({
    roleCode: vine.enum(['clinic_admin', 'receptionist', 'doctor']),
  })
)

export const updateClinicMembershipStatusValidator = vine.compile(
  vine.object({
    isActive: vine.boolean({ strict: true }),
  })
)
