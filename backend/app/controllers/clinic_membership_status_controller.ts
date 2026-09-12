import type { HttpContext } from '@adonisjs/core/http'
import UserClinicRole from '#models/user_clinic_role'
import { updateClinicMembershipStatusValidator } from '#validators/clinic_membership'
import { isLastActiveClinicAdmin } from '#services/clinic_membership_rules'

export default class ClinicMembershipStatusController {
  async updateStatus({ params, request, response }: HttpContext) {
    const membership = await UserClinicRole.query()
      .where('id', params.id)
      .preload('user')
      .preload('clinic')
      .preload('role')
      .first()

    if (!membership) {
      return response.notFound({
        message: 'Vínculo não encontrado',
      })
    }

    const { isActive } = await request.validateUsing(updateClinicMembershipStatusValidator)

    if (
      !isActive &&
      membership.isActive &&
      membership.role.code === 'clinic_admin' &&
      (await isLastActiveClinicAdmin(membership))
    ) {
      return response.conflict({
        message: 'O último Administrador de Consultório ativo não pode ser inativado',
      })
    }

    if (isActive) {
      if (membership.user.isGlobalAdmin) {
        return response.conflict({
          message: 'O Administrador Geral não necessita de vínculo com consultório',
        })
      }

      if (!membership.user.isActive) {
        return response.conflict({
          message: 'Não é possível ativar o vínculo de um usuário inativo',
        })
      }

      if (!membership.clinic.isActive) {
        return response.conflict({
          message: 'Não é possível ativar o vínculo com um consultório inativo',
        })
      }

      if (!membership.role.isActive) {
        return response.conflict({
          message: 'Não é possível ativar um vínculo com perfil inativo',
        })
      }
    }

    membership.isActive = isActive
    await membership.save()

    return response.ok({
      membership: membership.serialize(),
    })
  }
}
