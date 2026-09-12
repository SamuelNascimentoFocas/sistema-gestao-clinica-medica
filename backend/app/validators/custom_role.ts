import vine from '@vinejs/vine'

const customRoleFields = {
  name: vine.string().trim().minLength(3).maxLength(120),
  description: vine.string().trim().maxLength(255).nullable().optional(),
  permissionCodes: vine.array(vine.string().trim().maxLength(100)).distinct(),
}

export const createCustomRoleValidator = vine.compile(vine.object(customRoleFields))

export const updateCustomRoleValidator = vine.compile(vine.object(customRoleFields))

export const updateCustomRoleStatusValidator = vine.compile(
  vine.object({
    isActive: vine.boolean({ strict: true }),
  })
)
