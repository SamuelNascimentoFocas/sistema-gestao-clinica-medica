import type { HttpContext } from '@adonisjs/core/http'
import UserInvitationService from '#services/user_invitation_service'
import { createGlobalUserInvitationValidator } from '#validators/user_invitation'

export default class UserInvitationsController {
  async store({ auth, request, response }: HttpContext) {
    const payload = await request.validateUsing(createGlobalUserInvitationValidator)
    const result = await new UserInvitationService().createGlobalInvitation({
      fullName: payload.fullName,
      email: payload.email,
      memberships: payload.memberships ?? [],
      actorUserId: auth.getUserOrFail().id,
    })
    return response.created(result)
  }

  async resend({ auth, params, response }: HttpContext) {
    const result = await new UserInvitationService().resend({
      userId: params.userId,
      actorUserId: auth.getUserOrFail().id,
    })
    return response.ok(result)
  }
}
