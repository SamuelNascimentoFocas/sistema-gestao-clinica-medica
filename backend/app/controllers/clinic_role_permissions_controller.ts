import type { HttpContext } from '@adonisjs/core/http'
import { listCustomRoleAssignablePermissions } from '#services/custom_role_service'

export default class ClinicRolePermissionsController {
  async index({ response }: HttpContext) {
    const permissions = await listCustomRoleAssignablePermissions()
    return response.ok({ data: permissions.map((permission) => permission.serialize()) })
  }
}
