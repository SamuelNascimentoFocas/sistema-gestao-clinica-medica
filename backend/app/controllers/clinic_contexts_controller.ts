import type { HttpContext } from '@adonisjs/core/http'

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
}
