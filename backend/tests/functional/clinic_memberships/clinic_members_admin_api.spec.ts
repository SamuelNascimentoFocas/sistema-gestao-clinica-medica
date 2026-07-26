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
}: {
  email: string
  isGlobalAdmin?: boolean
}) {
  return User.create({
    fullName: 'Usuário Administrativo',
    email,
    emailNormalized: email.toLowerCase(),
    passwordHash: 'TestPassword!123',
    isGlobalAdmin,
    isActive: true,
  })
}

async function createClinic(name: string) {
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
    isActive: true,
  })
}

async function createMembership({
  user,
  clinic,
  roleCode,
}: {
  user: User
  clinic: Clinic
  roleCode: 'clinic_admin' | 'receptionist' | 'doctor'
}) {
  const role = await Role.findByOrFail('code', roleCode)

  return UserClinicRole.create({
    userId: user.id,
    clinicId: clinic.id,
    roleId: role.id,
    isActive: true,
  })
}

async function createToken(user: User) {
  const token = await User.accessTokens.create(user)

  return token.value!.release()
}

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
    const clinic = await createClinic('Clínica Administrada')
    const administrator = await createUser({
      email: 'clinic.admin@example.com',
    })

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
    const firstClinic = await createClinic('Primeira Clínica')
    const secondClinic = await createClinic('Segunda Clínica')

    const administrator = await createUser({
      email: 'scoped.admin@example.com',
    })

    const targetUser = await createUser({
      email: 'target.user@example.com',
    })

    const otherUser = await createUser({
      email: 'other.user@example.com',
    })

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
    const clinic = await createClinic('Clínica Restrita')
    const receptionist = await createUser({
      email: 'restricted.receptionist@example.com',
    })

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
    const clinic = await createClinic('Clínica com Administrador Único')

    const globalAdmin = await createUser({
      email: 'global.members.admin@example.com',
      isGlobalAdmin: true,
    })

    const clinicAdmin = await createUser({
      email: 'only.clinic.admin@example.com',
    })

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
