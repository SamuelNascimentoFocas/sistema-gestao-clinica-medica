import vine from '@vinejs/vine'
import { optionalRoleSelectorGroup, requiredRoleSelectorGroup } from '#validators/role_selector'

export const listClinicMembersValidator = vine.compile(
  vine
    .object({
      page: vine.number().min(1).withoutDecimals().optional(),
      perPage: vine.number().min(1).max(100).withoutDecimals().optional(),
      search: vine.string().trim().minLength(1).maxLength(180).optional(),
      isActive: vine.boolean().optional(),
    })
    .merge(optionalRoleSelectorGroup())
)

export const createClinicMemberValidator = vine.compile(
  vine
    .object({
      fullName: vine.string().trim().minLength(3).maxLength(180),
      email: vine.string().trim().email().maxLength(254),
      password: vine.string().minLength(12).maxLength(72),
    })
    .merge(requiredRoleSelectorGroup())
)

export const updateClinicMemberRoleValidator = vine.compile(
  vine.object({}).merge(requiredRoleSelectorGroup())
)

export const updateClinicMemberStatusValidator = vine.compile(
  vine.object({
    isActive: vine.boolean({ strict: true }),
  })
)
