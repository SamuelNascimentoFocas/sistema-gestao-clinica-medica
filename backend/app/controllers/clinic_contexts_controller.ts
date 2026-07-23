import type { HttpContext } from '@adonisjs/core/http'
import UserClinicRole from '#models/user_clinic_role'

export default class ClinicContextsController {
  async show({ clinicAuthorization, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const { clinic, membership, permissionCodes } = clinicAuthorization

    return response.ok({
      clinic: clinic.serialize(),
      access: {
        scope: membership ? 'clinic' : 'global',
        membershipId: membership?.id ?? null,
        role: membership
          ? {
              id: membership.role.id,
              code: membership.role.code,
              name: membership.role.name,
            }
          : null,
        permissions: permissionCodes,
      },
    })
  }

  async members({ clinicAuthorization, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const memberships = await UserClinicRole.query()
      .where('clinic_id', clinicAuthorization.clinic.id)
      .preload('user')
      .preload('role')
      .orderBy('created_at', 'asc')

    return response.ok({
      data: memberships.map((membership) => membership.serialize()),
    })
  }
}
