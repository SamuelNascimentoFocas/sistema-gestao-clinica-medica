import { ClinicFactory } from '#database/factories/clinic_factory'
import { UserFactory } from '#database/factories/user_factory'
import { createBearerToken } from '#tests/helpers/auth'
import { createMembership } from '#tests/helpers/membership'
import { test } from '@japa/runner'
import Role from '#models/role'
import { truncateClinicSchemaTables } from '../../helpers/database.js'
import { seedAuthorizationCatalog } from '../../../database/seeders/authorization_catalog_seeder.js'

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
    const user = await UserFactory.merge({
      fullName: 'Usuário de Teste',
      email: 'regular.user@example.com',
    }).create()

    const activeClinic = await ClinicFactory.merge({ name: 'Clínica Ativa' }).create()

    const inactiveClinic = await ClinicFactory.merge({
      name: 'Clínica Inativa',
      isActive: false,
    }).create()

    const inactiveMembershipClinic = await ClinicFactory.merge({
      name: 'Clínica com Vínculo Inativo',
    }).create()

    const inactiveRoleClinic = await ClinicFactory.merge({
      name: 'Clínica com Perfil Inativo',
    }).create()

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
    const globalAdmin = await UserFactory.apply('globalAdmin')
      .merge({ fullName: 'Usuário de Teste', email: 'global.admin@example.com' })
      .create()

    await ClinicFactory.merge({ name: 'Clínica Zeta' }).create()

    await ClinicFactory.merge({ name: 'Clínica Alfa' }).create()

    await ClinicFactory.merge({ name: 'Clínica Desativada', isActive: false }).create()

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
