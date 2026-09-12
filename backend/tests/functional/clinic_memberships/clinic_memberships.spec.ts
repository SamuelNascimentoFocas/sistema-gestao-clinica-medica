import { ClinicFactory } from '#database/factories/clinic_factory'
import { UserFactory } from '#database/factories/user_factory'
import { createBearerToken } from '#tests/helpers/auth'
import { test } from '@japa/runner'
import { truncateClinicSchemaTables } from '../../helpers/database.js'
import Role from '#models/role'

async function createRole({
  code,
  name,
  isActive = true,
}: {
  code: 'clinic_admin' | 'receptionist' | 'doctor'
  name: string
  isActive?: boolean
}) {
  return Role.create({
    code,
    name,
    description: null,
    isSystem: true,
    isActive,
  })
}

test.group('Clinic memberships', (group) => {
  group.each.setup(async () => {
    await truncateClinicSchemaTables()

    return async () => {
      await truncateClinicSchemaTables()
    }
  })

  test('requires authentication and global administrator access', async ({ client }) => {
    const unauthenticatedResponse = await client
      .get('/api/v1/clinic-memberships')
      .header('Accept', 'application/json')

    unauthenticatedResponse.assertStatus(401)

    const regularUser = await UserFactory.merge({
      fullName: 'Usuário Teste',
      email: 'regular.membership@example.com',
      isGlobalAdmin: false,
    }).create()

    const token = await createBearerToken(regularUser)

    const forbiddenResponse = await client
      .get('/api/v1/clinic-memberships')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    forbiddenResponse.assertStatus(403)
    forbiddenResponse.assertBodyContains({
      message: 'Acesso restrito ao Administrador Geral',
    })
  })

  test('allows a global administrator to manage memberships', async ({ client, assert }) => {
    const admin = await UserFactory.apply('globalAdmin')
      .merge({ fullName: 'Usuário Teste', email: 'membership.admin@example.com' })
      .create()

    const user = await UserFactory.merge({
      fullName: 'Usuário Teste',
      email: 'membership.user@example.com',
      isGlobalAdmin: false,
    }).create()

    const clinic = await ClinicFactory.merge({ name: 'Clínica do Vínculo' }).create()

    const receptionistRole = await createRole({
      code: 'receptionist',
      name: 'Recepcionista',
    })

    const doctorRole = await createRole({
      code: 'doctor',
      name: 'Médico',
    })

    const token = await createBearerToken(admin)

    const createResponse = await client
      .post('/api/v1/clinic-memberships')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        userId: user.id,
        clinicId: clinic.id,
        roleId: receptionistRole.id,
      })

    createResponse.assertStatus(201)

    const membership = createResponse.body().membership

    assert.equal(membership.user.id, user.id)
    assert.equal(membership.clinic.id, clinic.id)
    assert.equal(membership.role.code, 'receptionist')
    assert.isTrue(membership.isActive)

    const listResponse = await client
      .get(
        `/api/v1/clinic-memberships?userId=${user.id}&clinicId=${clinic.id}&roleId=${receptionistRole.id}`
      )
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    listResponse.assertStatus(200)
    assert.lengthOf(listResponse.body().data, 1)

    const showResponse = await client
      .get(`/api/v1/clinic-memberships/${membership.id}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    showResponse.assertStatus(200)
    assert.equal(showResponse.body().membership.id, membership.id)

    const updateResponse = await client
      .patch(`/api/v1/clinic-memberships/${membership.id}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        roleId: doctorRole.id,
      })

    updateResponse.assertStatus(200)
    assert.equal(updateResponse.body().membership.role.code, 'doctor')

    const statusResponse = await client
      .patch(`/api/v1/clinic-memberships/${membership.id}/status`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        isActive: false,
      })

    statusResponse.assertStatus(200)
    assert.isFalse(statusResponse.body().membership.isActive)
  })

  test('rejects duplicate and invalid memberships', async ({ client }) => {
    const admin = await UserFactory.apply('globalAdmin')
      .merge({ fullName: 'Usuário Teste', email: 'membership.validation.admin@example.com' })
      .create()

    const user = await UserFactory.merge({
      fullName: 'Usuário Teste',
      email: 'membership.validation.user@example.com',
      isGlobalAdmin: false,
    }).create()

    const clinic = await ClinicFactory.merge({ name: 'Clínica de Validação' }).create()

    const receptionistRole = await createRole({
      code: 'receptionist',
      name: 'Recepcionista',
    })

    const token = await createBearerToken(admin)

    const firstResponse = await client
      .post('/api/v1/clinic-memberships')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        userId: user.id,
        clinicId: clinic.id,
        roleId: receptionistRole.id,
      })

    firstResponse.assertStatus(201)

    const duplicateResponse = await client
      .post('/api/v1/clinic-memberships')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        userId: user.id,
        clinicId: clinic.id,
        roleId: receptionistRole.id,
      })

    duplicateResponse.assertStatus(409)
    duplicateResponse.assertBodyContains({
      message: 'Este usuário já possui um vínculo com este consultório',
    })

    const globalAdminResponse = await client
      .post('/api/v1/clinic-memberships')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        userId: admin.id,
        clinicId: clinic.id,
        roleId: receptionistRole.id,
      })

    globalAdminResponse.assertStatus(409)

    const invalidRoleResponse = await client
      .post('/api/v1/clinic-memberships')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        userId: user.id,
        clinicId: clinic.id,
        roleId: 'invalid-role-id',
      })

    invalidRoleResponse.assertStatus(422)
  })

  test('rejects legacy roleCode across global membership inputs', async ({ client }) => {
    const admin = await UserFactory.apply('globalAdmin').create()
    const user = await UserFactory.create()
    const clinic = await ClinicFactory.create()
    const receptionistRole = await createRole({
      code: 'receptionist',
      name: 'Recepcionista',
    })
    const token = await createBearerToken(admin)

    const legacyCreate = await client
      .post('/api/v1/clinic-memberships')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({ userId: user.id, clinicId: clinic.id, roleCode: 'receptionist' })
    legacyCreate.assertStatus(422)

    const created = await client
      .post('/api/v1/clinic-memberships')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({ userId: user.id, clinicId: clinic.id, roleId: receptionistRole.id })
    created.assertStatus(201)

    const legacyUpdate = await client
      .patch(`/api/v1/clinic-memberships/${created.body().membership.id}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({ roleId: receptionistRole.id, roleCode: 'receptionist' })
    legacyUpdate.assertStatus(422)

    const legacyFilter = await client
      .get('/api/v1/clinic-memberships?roleCode=receptionist')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
    legacyFilter.assertStatus(422)
  })
})
