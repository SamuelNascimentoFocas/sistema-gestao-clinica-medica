import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { loginValidator } from '#validators/session'

export default class SessionsController {
  async store({ request, response, auth }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    const normalizedEmail = email.toLowerCase()
    const passwordlessUser = await User.query()
      .where('email_normalized', normalizedEmail)
      .whereNull('password_hash')
      .first()
    const user = await User.verifyCredentials(
      passwordlessUser ? `password-not-configured:${passwordlessUser.id}` : normalizedEmail,
      password
    )

    if (!user.isActive) {
      return response.forbidden({
        message: 'Usuário inativo',
      })
    }

    const token = await auth.use('api').createToken(user, ['*'], {
      name: 'web',
    })

    user.lastLoginAt = DateTime.utc()
    await user.save()

    return response.ok({
      user: user.serialize(),
      token: {
        type: 'bearer',
        value: token.value!.release(),
        expiresAt: token.expiresAt?.toISOString() ?? null,
      },
    })
  }

  async show({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()

    return response.ok({
      user: user.serialize(),
    })
  }

  async destroy({ auth, response }: HttpContext) {
    await auth.use('api').invalidateToken()

    return response.noContent()
  }
}
