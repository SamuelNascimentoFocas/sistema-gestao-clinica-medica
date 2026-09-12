import type { HttpContext } from '@adonisjs/core/http'
import UserClinicRole from '#models/user_clinic_role'
import UserInvitationService from '#services/user_invitation_service'
import { createClinicUserInvitationValidator } from '#validators/user_invitation'

export default class ClinicMemberInvitationsController {
  async store({ auth, clinicAuthorization, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({ message: 'Contexto de autorização não inicializado' })
    }

    const payload = await request.validateUsing(createClinicUserInvitationValidator)
    const actor = auth.getUserOrFail()
    const result = await new UserInvitationService().createClinicInvitation({
      fullName: payload.fullName,
      email: payload.email,
      clinicId: clinicAuthorization.clinic.id,
      roleId: payload.roleId,
      actorUserId: actor.id,
      actor: {
        isGlobalAdmin: actor.isGlobalAdmin,
        permissionCodes: clinicAuthorization.permissionCodes,
      },
    })
    return response.created(result)
  }

  async resend({ auth, clinicAuthorization, params, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({ message: 'Contexto de autorização não inicializado' })
    }

    const membership = await UserClinicRole.query()
      .where('id', params.membershipId)
      .where('clinic_id', clinicAuthorization.clinic.id)
      .first()

    if (!membership) {
      return response.notFound({ message: 'Vínculo não encontrado' })
    }

    const result = await new UserInvitationService().resend({
      userId: membership.userId,
      actorUserId: auth.getUserOrFail().id,
    })
    return response.ok(result)
  }
}
