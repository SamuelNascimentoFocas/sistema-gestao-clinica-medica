import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { updateUserStatusValidator } from '#validators/user'
import { isUserLastActiveClinicAdmin } from '#services/clinic_membership_rules'

export default class UserStatusController {
  async updateStatus({ auth, params, request, response }: HttpContext) {
    const authenticatedUser = auth.getUserOrFail()
    const user = await User.find(params.id)

    if (!user) {
      return response.notFound({
        message: 'Usuário não encontrado',
      })
    }

    const { isActive } = await request.validateUsing(updateUserStatusValidator)

    if (!isActive && authenticatedUser.id === user.id) {
      return response.conflict({
        message: 'Você não pode inativar seu próprio usuário',
      })
    }

    if (!isActive && user.isGlobalAdmin) {
      return response.conflict({
        message: 'Um Administrador Geral não pode ser inativado por esta rota',
      })
    }

    if (!isActive && (await isUserLastActiveClinicAdmin(user.id))) {
      return response.conflict({
        message: 'O último Administrador de Consultório ativo não pode ter seu usuário inativado',
      })
    }

    user.isActive = isActive
    await user.save()

    return response.ok({
      user: user.serialize(),
    })
  }
}
