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

export const updateUserValidator = vine.compile(
  vine
    .object({
      fullName: vine.string().trim().minLength(3).maxLength(180).optional(),
      email: vine.string().trim().email().maxLength(254).optional(),
    })
    .merge(
      vine
        .group([
          vine.group.if(
            (data) =>
              data.password === undefined &&
              data.passwordConfirmation === undefined &&
              data.passwordHash === undefined,
            {}
          ),
        ])
        .otherwise((_, field) => {
          field.report(
            'Administrative password fields are not accepted by this endpoint',
            'forbidden',
            field
          )
        })
    )
)

export const updateUserStatusValidator = vine.compile(
  vine.object({
    isActive: vine.boolean({ strict: true }),
  })
)
