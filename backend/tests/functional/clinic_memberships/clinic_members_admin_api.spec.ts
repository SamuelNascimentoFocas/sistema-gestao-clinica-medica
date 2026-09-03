import { UserFactory } from '#database/factories/user_factory'
import { ClinicFactory } from '#database/factories/clinic_factory'
import { createBearerToken as createToken } from '#tests/helpers/auth'
import { createMembership } from '#tests/helpers/membership'
import { test } from '@japa/runner'
import { truncateClinicSchemaTables } from '../../helpers/database.js'
import { seedAuthorizationCatalog } from '../../../database/seeders/authorization_catalog_seeder.js'

test.group('Clinic-scoped member administration', (group) => {
  group.each.setup(async () => {
    await truncateClinicSchemaTables()
    await seedAuthorizationCatalog()

    return async () => {
      await truncateClinicSchemaTables()
    }
  })

  test('allows a clinic administrator to create a local user and membership', async ({
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

    const token = await createToken(administrator)

    const response = await client
      .post(`/api/v1/clinics/${clinic.id}/members`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Recepcionista Local',
        email: 'local.receptionist@example.com',
        password: 'InitialPassword!123',
        roleCode: 'receptionist',
      })

    response.assertStatus(201)

    const membership = response.body().membership

    assert.equal(membership.clinic.id, clinic.id)
    assert.equal(membership.user.email, 'local.receptionist@example.com')
    assert.equal(membership.role.code, 'receptionist')
    assert.isTrue(membership.isActive)
    assert.isUndefined(membership.user.passwordHash)
    assert.isUndefined(membership.user.emailNormalized)

    const loginResponse = await client.post('/api/v1/auth/login').json({
      email: 'LOCAL.RECEPTIONIST@example.com',
      password: 'InitialPassword!123',
    })

    loginResponse.assertStatus(200)
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

    const roleResponse = await client
      .patch(`/api/v1/clinics/${firstClinic.id}/members/${targetMembership.id}/role`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        roleCode: 'doctor',
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
        roleCode: 'receptionist',
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

    const response = await client
      .post(`/api/v1/clinics/${clinic.id}/members`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Usuário Indevido',
        email: 'forbidden.user@example.com',
        password: 'InitialPassword!123',
        roleCode: 'receptionist',
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

    const localRoleResponse = await client
      .patch(`/api/v1/clinics/${clinic.id}/members/${membership.id}/role`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${clinicToken}`)
      .json({
        roleCode: 'receptionist',
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
        roleCode: 'doctor',
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
