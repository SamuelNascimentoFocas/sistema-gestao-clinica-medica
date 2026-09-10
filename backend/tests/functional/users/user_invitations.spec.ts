import hash from '@adonisjs/core/services/hash'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import { UserFactory } from '#database/factories/user_factory'
import { ClinicFactory } from '#database/factories/clinic_factory'
import Role from '#models/role'
import User from '#models/user'
import UserClinicRole from '#models/user_clinic_role'
import UserInvitationToken from '#models/user_invitation_token'
import UserInvitationService from '#services/user_invitation_service'
import { createBearerToken } from '#tests/helpers/auth'
import { createMembership } from '#tests/helpers/membership'
import { truncateClinicSchemaTables } from '../../helpers/database.js'
import { seedAuthorizationCatalog } from '../../../database/seeders/authorization_catalog_seeder.js'

let fakeMailer: ReturnType<typeof mail.fake>

function tokenFromLastMessage() {
  const messages = fakeMailer.messages.sent()
  const contents = String(messages.at(-1)?.toObject().message.text ?? '')
  const match = contents.match(/#token=([A-Za-z0-9_-]+)/)

  if (!match) {
    throw new Error('Invitation token was not found in the fake email')
  }

  return match[1]
}

test.group('User invitation lifecycle', (group) => {
  group.each.setup(async () => {
    await truncateClinicSchemaTables()
    await seedAuthorizationCatalog()
    fakeMailer = mail.fake()

    return async () => {
      mail.restore()
      await truncateClinicSchemaTables()
    }
  })

  test('global admin invites, validates, and accepts a passwordless user safely', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('globalAdmin').create()
    const adminToken = await createBearerToken(admin)
    const createResponse = await client
      .post('/api/v1/users/invitations')
      .header('Authorization', `Bearer ${adminToken}`)
      .json({ fullName: 'Pessoa Convidada', email: 'invited@example.com' })

    createResponse.assertStatus(201)
    assert.isFalse(createResponse.body().user.passwordConfigured)
    assert.equal(createResponse.body().user.invitationStatus, 'sent')
    assert.isNotNull(createResponse.body().user.invitationSentAt)
    assert.isNotNull(createResponse.body().user.invitationExpiresAt)
    assert.notProperty(createResponse.body(), 'token')
    assert.notProperty(createResponse.body().user, 'tokenDigest')

    const user = await User.findByOrFail('email_normalized', 'invited@example.com')
    const invitation = await UserInvitationToken.findByOrFail('user_id', user.id)
    const rawToken = tokenFromLastMessage()

    assert.isNull(user.passwordHash)
    assert.lengthOf(invitation.tokenDigest, 64)
    assert.notEqual(invitation.tokenDigest, rawToken)
    assert.isNotNull(invitation.sentAt)

    const loginBeforeAccept = await client.post('/api/v1/auth/login').json({
      email: user.email,
      password: 'InitialPassword!123',
    })
    loginBeforeAccept.assertStatus(400)

    const firstValidation = await client
      .post('/api/v1/invitations/validate')
      .json({ token: rawToken })
    firstValidation.assertStatus(200)
    firstValidation.assertBody({ valid: true })

    const secondValidation = await client
      .post('/api/v1/invitations/validate')
      .json({ token: rawToken })
    secondValidation.assertStatus(200)

    await invitation.refresh()
    assert.isNull(invitation.consumedAt)

    const password = 'AcceptedPassword!123'
    const acceptResponse = await client.post('/api/v1/invitations/accept').json({
      token: rawToken,
      password,
      passwordConfirmation: password,
    })
    acceptResponse.assertStatus(200)
    assert.notProperty(acceptResponse.body(), 'token')
    assert.notProperty(acceptResponse.body(), 'password')

    await user.refresh()
    await invitation.refresh()
    assert.isNotNull(user.passwordHash)
    assert.isTrue(await hash.use('bcrypt').verify(user.passwordHash!, password))
    assert.isNotNull(invitation.consumedAt)

    const secondAccept = await client.post('/api/v1/invitations/accept').json({
      token: rawToken,
      password,
      passwordConfirmation: password,
    })
    secondAccept.assertStatus(422)

    const loginAfterAccept = await client.post('/api/v1/auth/login').json({
      email: user.email,
      password,
    })
    loginAfterAccept.assertStatus(200)
  })

  test('keeps invitation creation separate from administrative password input', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('globalAdmin').create()
    const token = await createBearerToken(admin)

    const response = await client
      .post('/api/v1/users/invitations')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Payload Ambíguo',
        email: 'ambiguous@example.com',
        password: 'MustNotBeAccepted!123',
      })

    response.assertStatus(422)
    assert.isNull(await User.findBy('email_normalized', 'ambiguous@example.com'))
  })

  test('enforces invitation table terminal and single-pending constraints', async ({ assert }) => {
    const creator = await UserFactory.apply('globalAdmin').create()
    const invited = new User()
    invited.fullName = 'Modelo sem Senha'
    invited.email = 'schema.invited@example.com'
    invited.emailNormalized = invited.email
    invited.isGlobalAdmin = false
    invited.isActive = true
    await invited.save()

    const invitation = await UserInvitationToken.create({
      userId: invited.id,
      tokenDigest: 'a'.repeat(64),
      expiresAt: DateTime.utc().plus({ hour: 1 }),
      consumedAt: null,
      revokedAt: null,
      sentAt: null,
      createdByUserId: creator.id,
    })
    assert.notProperty(invitation.serialize(), 'tokenDigest')

    await assert.rejects(() =>
      UserInvitationToken.create({
        userId: invited.id,
        tokenDigest: 'b'.repeat(64),
        expiresAt: DateTime.utc().plus({ hour: 1 }),
        consumedAt: null,
        revokedAt: null,
        sentAt: null,
        createdByUserId: creator.id,
      })
    )

    invitation.consumedAt = DateTime.utc()
    invitation.revokedAt = DateTime.utc()
    await assert.rejects(() => invitation.save())
  })

  test('does not duplicate existing users in any invitation state', async ({ client }) => {
    const admin = await UserFactory.apply('globalAdmin').create()
    const token = await createBearerToken(admin)
    const configured = await UserFactory.merge({ email: 'configured@example.com' }).create()
    const passwordless = new User()
    passwordless.fullName = 'Convite Existente'
    passwordless.email = 'pending@example.com'
    passwordless.emailNormalized = passwordless.email
    passwordless.isGlobalAdmin = false
    passwordless.isActive = true
    await passwordless.save()

    for (const email of [configured.email, passwordless.email]) {
      const response = await client
        .post('/api/v1/users/invitations')
        .header('Authorization', `Bearer ${token}`)
        .json({ fullName: 'Não Duplicar', email })
      response.assertStatus(409)
    }
  })

  test('allows an authorized clinic administrator to invite with RoleGrantService scope', async ({
    client,
    assert,
  }) => {
    const clinic = await ClinicFactory.create()
    const otherClinic = await ClinicFactory.create()
    const administrator = await UserFactory.create()
    await createMembership({ user: administrator, clinic, roleCode: 'clinic_admin' })
    const receptionistRole = await Role.findByOrFail('code', 'receptionist')
    const token = await createBearerToken(administrator)

    const response = await client
      .post(`/api/v1/clinics/${clinic.id}/members/invitations`)
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Pessoa da Clínica',
        email: 'clinic.invited@example.com',
        roleId: receptionistRole.id,
      })

    response.assertStatus(201)
    const membership = await UserClinicRole.query()
      .where('user_id', response.body().user.id)
      .firstOrFail()
    assert.equal(membership.clinicId, clinic.id)
    assert.equal(membership.roleId, receptionistRole.id)

    const crossClinicResponse = await client
      .post(`/api/v1/clinics/${otherClinic.id}/members/invitations`)
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Fora do Escopo',
        email: 'cross.scope.invited@example.com',
        roleId: receptionistRole.id,
      })
    crossClinicResponse.assertStatus(403)
  })

  test('requires invitation authorization', async ({ client }) => {
    const clinic = await ClinicFactory.create()
    const receptionist = await UserFactory.create()
    await createMembership({ user: receptionist, clinic, roleCode: 'receptionist' })
    const role = await Role.findByOrFail('code', 'receptionist')
    const token = await createBearerToken(receptionist)

    const response = await client
      .post(`/api/v1/clinics/${clinic.id}/members/invitations`)
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Sem Permissão',
        email: 'forbidden.invite@example.com',
        roleId: role.id,
      })
    response.assertStatus(403)
  })

  test('resend revokes the previous token and preserves membership', async ({ client, assert }) => {
    const admin = await UserFactory.apply('globalAdmin').create()
    const token = await createBearerToken(admin)
    const clinic = await ClinicFactory.create()
    const role = await Role.findByOrFail('code', 'doctor')
    const createResponse = await client
      .post('/api/v1/users/invitations')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Reenvio Seguro',
        email: 'resend@example.com',
        memberships: [{ clinicId: clinic.id, roleId: role.id }],
      })
    createResponse.assertStatus(201)
    const firstToken = tokenFromLastMessage()
    const userId = createResponse.body().user.id
    const membershipBefore = await UserClinicRole.findByOrFail('user_id', userId)

    const resendResponse = await client
      .post(`/api/v1/users/${userId}/invitations/resend`)
      .header('Authorization', `Bearer ${token}`)
    resendResponse.assertStatus(200)
    const secondToken = tokenFromLastMessage()
    assert.notEqual(firstToken, secondToken)

    const oldValidation = await client
      .post('/api/v1/invitations/validate')
      .json({ token: firstToken })
    oldValidation.assertStatus(422)
    const newValidation = await client
      .post('/api/v1/invitations/validate')
      .json({ token: secondToken })
    newValidation.assertStatus(200)

    const pending = await UserInvitationToken.query()
      .where('user_id', userId)
      .whereNull('consumed_at')
      .whereNull('revoked_at')
    assert.lengthOf(pending, 1)
    const membershipAfter = await UserClinicRole.findByOrFail('user_id', userId)
    assert.equal(membershipAfter.id, membershipBefore.id)
    assert.equal(membershipAfter.roleId, membershipBefore.roleId)
  })

  test('uniformly rejects invalid, expired, revoked, and inactive-user invitations', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('globalAdmin').create()
    const adminToken = await createBearerToken(admin)
    const createResponse = await client
      .post('/api/v1/users/invitations')
      .header('Authorization', `Bearer ${adminToken}`)
      .json({ fullName: 'Estados do Convite', email: 'states@example.com' })
    createResponse.assertStatus(201)
    const rawToken = tokenFromLastMessage()
    const user = await User.findOrFail(createResponse.body().user.id)
    const invitation = await UserInvitationToken.findByOrFail('user_id', user.id)

    const invalid = await client
      .post('/api/v1/invitations/validate')
      .json({ token: 'invalid-token-value-that-is-long-enough-000000000' })
    invalid.assertStatus(422)

    invitation.expiresAt = DateTime.utc().minus({ minute: 1 })
    await invitation.save()
    const expired = await client.post('/api/v1/invitations/validate').json({ token: rawToken })
    expired.assertStatus(422)

    invitation.expiresAt = DateTime.utc().plus({ hour: 1 })
    invitation.revokedAt = DateTime.utc()
    await invitation.save()
    const revoked = await client.post('/api/v1/invitations/validate').json({ token: rawToken })
    revoked.assertStatus(422)

    invitation.revokedAt = null
    await invitation.save()
    user.isActive = false
    await user.save()
    const inactive = await client.post('/api/v1/invitations/validate').json({ token: rawToken })
    inactive.assertStatus(422)

    for (const response of [invalid, expired, revoked, inactive]) {
      assert.equal(response.body().message, 'Convite inválido ou indisponível')
    }
  })

  test('enforces password confirmation and the bcrypt byte limit', async ({ client }) => {
    const admin = await UserFactory.apply('globalAdmin').create()
    const adminToken = await createBearerToken(admin)
    const created = await client
      .post('/api/v1/users/invitations')
      .header('Authorization', `Bearer ${adminToken}`)
      .json({ fullName: 'Política de Senha', email: 'password.policy@example.com' })
    created.assertStatus(201)
    const rawToken = tokenFromLastMessage()

    const mismatch = await client.post('/api/v1/invitations/accept').json({
      token: rawToken,
      password: 'AcceptedPassword!123',
      passwordConfirmation: 'DifferentPassword!123',
    })
    mismatch.assertStatus(422)

    const tooManyBytes = 'á'.repeat(40)
    const oversized = await client.post('/api/v1/invitations/accept').json({
      token: rawToken,
      password: tooManyBytes,
      passwordConfirmation: tooManyBytes,
    })
    oversized.assertStatus(422)
  })

  test('allows only one concurrent accept to consume an invitation', async ({ client, assert }) => {
    const admin = await UserFactory.apply('globalAdmin').create()
    const adminToken = await createBearerToken(admin)
    const createResponse = await client
      .post('/api/v1/users/invitations')
      .header('Authorization', `Bearer ${adminToken}`)
      .json({ fullName: 'Aceite Concorrente', email: 'concurrent.accept@example.com' })
    createResponse.assertStatus(201)
    const rawToken = tokenFromLastMessage()
    const payload = {
      token: rawToken,
      password: 'ConcurrentPassword!123',
      passwordConfirmation: 'ConcurrentPassword!123',
    }

    const responses = await Promise.all([
      client.post('/api/v1/invitations/accept').json(payload),
      client.post('/api/v1/invitations/accept').json(payload),
    ])
    assert.deepEqual(responses.map((response) => response.status()).sort(), [200, 422])
  })

  test('serializes concurrent resends and leaves exactly one pending token', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('globalAdmin').create()
    const adminToken = await createBearerToken(admin)
    const created = await client
      .post('/api/v1/users/invitations')
      .header('Authorization', `Bearer ${adminToken}`)
      .json({ fullName: 'Reenvios Concorrentes', email: 'concurrent.resend@example.com' })
    created.assertStatus(201)

    const resend = () =>
      client
        .post(`/api/v1/users/${created.body().user.id}/invitations/resend`)
        .header('Authorization', `Bearer ${adminToken}`)
    const responses = await Promise.all([resend(), resend()])
    assert.deepEqual(
      responses.map((response) => response.status()),
      [200, 200]
    )

    const pending = await UserInvitationToken.query()
      .where('user_id', created.body().user.id)
      .whereNull('consumed_at')
      .whereNull('revoked_at')
    assert.lengthOf(pending, 1)
  })

  test('keeps resend and accept race in one safe terminal state', async ({ client, assert }) => {
    const admin = await UserFactory.apply('globalAdmin').create()
    const adminToken = await createBearerToken(admin)
    const created = await client
      .post('/api/v1/users/invitations')
      .header('Authorization', `Bearer ${adminToken}`)
      .json({ fullName: 'Corrida de Convite', email: 'resend.accept.race@example.com' })
    created.assertStatus(201)
    const originalToken = tokenFromLastMessage()

    const [acceptResponse, resendResponse] = await Promise.all([
      client.post('/api/v1/invitations/accept').json({
        token: originalToken,
        password: 'ConcurrentPassword!123',
        passwordConfirmation: 'ConcurrentPassword!123',
      }),
      client
        .post(`/api/v1/users/${created.body().user.id}/invitations/resend`)
        .header('Authorization', `Bearer ${adminToken}`),
    ])

    assert.equal(
      [acceptResponse, resendResponse].filter((response) => response.status() === 200).length,
      1
    )
    const user = await User.findOrFail(created.body().user.id)
    const pending = await UserInvitationToken.query()
      .where('user_id', user.id)
      .whereNull('consumed_at')
      .whereNull('revoked_at')
    assert.isTrue(
      (user.passwordHash !== null && pending.length === 0) ||
        (user.passwordHash === null && pending.length === 1)
    )
  })

  test('prevents duplicate users during concurrent invitation creation', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('globalAdmin').create()
    const adminToken = await createBearerToken(admin)
    const invite = () =>
      client
        .post('/api/v1/users/invitations')
        .header('Authorization', `Bearer ${adminToken}`)
        .json({ fullName: 'E-mail Concorrente', email: 'duplicate.concurrent@example.com' })

    const responses = await Promise.all([invite(), invite()])
    assert.deepEqual(responses.map((response) => response.status()).sort(), [201, 409])
    assert.lengthOf(
      await User.query().where('email_normalized', 'duplicate.concurrent@example.com'),
      1
    )
  })

  test('keeps committed invitation state recoverable when mail dispatch fails', async ({
    assert,
  }) => {
    const admin = await UserFactory.apply('globalAdmin').create()
    const service = new UserInvitationService(async () => {
      throw new Error('simulated transport failure')
    })

    await assert.rejects(() =>
      service.createGlobalInvitation({
        fullName: 'Falha Recuperável',
        email: 'mail.failure@example.com',
        memberships: [],
        actorUserId: admin.id,
      })
    )

    const user = await User.findByOrFail('email_normalized', 'mail.failure@example.com')
    const invitation = await UserInvitationToken.findByOrFail('user_id', user.id)
    assert.isNull(user.passwordHash)
    assert.isNull(invitation.sentAt)
    assert.isNull(invitation.consumedAt)
    assert.isNull(invitation.revokedAt)
  })
})
