import { test } from '@japa/runner'
import { truncateClinicSchemaTables } from '../../helpers/database.js'
import User from '#models/user'
import Clinic from '#models/clinic'
import Role from '#models/role'

async function createUser({
  email,
  isGlobalAdmin,
  isActive = true,
}: {
  email: string
  isGlobalAdmin: boolean
  isActive?: boolean
}) {
  return User.create({
    fullName: 'Usuário Teste',
    email,
    emailNormalized: email.toLowerCase(),
    passwordHash: 'TestPassword!123',
    isGlobalAdmin,
    isActive,
  })
}

async function createClinic({ name, isActive = true }: { name: string; isActive?: boolean }) {
  return Clinic.create({
    name,
    cnpj: null,
    phone: null,
    addressStreet: null,
    addressNumber: null,
    addressComplement: null,
    addressNeighborhood: null,
    addressCity: null,
    addressState: null,
    addressPostalCode: null,
    isActive,
  })
}

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

async function createBearerToken(user: User) {
  const token = await User.accessTokens.create(user)

  return token.value!.release()
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

    const regularUser = await createUser({
      email: 'regular.membership@example.com',
      isGlobalAdmin: false,
    })

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
    const admin = await createUser({
      email: 'membership.admin@example.com',
      isGlobalAdmin: true,
    })

    const user = await createUser({
      email: 'membership.user@example.com',
      isGlobalAdmin: false,
    })

    const clinic = await createClinic({
      name: 'Clínica do Vínculo',
    })

    await createRole({
      code: 'receptionist',
      name: 'Recepcionista',
    })

    await createRole({
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
        roleCode: 'receptionist',
      })

    createResponse.assertStatus(201)

    const membership = createResponse.body().membership

    assert.equal(membership.user.id, user.id)
    assert.equal(membership.clinic.id, clinic.id)
    assert.equal(membership.role.code, 'receptionist')
    assert.isTrue(membership.isActive)

    const listResponse = await client
      .get(
        `/api/v1/clinic-memberships?userId=${user.id}&clinicId=${clinic.id}&roleCode=receptionist`
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
        roleCode: 'doctor',
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
    const admin = await createUser({
      email: 'membership.validation.admin@example.com',
      isGlobalAdmin: true,
    })

    const user = await createUser({
      email: 'membership.validation.user@example.com',
      isGlobalAdmin: false,
    })

    const clinic = await createClinic({
      name: 'Clínica de Validação',
    })

    await createRole({
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
        roleCode: 'receptionist',
      })

    firstResponse.assertStatus(201)

    const duplicateResponse = await client
      .post('/api/v1/clinic-memberships')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        userId: user.id,
        clinicId: clinic.id,
        roleCode: 'receptionist',
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
        roleCode: 'receptionist',
      })

    globalAdminResponse.assertStatus(409)

    const invalidRoleResponse = await client
      .post('/api/v1/clinic-memberships')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        userId: user.id,
        clinicId: clinic.id,
        roleCode: 'invalid_role',
      })

    invalidRoleResponse.assertStatus(422)
  })
})
