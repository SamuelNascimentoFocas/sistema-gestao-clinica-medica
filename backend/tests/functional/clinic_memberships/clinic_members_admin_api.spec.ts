import { UserFactory } from '#database/factories/user_factory'
import { ClinicFactory } from '#database/factories/clinic_factory'
import { UserClinicRoleFactory } from '#database/factories/user_clinic_role_factory'
import mail from '@adonisjs/mail/services/main'
import Role from '#models/role'
import UserClinicRole from '#models/user_clinic_role'
import UserInvitationToken from '#models/user_invitation_token'
import { createBearerToken as createToken } from '#tests/helpers/auth'
import { createMembership } from '#tests/helpers/membership'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { truncateClinicSchemaTables } from '../../helpers/database.js'
import { seedAuthorizationCatalog } from '../../../database/seeders/authorization_catalog_seeder.js'

test.group('Clinic-scoped member administration', (group) => {
  group.each.setup(async () => {
    await truncateClinicSchemaTables()
    await seedAuthorizationCatalog()
    mail.fake()

    return async () => {
      mail.restore()
      await truncateClinicSchemaTables()
    }
  })

  test('allows a clinic administrator to invite a local user and create a membership', async ({
    client,
    assert,
  }) => {
    const clinic = await ClinicFactory.merge({ name: 'Clínica Administrada' }).create()
    const administrator = await UserFactory.merge({
      fullName: 'Usuário Administrativo',
      email: 'clinic.admin@example.com',
    }).create()

    await createMembership({
      user: administrator,
      clinic,
      roleCode: 'clinic_admin',
    })
    const receptionistRole = await Role.findByOrFail('code', 'receptionist')

    const token = await createToken(administrator)

    const response = await client
      .post(`/api/v1/clinics/${clinic.id}/members/invitations`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Recepcionista Local',
        email: 'local.receptionist@example.com',
        roleId: receptionistRole.id,
      })

    response.assertStatus(201)

    const user = response.body().user
    const membership = await UserClinicRole.query().where('user_id', user.id).firstOrFail()
    await membership.load('user')
    await membership.load('role')
    await membership.load('clinic')

    assert.equal(membership.clinic.id, clinic.id)
    assert.equal(membership.user.email, 'local.receptionist@example.com')
    assert.equal(membership.role.code, 'receptionist')
    assert.isTrue(membership.isActive)
    assert.isFalse(user.passwordConfigured)
    assert.equal(user.invitationStatus, 'sent')
    assert.isUndefined(user.passwordHash)
    assert.isUndefined(user.emailNormalized)

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: 'LOCAL.RECEPTIONIST@example.com',
      password: 'InitialPassword!123',
    })

    loginResponse.assertStatus(400)
  })

  test('uses clinic member pagination defaults and preserves the item contract', async ({
    client,
    assert,
  }) => {
    const clinic = await ClinicFactory.merge({ name: 'Clínica de Contrato' }).create()
    const administrator = await UserFactory.merge({
      fullName: 'Administrador do Contrato',
      email: 'members.contract.admin@example.com',
    }).create()
    const membership = await createMembership({
      user: administrator,
      clinic,
      roleCode: 'clinic_admin',
    })
    const token = await createToken(administrator)

    const response = await client
      .get(`/api/v1/clinics/${clinic.id}/members`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    response.assertStatus(200)

    const body = response.body()

    assert.lengthOf(body.data, 1)
    assert.deepInclude(body.meta, {
      total: 1,
      perPage: 20,
      currentPage: 1,
      lastPage: 1,
    })

    const member = body.data[0]

    assert.deepEqual(Object.keys(member).sort(), [
      'clinicId',
      'createdAt',
      'id',
      'isActive',
      'role',
      'roleId',
      'updatedAt',
      'user',
      'userId',
    ])
    assert.deepEqual(Object.keys(member.user).sort(), [
      'createdAt',
      'email',
      'fullName',
      'id',
      'invitationExpiresAt',
      'invitationSentAt',
      'invitationStatus',
      'isActive',
      'isGlobalAdmin',
      'lastLoginAt',
      'passwordConfigured',
      'updatedAt',
    ])
    assert.deepEqual(Object.keys(member.role).sort(), [
      'clinicId',
      'code',
      'createdAt',
      'description',
      'id',
      'isActive',
      'isSystem',
      'name',
      'updatedAt',
    ])
    assert.equal(member.id, membership.id)
    assert.equal(member.userId, administrator.id)
    assert.equal(member.clinicId, clinic.id)
    assert.equal(member.roleId, membership.roleId)
    assert.isTrue(member.isActive)
    assert.equal(member.user.id, administrator.id)
    assert.equal(member.user.fullName, 'Administrador do Contrato')
    assert.equal(member.user.email, 'members.contract.admin@example.com')
    assert.equal(member.role.code, 'clinic_admin')
    assert.isUndefined(member.user.passwordHash)
    assert.isUndefined(member.user.emailNormalized)
  })

  test('associates safe onboarding metadata with each user in the current page', async ({
    client,
    assert,
  }) => {
    const clinic = await ClinicFactory.merge({ name: 'Clínica de Onboarding' }).create()
    const administrator = await UserFactory.merge({
      fullName: 'Administrador com Senha',
      email: 'members.onboarding.admin@example.com',
    }).create()
    const invitedUser = await UserFactory.merge({
      fullName: 'Membro Convidado',
      email: 'members.onboarding.invited@example.com',
      passwordHash: null,
    }).create()

    await createMembership({ user: administrator, clinic, roleCode: 'clinic_admin' })
    await createMembership({ user: invitedUser, clinic, roleCode: 'receptionist' })

    const invitationSentAt = DateTime.fromISO('2026-09-09T12:00:00.000Z')
    const invitationExpiresAt = DateTime.fromISO('2099-09-10T12:00:00.000Z')

    await UserInvitationToken.create({
      userId: invitedUser.id,
      tokenDigest: 'a'.repeat(64),
      expiresAt: invitationExpiresAt,
      consumedAt: null,
      revokedAt: null,
      sentAt: invitationSentAt,
      createdByUserId: administrator.id,
    })

    const token = await createToken(administrator)
    const response = await client
      .get(`/api/v1/clinics/${clinic.id}/members`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    response.assertStatus(200)

    const members = response.body().data as Array<{ user: Record<string, unknown> }>
    const administratorMember = members.find((member) => member.user.id === administrator.id)
    const invitedMember = members.find((member) => member.user.id === invitedUser.id)

    assert.exists(administratorMember)
    assert.exists(invitedMember)
    assert.deepInclude(administratorMember!.user, {
      passwordConfigured: true,
      invitationStatus: 'not_invited',
      invitationSentAt: null,
      invitationExpiresAt: null,
    })
    assert.deepInclude(invitedMember!.user, {
      passwordConfigured: false,
      invitationStatus: 'sent',
      invitationSentAt: invitationSentAt.toISO(),
      invitationExpiresAt: invitationExpiresAt.toISO(),
    })

    const serializedResponse = JSON.stringify(response.body())

    for (const secretField of [
      'token',
      'rawToken',
      'tokenDigest',
      'token_digest',
      'password',
      'passwordHash',
      'password_hash',
    ]) {
      assert.notInclude(serializedResponse, `\"${secretField}\"`)
    }
  })

  test('paginates and filters clinic members without crossing clinic boundaries', async ({
    client,
    assert,
  }) => {
    const clinic = await ClinicFactory.merge({ name: 'Clínica de Filtros' }).create()
    const otherClinic = await ClinicFactory.merge({ name: 'Outra Clínica' }).create()
    const administrator = await UserFactory.merge({
      fullName: 'Administrador Local',
      email: 'members.pagination.admin@example.com',
    }).create()

    await createMembership({ user: administrator, clinic, roleCode: 'clinic_admin' })

    const firstReceptionist = await UserFactory.merge({
      fullName: 'Membro Filtro Alfa',
      email: 'member.alpha@example.com',
    }).create()
    const secondReceptionist = await UserFactory.merge({
      fullName: 'Membro Beta',
      email: 'member.filter.beta@example.com',
    }).create()
    const nonMatchingReceptionist = await UserFactory.merge({
      fullName: 'Membro Sem Correspondência',
      email: 'member.no.match@example.com',
    }).create()
    const doctor = await UserFactory.merge({
      fullName: 'Membro Filtro Médico',
      email: 'member.doctor@example.com',
    }).create()
    const inactiveReceptionist = await UserFactory.merge({
      fullName: 'Membro Filtro Inativo',
      email: 'member.inactive@example.com',
    }).create()
    const memberFromOtherClinic = await UserFactory.merge({
      fullName: 'Membro Filtro Outra Clínica',
      email: 'member.other@example.com',
    }).create()

    const expectedMemberships = await Promise.all([
      createMembership({ user: firstReceptionist, clinic, roleCode: 'receptionist' }),
      createMembership({ user: secondReceptionist, clinic, roleCode: 'receptionist' }),
    ])

    await createMembership({
      user: nonMatchingReceptionist,
      clinic,
      roleCode: 'receptionist',
    })
    await createMembership({ user: doctor, clinic, roleCode: 'doctor' })
    await createMembership({
      user: inactiveReceptionist,
      clinic,
      roleCode: 'receptionist',
      isActive: false,
    })
    await createMembership({
      user: memberFromOtherClinic,
      clinic: otherClinic,
      roleCode: 'receptionist',
    })

    const token = await createToken(administrator)
    const receptionistRole = await Role.findByOrFail('code', 'receptionist')
    const requestedIds: string[] = []

    for (const page of [1, 2]) {
      const response = await client
        .get(
          `/api/v1/clinics/${clinic.id}/members?page=${page}&perPage=1&search=FILT&roleId=${receptionistRole.id}&isActive=true`
        )
        .header('Accept', 'application/json')
        .header('Authorization', `Bearer ${token}`)

      response.assertStatus(200)
      assert.lengthOf(response.body().data, 1)
      assert.deepInclude(response.body().meta, {
        total: 2,
        perPage: 1,
        currentPage: page,
        lastPage: 2,
      })
      requestedIds.push(response.body().data[0].id)
    }

    assert.deepEqual(
      requestedIds.sort(),
      expectedMemberships.map((membership) => membership.id).sort()
    )
  })

  test('orders clinic members by creation time and id', async ({ client, assert }) => {
    const clinic = await ClinicFactory.merge({ name: 'Clínica de Ordenação' }).create()
    const administrator = await UserFactory.merge({
      fullName: 'Administrador de Ordenação',
      email: 'members.ordering.admin@example.com',
    }).create()

    await createMembership({ user: administrator, clinic, roleCode: 'clinic_admin' })

    const firstUser = await UserFactory.merge({
      fullName: 'Primeiro Membro Ordenado',
      email: 'members.ordering.first@example.com',
    }).create()
    const secondUser = await UserFactory.merge({
      fullName: 'Segundo Membro Ordenado',
      email: 'members.ordering.second@example.com',
    }).create()
    const newerUser = await UserFactory.merge({
      fullName: 'Membro Mais Recente',
      email: 'members.ordering.newer@example.com',
    }).create()

    const receptionistRole = await Role.findByOrFail('code', 'receptionist')
    const olderCreatedAt = DateTime.fromISO('2026-09-03T11:00:00.000Z')
    const newerCreatedAt = DateTime.fromISO('2026-09-03T12:00:00.000Z')
    const firstMembershipId = '00000000-0000-4000-8000-000000000001'
    const secondMembershipId = '00000000-0000-4000-8000-000000000002'
    const newerMembershipId = '00000000-0000-4000-8000-000000000000'

    await UserClinicRoleFactory.merge({
      id: secondMembershipId,
      userId: secondUser.id,
      clinicId: clinic.id,
      roleId: receptionistRole.id,
      isActive: true,
      createdAt: olderCreatedAt,
    }).create()
    await UserClinicRoleFactory.merge({
      id: newerMembershipId,
      userId: newerUser.id,
      clinicId: clinic.id,
      roleId: receptionistRole.id,
      isActive: true,
      createdAt: newerCreatedAt,
    }).create()
    await UserClinicRoleFactory.merge({
      id: firstMembershipId,
      userId: firstUser.id,
      clinicId: clinic.id,
      roleId: receptionistRole.id,
      isActive: true,
      createdAt: olderCreatedAt,
    }).create()

    const token = await createToken(administrator)
    const response = await client
      .get(
        `/api/v1/clinics/${clinic.id}/members?page=1&perPage=20&roleId=${receptionistRole.id}&isActive=true`
      )
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    response.assertStatus(200)
    assert.deepInclude(response.body().meta, {
      total: 3,
      perPage: 20,
      currentPage: 1,
      lastPage: 1,
    })
    assert.deepEqual(
      response.body().data.map((membership: { id: string }) => membership.id),
      [firstMembershipId, secondMembershipId, newerMembershipId]
    )
  })

  test('rejects invalid clinic member pagination parameters', async ({ client }) => {
    const clinic = await ClinicFactory.merge({
      name: 'Clínica de Paginação Inválida',
    }).create()
    const administrator = await UserFactory.merge({
      fullName: 'Administrador de Paginação',
      email: 'members.invalid-pagination.admin@example.com',
    }).create()

    await createMembership({ user: administrator, clinic, roleCode: 'clinic_admin' })

    const token = await createToken(administrator)

    const invalidPageResponse = await client
      .get(`/api/v1/clinics/${clinic.id}/members?page=0`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    invalidPageResponse.assertStatus(422)

    const invalidPaginationResponse = await client
      .get(`/api/v1/clinics/${clinic.id}/members?perPage=101`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    invalidPaginationResponse.assertStatus(422)
  })

  test('removes legacy member creation and rejects roleCode in remaining inputs', async ({
    client,
  }) => {
    const clinic = await ClinicFactory.create()
    const administrator = await UserFactory.create()
    const target = await UserFactory.create()
    await createMembership({ user: administrator, clinic, roleCode: 'clinic_admin' })
    const targetMembership = await createMembership({
      user: target,
      clinic,
      roleCode: 'receptionist',
    })
    const receptionistRole = await Role.findByOrFail('code', 'receptionist')
    const token = await createToken(administrator)

    const legacyCreate = await client
      .post(`/api/v1/clinics/${clinic.id}/members`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Membro Legado',
        email: 'legacy.member@example.test',
        password: 'InitialPassword!123',
        roleId: receptionistRole.id,
      })
    legacyCreate.assertStatus(404)

    const legacyUpdate = await client
      .patch(`/api/v1/clinics/${clinic.id}/members/${targetMembership.id}/role`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({ roleId: receptionistRole.id, roleCode: 'receptionist' })
    legacyUpdate.assertStatus(422)

    const legacyFilter = await client
      .get(`/api/v1/clinics/${clinic.id}/members?roleCode=receptionist`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
    legacyFilter.assertStatus(422)
  })

  test('updates local role and status but rejects cross-clinic access', async ({
    client,
    assert,
  }) => {
    const firstClinic = await ClinicFactory.merge({ name: 'Primeira Clínica' }).create()
    const secondClinic = await ClinicFactory.merge({ name: 'Segunda Clínica' }).create()

    const administrator = await UserFactory.merge({
      fullName: 'Usuário Administrativo',
      email: 'scoped.admin@example.com',
    }).create()

    const targetUser = await UserFactory.merge({
      fullName: 'Usuário Administrativo',
      email: 'target.user@example.com',
    }).create()

    const otherUser = await UserFactory.merge({
      fullName: 'Usuário Administrativo',
      email: 'other.user@example.com',
    }).create()

    await createMembership({
      user: administrator,
      clinic: firstClinic,
      roleCode: 'clinic_admin',
    })

    const targetMembership = await createMembership({
      user: targetUser,
      clinic: firstClinic,
      roleCode: 'receptionist',
    })

    const otherMembership = await createMembership({
      user: otherUser,
      clinic: secondClinic,
      roleCode: 'doctor',
    })

    const token = await createToken(administrator)
    const doctorRole = await Role.findByOrFail('code', 'doctor')
    const receptionistRole = await Role.findByOrFail('code', 'receptionist')

    const roleResponse = await client
      .patch(`/api/v1/clinics/${firstClinic.id}/members/${targetMembership.id}/role`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        roleId: doctorRole.id,
      })

    roleResponse.assertStatus(200)
    assert.equal(roleResponse.body().membership.role.code, 'doctor')

    const statusResponse = await client
      .patch(`/api/v1/clinics/${firstClinic.id}/members/${targetMembership.id}/status`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        isActive: false,
      })

    statusResponse.assertStatus(200)
    assert.isFalse(statusResponse.body().membership.isActive)

    const crossClinicResponse = await client
      .patch(`/api/v1/clinics/${firstClinic.id}/members/${otherMembership.id}/role`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        roleId: receptionistRole.id,
      })

    crossClinicResponse.assertStatus(404)
  })

  test('denies member administration to a receptionist', async ({ client }) => {
    const clinic = await ClinicFactory.merge({ name: 'Clínica Restrita' }).create()
    const receptionist = await UserFactory.merge({
      fullName: 'Usuário Administrativo',
      email: 'restricted.receptionist@example.com',
    }).create()

    await createMembership({
      user: receptionist,
      clinic,
      roleCode: 'receptionist',
    })

    const token = await createToken(receptionist)
    const receptionistRole = await Role.findByOrFail('code', 'receptionist')

    const response = await client
      .post(`/api/v1/clinics/${clinic.id}/members/invitations`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Usuário Indevido',
        email: 'forbidden.user@example.com',
        roleId: receptionistRole.id,
      })

    response.assertStatus(403)
  })

  test('protects the last active clinic administrator in local and global routes', async ({
    client,
  }) => {
    const clinic = await ClinicFactory.merge({ name: 'Clínica com Administrador Único' }).create()

    const globalAdmin = await UserFactory.apply('globalAdmin')
      .merge({ fullName: 'Usuário Administrativo', email: 'global.members.admin@example.com' })
      .create()

    const clinicAdmin = await UserFactory.merge({
      fullName: 'Usuário Administrativo',
      email: 'only.clinic.admin@example.com',
    }).create()

    const membership = await createMembership({
      user: clinicAdmin,
      clinic,
      roleCode: 'clinic_admin',
    })

    const clinicToken = await createToken(clinicAdmin)
    const globalToken = await createToken(globalAdmin)
    const receptionistRole = await Role.findByOrFail('code', 'receptionist')
    const doctorRole = await Role.findByOrFail('code', 'doctor')

    const localRoleResponse = await client
      .patch(`/api/v1/clinics/${clinic.id}/members/${membership.id}/role`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${clinicToken}`)
      .json({
        roleId: receptionistRole.id,
      })

    localRoleResponse.assertStatus(409)

    const localStatusResponse = await client
      .patch(`/api/v1/clinics/${clinic.id}/members/${membership.id}/status`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${clinicToken}`)
      .json({
        isActive: false,
      })

    localStatusResponse.assertStatus(409)

    const globalRoleResponse = await client
      .patch(`/api/v1/clinic-memberships/${membership.id}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${globalToken}`)
      .json({
        roleId: doctorRole.id,
      })

    globalRoleResponse.assertStatus(409)

    const globalStatusResponse = await client
      .patch(`/api/v1/clinic-memberships/${membership.id}/status`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${globalToken}`)
      .json({
        isActive: false,
      })

    globalStatusResponse.assertStatus(409)

    const globalUserStatusResponse = await client
      .patch(`/api/v1/users/${clinicAdmin.id}/status`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${globalToken}`)
      .json({
        isActive: false,
      })

    globalUserStatusResponse.assertStatus(409)
    globalUserStatusResponse.assertBodyContains({
      message: 'O último Administrador de Consultório ativo não pode ter seu usuário inativado',
    })
  })
})
