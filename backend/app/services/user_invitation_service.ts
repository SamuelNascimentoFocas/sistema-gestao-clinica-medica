import { createHash, randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'
import { Exception } from '@adonisjs/core/exceptions'
import logger from '@adonisjs/core/services/logger'
import mail from '@adonisjs/mail/services/main'
import db from '@adonisjs/lucid/services/db'
import Clinic from '#models/clinic'
import User from '#models/user'
import UserClinicRole from '#models/user_clinic_role'
import UserInvitationToken from '#models/user_invitation_token'
import invitationConfig from '#config/invitation'
import { getUniqueConstraint } from '#services/postgres_error'
import { resolveRoleForAssignment, type RoleGrantActor } from '#services/role_grant_service'
import { assertPasswordWithinBcryptLimit } from '#validators/user_invitation'
import { serializeUserOnboardingStatus } from '#services/user_onboarding_status_service'

const INVALID_INVITATION_MESSAGE = 'Convite inválido ou indisponível'

type MembershipInput = {
  clinicId: string
  roleId: string
}

type PreparedInvitation = {
  invitationId: string
  rawToken: string
  userId: string
  email: string
  fullName: string
}

function digestToken(rawToken: string) {
  return createHash('sha256').update(rawToken).digest('hex')
}

function invalidInvitation(): never {
  throw new Exception(INVALID_INVITATION_MESSAGE, {
    status: 422,
    code: 'E_INVITATION_INVALID',
  })
}

function isInvitationUsable(invitation: UserInvitationToken, user: User, now = DateTime.utc()) {
  return (
    user.isActive &&
    user.passwordHash === null &&
    invitation.consumedAt === null &&
    invitation.revokedAt === null &&
    invitation.expiresAt > now
  )
}

function safeResult(user: User, invitation: UserInvitationToken) {
  return {
    user: serializeUserOnboardingStatus(user, invitation),
  }
}

async function createInvitationRecord(
  user: User,
  createdByUserId: string,
  transaction: Parameters<UserInvitationToken['useTransaction']>[0]
) {
  const rawToken = randomBytes(32).toString('base64url')
  const invitation = new UserInvitationToken()
  invitation.userId = user.id
  invitation.tokenDigest = digestToken(rawToken)
  invitation.expiresAt = DateTime.utc().plus({ hours: invitationConfig.tokenTtlHours })
  invitation.consumedAt = null
  invitation.revokedAt = null
  invitation.sentAt = null
  invitation.createdByUserId = createdByUserId
  invitation.useTransaction(transaction)
  await invitation.save()

  return { invitation, rawToken }
}

async function dispatchInvitation(prepared: PreparedInvitation) {
  const link = `${invitationConfig.frontendUrl}/accept-invitation#token=${prepared.rawToken}`

  await mail.send((message) => {
    message
      .to(prepared.email, prepared.fullName)
      .subject('Defina sua senha de acesso')
      .text(
        `Você recebeu um convite para acessar o Sistema de Gestão de Clínica Médica.\n\nDefina sua senha em: ${link}\n\nEste link expira em 24 horas.`
      )
  })
}

async function loadInvitationResult(userId: string, invitationId: string) {
  const user = await User.findOrFail(userId)
  const invitation = await UserInvitationToken.findOrFail(invitationId)
  return safeResult(user, invitation)
}

async function assertEmailAvailable(emailNormalized: string) {
  const existing = await User.query().where('email_normalized', emailNormalized).first()

  if (!existing) return

  if (existing.passwordHash === null && existing.isActive) {
    throw new Exception('Este usuário já foi convidado. Use o reenvio de convite.', {
      status: 409,
      code: 'E_INVITATION_ALREADY_EXISTS',
    })
  }

  throw new Exception('Já existe um usuário cadastrado com este e-mail', {
    status: 409,
    code: 'E_USER_EMAIL_EXISTS',
  })
}

async function resolveMemberships(memberships: MembershipInput[], actor: RoleGrantActor) {
  const resolved = []

  for (const membership of memberships) {
    const clinic = await Clinic.find(membership.clinicId)
    if (!clinic) {
      throw new Exception('Consultório não encontrado', { status: 404 })
    }
    if (!clinic.isActive) {
      throw new Exception('Não é possível vincular um consultório inativo', { status: 409 })
    }

    const role = await resolveRoleForAssignment({
      clinicId: clinic.id,
      roleId: membership.roleId,
      actor,
    })
    resolved.push({ clinicId: clinic.id, roleId: role.id })
  }

  return resolved
}

async function createInvitedUser({
  fullName,
  email,
  memberships,
  createdByUserId,
}: {
  fullName: string
  email: string
  memberships: MembershipInput[]
  createdByUserId: string
}) {
  const emailNormalized = email.toLowerCase()
  await assertEmailAvailable(emailNormalized)

  try {
    return await db.transaction(async (trx) => {
      const user = new User()
      user.fullName = fullName
      user.email = email
      user.emailNormalized = emailNormalized
      user.isGlobalAdmin = false
      user.isActive = true
      user.useTransaction(trx)
      await user.save()

      for (const input of memberships) {
        const membership = new UserClinicRole()
        membership.userId = user.id
        membership.clinicId = input.clinicId
        membership.roleId = input.roleId
        membership.isActive = true
        membership.useTransaction(trx)
        await membership.save()
      }

      const { invitation, rawToken } = await createInvitationRecord(user, createdByUserId, trx)
      return {
        invitation,
        prepared: {
          invitationId: invitation.id,
          rawToken,
          userId: user.id,
          email: user.email,
          fullName: user.fullName,
        },
      }
    })
  } catch (error) {
    const constraint = getUniqueConstraint(error)
    if (constraint === 'users_email_normalized_unique') {
      throw new Exception('Já existe um usuário cadastrado com este e-mail', {
        status: 409,
        code: 'E_USER_EMAIL_EXISTS',
      })
    }
    throw error
  }
}

export default class UserInvitationService {
  constructor(private readonly dispatch = dispatchInvitation) {}

  private async sendPrepared(prepared: PreparedInvitation) {
    try {
      await this.dispatch(prepared)
    } catch {
      logger.error(
        { event: 'INVITATION_DISPATCH_FAILED', invitationId: prepared.invitationId },
        'Invitation email dispatch failed'
      )
      throw new Exception('Não foi possível enviar o convite. Tente reenviar mais tarde.', {
        status: 503,
        code: 'E_INVITATION_MAIL_FAILED',
      })
    }

    await UserInvitationToken.query()
      .where('id', prepared.invitationId)
      .whereNull('consumed_at')
      .whereNull('revoked_at')
      .update({ sentAt: DateTime.utc() })
  }

  async createGlobalInvitation({
    fullName,
    email,
    memberships,
    actorUserId,
  }: {
    fullName: string
    email: string
    memberships: MembershipInput[]
    actorUserId: string
  }) {
    const resolvedMemberships = await resolveMemberships(memberships, {
      isGlobalAdmin: true,
      permissionCodes: ['*'],
    })
    const result = await createInvitedUser({
      fullName,
      email,
      memberships: resolvedMemberships,
      createdByUserId: actorUserId,
    })
    await this.sendPrepared(result.prepared)
    logger.info(
      { event: 'USER_INVITED', userId: result.prepared.userId, invitationId: result.invitation.id },
      'User invitation created'
    )
    return loadInvitationResult(result.prepared.userId, result.invitation.id)
  }

  async createClinicInvitation({
    fullName,
    email,
    clinicId,
    roleId,
    actorUserId,
    actor,
  }: {
    fullName: string
    email: string
    clinicId: string
    roleId: string
    actorUserId: string
    actor: RoleGrantActor
  }) {
    const resolvedMemberships = await resolveMemberships([{ clinicId, roleId }], actor)
    const result = await createInvitedUser({
      fullName,
      email,
      memberships: resolvedMemberships,
      createdByUserId: actorUserId,
    })
    await this.sendPrepared(result.prepared)
    logger.info(
      {
        event: 'USER_INVITED',
        userId: result.prepared.userId,
        invitationId: result.invitation.id,
        clinicId,
      },
      'Clinic user invitation created'
    )
    return loadInvitationResult(result.prepared.userId, result.invitation.id)
  }

  async resend({ userId, actorUserId }: { userId: string; actorUserId: string }) {
    const result = await db.transaction(async (trx) => {
      const user = await User.query({ client: trx }).where('id', userId).forUpdate().first()

      if (!user) {
        throw new Exception('Usuário não encontrado', { status: 404 })
      }
      if (!user.isActive) {
        throw new Exception('Reative o usuário antes de reenviar o convite', { status: 409 })
      }
      if (user.passwordHash !== null) {
        throw new Exception('Este usuário já possui senha configurada', { status: 409 })
      }

      await UserInvitationToken.query({ client: trx })
        .where('user_id', user.id)
        .whereNull('consumed_at')
        .whereNull('revoked_at')
        .update({ revokedAt: DateTime.utc() })

      const { invitation, rawToken } = await createInvitationRecord(user, actorUserId, trx)
      return {
        invitation,
        prepared: {
          invitationId: invitation.id,
          rawToken,
          userId: user.id,
          email: user.email,
          fullName: user.fullName,
        },
      }
    })

    await this.sendPrepared(result.prepared)
    logger.info(
      { event: 'INVITATION_RESENT', userId, invitationId: result.invitation.id },
      'User invitation resent'
    )
    return loadInvitationResult(userId, result.invitation.id)
  }

  async validate(rawToken: string) {
    const invitation = await UserInvitationToken.query()
      .where('token_digest', digestToken(rawToken))
      .preload('user')
      .first()

    if (!invitation || !isInvitationUsable(invitation, invitation.user)) {
      invalidInvitation()
    }

    return { valid: true }
  }

  async accept({ rawToken, password }: { rawToken: string; password: string }) {
    try {
      assertPasswordWithinBcryptLimit(password)
    } catch {
      throw new Exception('A senha deve possuir no máximo 72 bytes', {
        status: 422,
        code: 'E_PASSWORD_TOO_LONG',
      })
    }
    const digest = digestToken(rawToken)
    const candidate = await UserInvitationToken.query().where('token_digest', digest).first()

    if (!candidate) invalidInvitation()

    const accepted = await db.transaction(async (trx) => {
      const user = await User.query({ client: trx })
        .where('id', candidate.userId)
        .forUpdate()
        .first()
      const invitation = await UserInvitationToken.query({ client: trx })
        .where('id', candidate.id)
        .where('token_digest', digest)
        .forUpdate()
        .first()

      if (!user || !invitation || !isInvitationUsable(invitation, user)) {
        invalidInvitation()
      }

      user.passwordHash = password
      user.useTransaction(trx)
      await user.save()

      invitation.consumedAt = DateTime.utc()
      invitation.useTransaction(trx)
      await invitation.save()

      await UserInvitationToken.query({ client: trx })
        .where('user_id', user.id)
        .whereNot('id', invitation.id)
        .whereNull('consumed_at')
        .whereNull('revoked_at')
        .update({ revokedAt: DateTime.utc() })

      return { userId: user.id, invitationId: invitation.id }
    })

    logger.info({ event: 'INVITATION_ACCEPTED', ...accepted }, 'User invitation accepted')
    return { message: 'Convite aceito. Acesse o sistema pela tela de login.' }
  }
}
