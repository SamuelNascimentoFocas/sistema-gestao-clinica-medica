import type { HttpContext } from '@adonisjs/core/http'
import { updateCustomRoleStatus } from '#services/custom_role_service'
import { updateCustomRoleStatusValidator } from '#validators/custom_role'

export default class ClinicRoleStatusController {
  async updateStatus({ auth, clinicAuthorization, params, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const { isActive } = await request.validateUsing(updateCustomRoleStatusValidator)
    const role = await updateCustomRoleStatus({
      clinicId: clinicAuthorization.clinic.id,
      roleId: params.roleId,
      isActive,
      actor: {
        isGlobalAdmin: auth.getUserOrFail().isGlobalAdmin,
        permissionCodes: clinicAuthorization.permissionCodes,
      },
    })

    return response.ok({ role: role.serialize() })
  }
}
