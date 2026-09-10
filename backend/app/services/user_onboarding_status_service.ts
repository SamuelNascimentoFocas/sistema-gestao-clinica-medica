import { DateTime } from 'luxon'
import User from '#models/user'
import UserInvitationToken from '#models/user_invitation_token'

function invitationStatus(invitation: UserInvitationToken | undefined, now = DateTime.utc()) {
  if (!invitation) return 'not_invited'
  if (invitation.consumedAt) return 'accepted'
  if (invitation.revokedAt) return 'revoked'
  if (invitation.expiresAt <= now) return 'expired'
  return invitation.sentAt ? 'sent' : 'pending_dispatch'
}

export function serializeUserOnboardingStatus(user: User, invitation?: UserInvitationToken) {
  return {
    ...user.serialize(),
    passwordConfigured: user.passwordHash !== null,
    invitationStatus: invitationStatus(invitation),
    invitationSentAt: invitation?.sentAt?.toISO() ?? null,
    invitationExpiresAt: invitation?.expiresAt.toISO() ?? null,
  }
}

export async function serializeUsersOnboardingStatus(users: User[]) {
  const invitations = users.length
    ? await UserInvitationToken.query()
        .whereIn(
          'user_id',
          users.map((user) => user.id)
        )
        .orderBy('created_at', 'desc')
    : []
  const latestByUser = new Map<string, UserInvitationToken>()

  for (const invitation of invitations) {
    if (!latestByUser.has(invitation.userId)) {
      latestByUser.set(invitation.userId, invitation)
    }
  }

  return users.map((user) => serializeUserOnboardingStatus(user, latestByUser.get(user.id)))
}

export async function serializeUserWithLatestOnboardingStatus(user: User) {
  const invitation = await UserInvitationToken.query()
    .where('user_id', user.id)
    .orderBy('created_at', 'desc')
    .first()
  return serializeUserOnboardingStatus(user, invitation ?? undefined)
}
