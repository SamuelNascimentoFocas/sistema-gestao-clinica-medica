import vine from '@vinejs/vine'
import { optionalRoleIdGroup, requiredRoleIdGroup } from '#validators/role_selector'

export const listClinicMembershipsValidator = vine.compile(
  vine
    .object({
      page: vine.number().min(1).withoutDecimals().optional(),
      perPage: vine.number().min(1).max(100).withoutDecimals().optional(),
      userId: vine.string().uuid().optional(),
      clinicId: vine.string().uuid().optional(),
      isActive: vine.boolean().optional(),
    })
    .merge(optionalRoleIdGroup())
)

export const createClinicMembershipValidator = vine.compile(
  vine
    .object({
      userId: vine.string().uuid(),
      clinicId: vine.string().uuid(),
    })
    .merge(requiredRoleIdGroup())
)

export const updateClinicMembershipValidator = vine.compile(
  vine.object({}).merge(requiredRoleIdGroup())
)

export const updateClinicMembershipStatusValidator = vine.compile(
  vine.object({
    isActive: vine.boolean({ strict: true }),
  })
)
