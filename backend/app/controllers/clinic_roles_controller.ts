import type { HttpContext } from '@adonisjs/core/http'
import {
  createCustomRole,
  listManagedClinicRoles,
  showClinicRole,
  updateCustomRole,
} from '#services/custom_role_service'
import { createCustomRoleValidator, updateCustomRoleValidator } from '#validators/custom_role'

function authorizationContext({
  auth,
  clinicAuthorization,
  response,
}: Pick<HttpContext, 'auth' | 'clinicAuthorization' | 'response'>) {
  if (!clinicAuthorization) {
    response.internalServerError({
      message: 'Contexto de autorização não inicializado',
    })
    return null
  }

  return {
    clinicId: clinicAuthorization.clinic.id,
    actor: {
      isGlobalAdmin: auth.getUserOrFail().isGlobalAdmin,
      permissionCodes: clinicAuthorization.permissionCodes,
    },
  }
}

export default class ClinicRolesController {
  async index({ auth, clinicAuthorization, response }: HttpContext) {
    const context = authorizationContext({ auth, clinicAuthorization, response })
    if (!context) return

    const roles = await listManagedClinicRoles(context.clinicId)
    return response.ok({ data: roles.map((role) => role.serialize()) })
  }

  async store({ auth, clinicAuthorization, request, response }: HttpContext) {
    const context = authorizationContext({ auth, clinicAuthorization, response })
    if (!context) return

    const payload = await request.validateUsing(createCustomRoleValidator)
    const role = await createCustomRole({ ...context, payload })
    return response.created({ role: role.serialize() })
  }

  async show({ auth, clinicAuthorization, params, response }: HttpContext) {
    const context = authorizationContext({ auth, clinicAuthorization, response })
    if (!context) return

    const role = await showClinicRole(context.clinicId, params.roleId)
    return response.ok({ role: role.serialize() })
  }

  async update({ auth, clinicAuthorization, params, request, response }: HttpContext) {
    const context = authorizationContext({ auth, clinicAuthorization, response })
    if (!context) return

    const payload = await request.validateUsing(updateCustomRoleValidator)
    const role = await updateCustomRole({
      ...context,
      roleId: params.roleId,
      payload,
    })
    return response.ok({ role: role.serialize() })
  }
}
