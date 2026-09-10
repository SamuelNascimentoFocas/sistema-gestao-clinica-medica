import type { HttpContext } from '@adonisjs/core/http'
import { listClinicMembersValidator } from '#validators/clinic_member'
import { listClinicMembers } from '#services/clinic_member_query_service'
import { serializeUsersOnboardingStatusById } from '#services/user_onboarding_status_service'

export default class ClinicMembersController {
  async index({ clinicAuthorization, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const filters = await listClinicMembersValidator.validate(request.qs())
    const memberships = await listClinicMembers(clinicAuthorization.clinic.id, filters)
    const currentMemberships = memberships.all()
    const usersById = await serializeUsersOnboardingStatusById(
      currentMemberships.map((membership) => membership.user)
    )

    return response.ok({
      data: currentMemberships.map((membership) => ({
        ...membership.serialize(),
        user: usersById.get(membership.userId)!,
      })),
      meta: memberships.getMeta(),
    })
  }
}
