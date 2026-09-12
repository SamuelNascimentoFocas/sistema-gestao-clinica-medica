import type { HttpContext } from '@adonisjs/core/http'
import UserInvitationService from '#services/user_invitation_service'
import { acceptInvitationValidator, invitationTokenValidator } from '#validators/user_invitation'

export default class InvitationsController {
  async validate({ request, response }: HttpContext) {
    const payload = await request.validateUsing(invitationTokenValidator)
    const result = await new UserInvitationService().validate(payload.token)
    return response.ok(result)
  }

  async accept({ request, response }: HttpContext) {
    const payload = await request.validateUsing(acceptInvitationValidator)
    const result = await new UserInvitationService().accept({
      rawToken: payload.token,
      password: payload.password,
    })
    return response.ok(result)
  }
}
