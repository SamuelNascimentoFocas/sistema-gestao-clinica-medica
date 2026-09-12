import { UserFactory } from '#database/factories/user_factory'
import { ClinicFactory } from '#database/factories/clinic_factory'
import { createBearerToken } from '#tests/helpers/auth'
import { createMembership } from '#tests/helpers/membership'
import { test } from '@japa/runner'
import { truncateClinicSchemaTables } from '../../helpers/database.js'
import { seedAuthorizationCatalog } from '../../../database/seeders/authorization_catalog_seeder.js'

test.group('Clinic access authorization', (group) => {
  group.each.setup(async () => {
    await truncateClinicSchemaTables()
    await seedAuthorizationCatalog()

    return async () => {
      await truncateClinicSchemaTables()
    }
  })

  test('requires authentication and an active clinic membership', async ({ client }) => {
    const clinic = await ClinicFactory.merge({ name: 'Clínica Protegida' }).create()

    const unauthenticatedResponse = await client
      .get(`/api/v1/clinics/${clinic.id}/context`)
      .header('Accept', 'application/json')

    unauthenticatedResponse.assertStatus(401)

    const userWithoutMembership = await UserFactory.merge({
      fullName: 'Usuário de Acesso',
      email: 'without.membership@example.com',
    }).create()

    const tokenWithoutMembership = await createBearerToken(userWithoutMembership)

    const withoutMembershipResponse = await client
      .get(`/api/v1/clinics/${clinic.id}/context`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${tokenWithoutMembership}`)

    withoutMembershipResponse.assertStatus(403)
    withoutMembershipResponse.assertBodyContains({
      message: 'Usuário sem vínculo ativo com este consultório',
    })

    const userWithInactiveMembership = await UserFactory.merge({
      fullName: 'Usuário de Acesso',
      email: 'inactive.membership@example.com',
    }).create()

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
    const clinic = await ClinicFactory.merge({ name: 'Clínica de Contexto' }).create()

    const globalAdmin = await UserFactory.apply('globalAdmin')
      .merge({ fullName: 'Usuário de Acesso', email: 'context.global.admin@example.com' })
      .create()

    const receptionist = await UserFactory.merge({
      fullName: 'Usuário de Acesso',
      email: 'context.receptionist@example.com',
    }).create()

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
    const clinic = await ClinicFactory.merge({ name: 'Clínica de Permissões' }).create()

    const clinicAdmin = await UserFactory.merge({
      fullName: 'Usuário de Acesso',
      email: 'local.admin@example.com',
    }).create()

    const receptionist = await UserFactory.merge({
      fullName: 'Usuário de Acesso',
      email: 'local.receptionist@example.com',
    }).create()

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
