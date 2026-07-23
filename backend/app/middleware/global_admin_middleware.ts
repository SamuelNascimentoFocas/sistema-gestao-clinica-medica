import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class GlobalAdminMiddleware {
  async handle({ auth, response }: HttpContext, next: NextFn) {
    const user = auth.getUserOrFail()

    if (!user.isActive) {
      return response.forbidden({
        message: 'Usuário inativo',
      })
    }

    if (!user.isGlobalAdmin) {
      return response.forbidden({
        message: 'Acesso restrito ao Administrador Geral',
      })
    }

    return next()
  }
}
