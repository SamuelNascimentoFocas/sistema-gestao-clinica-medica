import { test } from '@japa/runner'
import User from '#models/user'
import Clinic from '#models/clinic'
import Role from '#models/role'
import UserClinicRole from '#models/user_clinic_role'
import { truncateClinicSchemaTables } from '../../helpers/database.js'
import { seedAuthorizationCatalog } from '../../../database/seeders/authorization_catalog_seeder.js'

async function createUser({
  email,
  isGlobalAdmin = false,
  isActive = true,
}: {
  email: string
  isGlobalAdmin?: boolean
  isActive?: boolean
}) {
  return User.create({
    fullName: 'Usuário de Teste',
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

async function createMembership({
  user,
  clinic,
  roleCode,
  isActive = true,
}: {
  user: User
  clinic: Clinic
  roleCode: 'clinic_admin' | 'receptionist' | 'doctor'
  isActive?: boolean
}) {
  const role = await Role.findByOrFail('code', roleCode)

  return UserClinicRole.create({
    userId: user.id,
    clinicId: clinic.id,
    roleId: role.id,
    isActive,
  })
}

async function createBearerToken(user: User) {
  const token = await User.accessTokens.create(user)

  return token.value!.release()
}

test.group('Authenticated user clinics', (group) => {
  group.each.setup(async () => {
    await truncateClinicSchemaTables()
    await seedAuthorizationCatalog()

    return async () => {
      await truncateClinicSchemaTables()
    }
  })

  test('requires authentication', async ({ client }) => {
    const response = await client
      .get('/api/v1/auth/me/clinics')
      .header('Accept', 'application/json')

    response.assertStatus(401)
  })

  test('returns only active and accessible clinics for a regular user', async ({
    client,
    assert,
  }) => {
    const user = await createUser({
      email: 'regular.user@example.com',
    })

    const activeClinic = await createClinic({
      name: 'Clínica Ativa',
    })

    const inactiveClinic = await createClinic({
      name: 'Clínica Inativa',
      isActive: false,
    })

    const inactiveMembershipClinic = await createClinic({
      name: 'Clínica com Vínculo Inativo',
    })

    const inactiveRoleClinic = await createClinic({
      name: 'Clínica com Perfil Inativo',
    })

    const activeMembership = await createMembership({
      user,
      clinic: activeClinic,
      roleCode: 'receptionist',
    })

    await createMembership({
      user,
      clinic: inactiveClinic,
      roleCode: 'receptionist',
    })

    await createMembership({
      user,
      clinic: inactiveMembershipClinic,
      roleCode: 'receptionist',
      isActive: false,
    })

    await createMembership({
      user,
      clinic: inactiveRoleClinic,
      roleCode: 'doctor',
    })

    const doctorRole = await Role.findByOrFail('code', 'doctor')
    doctorRole.isActive = false
    await doctorRole.save()

    const token = await createBearerToken(user)

    const response = await client
      .get('/api/v1/auth/me/clinics')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    response.assertStatus(200)

    const body = response.body()

    assert.lengthOf(body.data, 1)
    assert.equal(body.data[0].clinic.id, activeClinic.id)
    assert.equal(body.data[0].access.scope, 'clinic')
    assert.equal(body.data[0].access.membershipId, activeMembership.id)
    assert.equal(body.data[0].access.role.code, 'receptionist')
  })

  test('returns every active clinic to the global administrator', async ({ client, assert }) => {
    const globalAdmin = await createUser({
      email: 'global.admin@example.com',
      isGlobalAdmin: true,
    })

    await createClinic({
      name: 'Clínica Zeta',
    })

    await createClinic({
      name: 'Clínica Alfa',
    })

    await createClinic({
      name: 'Clínica Desativada',
      isActive: false,
    })

    const token = await createBearerToken(globalAdmin)

    const response = await client
      .get('/api/v1/auth/me/clinics')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    response.assertStatus(200)

    const body = response.body()

    assert.deepEqual(
      body.data.map(
        (item: {
          clinic: {
            name: string
          }
        }) => item.clinic.name
      ),
      ['Clínica Alfa', 'Clínica Zeta']
    )

    for (const item of body.data) {
      assert.equal(item.access.scope, 'global')
      assert.isNull(item.access.membershipId)
      assert.isNull(item.access.role)
    }
  })
})
