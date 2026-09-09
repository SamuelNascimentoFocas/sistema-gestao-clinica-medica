import type { HttpContext } from '@adonisjs/core/http'
import { listAssignableClinicRoles } from '#services/custom_role_service'

export default class AssignableClinicRolesController {
  async index({ auth, clinicAuthorization, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const roles = await listAssignableClinicRoles({
      clinicId: clinicAuthorization.clinic.id,
      actor: {
        isGlobalAdmin: auth.getUserOrFail().isGlobalAdmin,
        permissionCodes: clinicAuthorization.permissionCodes,
      },
    })

    return response.ok({ data: roles.map((role) => role.serialize()) })
  }
}
