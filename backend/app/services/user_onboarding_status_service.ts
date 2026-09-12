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

export async function serializeUsersOnboardingStatusById(users: User[]) {
  const userIds = [...new Set(users.map((user) => user.id))]
  const invitations = userIds.length
    ? await UserInvitationToken.query()
        .select(['user_id', 'expires_at', 'consumed_at', 'revoked_at', 'sent_at'])
        .whereIn('user_id', userIds)
        .orderBy('created_at', 'desc')
    : []
  const latestByUser = new Map<string, UserInvitationToken>()

  for (const invitation of invitations) {
    if (!latestByUser.has(invitation.userId)) {
      latestByUser.set(invitation.userId, invitation)
    }
  }

  return new Map(
    users.map((user) => [user.id, serializeUserOnboardingStatus(user, latestByUser.get(user.id))])
  )
}

export async function serializeUsersOnboardingStatus(users: User[]) {
  const usersById = await serializeUsersOnboardingStatusById(users)

  return users.map((user) => usersById.get(user.id)!)
}

export async function serializeUserWithLatestOnboardingStatus(user: User) {
  const usersById = await serializeUsersOnboardingStatusById([user])

  return usersById.get(user.id)!
}
