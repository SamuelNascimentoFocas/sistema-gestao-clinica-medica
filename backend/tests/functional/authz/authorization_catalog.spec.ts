import { test } from '@japa/runner'
import { truncateClinicSchemaTables } from '../../helpers/database.js'
import User from '#models/user'
import Clinic from '#models/clinic'
import Permission from '#models/permission'
import Role from '#models/role'
import UserClinicRole from '#models/user_clinic_role'
import {
  PERMISSIONS,
  seedAuthorizationCatalog,
} from '../../../database/seeders/authorization_catalog_seeder.js'

test.group('Authorization catalog', (group) => {
  group.each.setup(async () => {
    await truncateClinicSchemaTables()

    return async () => {
      await truncateClinicSchemaTables()
    }
  })

  test('seeds roles and permissions idempotently', async ({ assert }) => {
    await seedAuthorizationCatalog()
    await seedAuthorizationCatalog()

    const permissions = await Permission.all()
    const roles = await Role.all()

    assert.lengthOf(permissions, PERMISSIONS.length)
    assert.lengthOf(roles, 3)

    assert.isTrue(permissions.every((permission) => permission.isActive))
    assert.isTrue(roles.every((role) => role.isSystem && role.isActive))

    const clinicAdmin = await Role.query()
      .where('code', 'clinic_admin')
      .preload('permissions')
      .firstOrFail()

    assert.deepEqual(
      clinicAdmin.permissions.map((permission) => permission.code).sort(),
      PERMISSIONS.map((permission) => permission.code).sort()
    )

    const receptionist = await Role.query()
      .where('code', 'receptionist')
      .preload('permissions')
      .firstOrFail()

    const receptionistPermissions = receptionist.permissions.map((permission) => permission.code)

    assert.include(receptionistPermissions, 'appointments.create')
    assert.notInclude(receptionistPermissions, 'medical_records.read')
    assert.notInclude(receptionistPermissions, 'users.assign_role')

    const doctor = await Role.query().where('code', 'doctor').preload('permissions').firstOrFail()

    const doctorPermissions = doctor.permissions.map((permission) => permission.code)

    assert.include(doctorPermissions, 'medical_records.create')
    assert.include(doctorPermissions, 'attachments.upload')
    assert.notInclude(doctorPermissions, 'users.assign_role')

    const clinicRead = await Permission.query()
      .where('code', 'clinics.read')
      .preload('roles')
      .firstOrFail()

    assert.deepEqual(clinicRead.roles.map((role) => role.code).sort(), [
      'clinic_admin',
      'doctor',
      'receptionist',
    ])
  })

  test('relates a user, clinic, and role correctly', async ({ assert }) => {
    await seedAuthorizationCatalog()

    const user = await User.create({
      fullName: 'Recepcionista Teste',
      email: 'recepcionista@example.com',
      emailNormalized: 'recepcionista@example.com',
      passwordHash: 'TestPassword!123',
      isGlobalAdmin: false,
      isActive: true,
    })

    const clinic = await Clinic.create({
      name: 'Clínica Modelo',
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

    const role = await Role.findByOrFail('code', 'receptionist')

    const assignment = await UserClinicRole.create({
      userId: user.id,
      clinicId: clinic.id,
      roleId: role.id,
      isActive: true,
    })

    const loadedAssignment = await UserClinicRole.query()
      .where('id', assignment.id)
      .preload('user')
      .preload('clinic')
      .preload('role')
      .firstOrFail()

    assert.equal(loadedAssignment.user.id, user.id)
    assert.equal(loadedAssignment.clinic.id, clinic.id)
    assert.equal(loadedAssignment.role.code, 'receptionist')

    await user.load('clinicRoles')
    await clinic.load('userRoles')
    await role.load('userRoles')

    assert.lengthOf(user.clinicRoles, 1)
    assert.lengthOf(clinic.userRoles, 1)
    assert.lengthOf(role.userRoles, 1)
  })
})
