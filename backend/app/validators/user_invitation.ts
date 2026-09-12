import vine from '@vinejs/vine'

const password = vine.string().minLength(12).maxLength(72)
const forbiddenInput = vine.createRule((_, __, field) => {
  field.report('The {{ field }} field is not accepted by invitation endpoints', 'forbidden', field)
})

function forbiddenField() {
  return vine.any().use(forbiddenInput()).optional()
}

export const createGlobalUserInvitationValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(3).maxLength(180),
    email: vine.string().trim().email().maxLength(254),
    memberships: vine
      .array(
        vine.object({
          clinicId: vine.string().uuid(),
          roleId: vine.string().uuid(),
        })
      )
      .distinct('clinicId')
      .optional(),
    password: forbiddenField(),
    passwordConfirmation: forbiddenField(),
    isGlobalAdmin: forbiddenField(),
  })
)

export const createClinicUserInvitationValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(3).maxLength(180),
    email: vine.string().trim().email().maxLength(254),
    roleId: vine.string().uuid(),
    password: forbiddenField(),
    passwordConfirmation: forbiddenField(),
    isGlobalAdmin: forbiddenField(),
  })
)

export const invitationTokenValidator = vine.compile(
  vine.object({
    token: vine.string().trim().minLength(40).maxLength(100),
  })
)

export const acceptInvitationValidator = vine.compile(
  vine.object({
    token: vine.string().trim().minLength(40).maxLength(100),
    password: password,
    passwordConfirmation: password.sameAs('password'),
  })
)

export function assertPasswordWithinBcryptLimit(passwordValue: string) {
  if (Buffer.byteLength(passwordValue, 'utf8') > 72) {
    throw new Error('PASSWORD_EXCEEDS_BCRYPT_LIMIT')
  }
}
