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
    fullName: 'Usuário de Acesso',
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

test.group('Clinic access authorization', (group) => {
  group.each.setup(async () => {
    await truncateClinicSchemaTables()
    await seedAuthorizationCatalog()

    return async () => {
      await truncateClinicSchemaTables()
    }
  })

  test('requires authentication and an active clinic membership', async ({ client }) => {
    const clinic = await createClinic({
      name: 'Clínica Protegida',
    })

    const unauthenticatedResponse = await client
      .get(`/api/v1/clinics/${clinic.id}/context`)
      .header('Accept', 'application/json')

    unauthenticatedResponse.assertStatus(401)

    const userWithoutMembership = await createUser({
      email: 'without.membership@example.com',
    })

    const tokenWithoutMembership = await createBearerToken(userWithoutMembership)

    const withoutMembershipResponse = await client
      .get(`/api/v1/clinics/${clinic.id}/context`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${tokenWithoutMembership}`)

    withoutMembershipResponse.assertStatus(403)
    withoutMembershipResponse.assertBodyContains({
      message: 'Usuário sem vínculo ativo com este consultório',
    })

    const userWithInactiveMembership = await createUser({
      email: 'inactive.membership@example.com',
    })

    await createMembership({
      user: userWithInactiveMembership,
      clinic,
      roleCode: 'receptionist',
      isActive: false,
    })

    const inactiveMembershipToken = await createBearerToken(userWithInactiveMembership)

    const inactiveMembershipResponse = await client
      .get(`/api/v1/clinics/${clinic.id}/context`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${inactiveMembershipToken}`)

    inactiveMembershipResponse.assertStatus(403)
  })

  test('returns global and clinic-scoped authorization contexts', async ({ client, assert }) => {
    const clinic = await createClinic({
      name: 'Clínica de Contexto',
    })

    const globalAdmin = await createUser({
      email: 'context.global.admin@example.com',
      isGlobalAdmin: true,
    })

    const receptionist = await createUser({
      email: 'context.receptionist@example.com',
    })

    await createMembership({
      user: receptionist,
      clinic,
      roleCode: 'receptionist',
    })

    const globalToken = await createBearerToken(globalAdmin)
    const receptionistToken = await createBearerToken(receptionist)

    const globalResponse = await client
      .get(`/api/v1/clinics/${clinic.id}/context`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${globalToken}`)

    globalResponse.assertStatus(200)

    assert.equal(globalResponse.body().access.scope, 'global')
    assert.isNull(globalResponse.body().access.role)
    assert.deepEqual(globalResponse.body().access.permissions, ['*'])

    const receptionistResponse = await client
      .get(`/api/v1/clinics/${clinic.id}/context`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${receptionistToken}`)

    receptionistResponse.assertStatus(200)

    const access = receptionistResponse.body().access

    assert.equal(access.scope, 'clinic')
    assert.equal(access.role.code, 'receptionist')
    assert.include(access.permissions, 'clinics.read')
    assert.notInclude(access.permissions, 'users.read')
  })

  test('enforces the permission required by each clinic route', async ({ client, assert }) => {
    const clinic = await createClinic({
      name: 'Clínica de Permissões',
    })

    const clinicAdmin = await createUser({
      email: 'local.admin@example.com',
    })

    const receptionist = await createUser({
      email: 'local.receptionist@example.com',
    })

    await createMembership({
      user: clinicAdmin,
      clinic,
      roleCode: 'clinic_admin',
    })

    await createMembership({
      user: receptionist,
      clinic,
      roleCode: 'receptionist',
    })

    const clinicAdminToken = await createBearerToken(clinicAdmin)
    const receptionistToken = await createBearerToken(receptionist)

    const allowedResponse = await client
      .get(`/api/v1/clinics/${clinic.id}/members`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${clinicAdminToken}`)

    allowedResponse.assertStatus(200)
    assert.lengthOf(allowedResponse.body().data, 2)

    const forbiddenResponse = await client
      .get(`/api/v1/clinics/${clinic.id}/members`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${receptionistToken}`)

    forbiddenResponse.assertStatus(403)
    forbiddenResponse.assertBodyContains({
      message: 'Permissão insuficiente para acessar este recurso',
    })
  })
})
