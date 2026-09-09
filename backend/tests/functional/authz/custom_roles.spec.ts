import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import { ClinicFactory } from '#database/factories/clinic_factory'
import { MedicalRecordFactory } from '#database/factories/medical_record_factory'
import { PatientClinicFactory } from '#database/factories/patient_clinic_factory'
import { PatientFactory } from '#database/factories/patient_factory'
import { UserFactory } from '#database/factories/user_factory'
import Permission from '#models/permission'
import Role from '#models/role'
import { createBearerToken } from '#tests/helpers/auth'
import { createMembership } from '#tests/helpers/membership'
import { truncateClinicSchemaTables } from '../../helpers/database.js'
import { seedAuthorizationCatalog } from '../../../database/seeders/authorization_catalog_seeder.js'

async function createCustomRole({
  clinicId,
  name,
  permissionCodes,
  isActive = true,
}: {
  clinicId: string
  name: string
  permissionCodes: string[]
  isActive?: boolean
}) {
  const role = await Role.create({
    code: `custom_${randomUUID().replaceAll('-', '')}`,
    name,
    description: null,
    clinicId,
    isSystem: false,
    isActive,
  })
  const permissions = permissionCodes.length
    ? await Permission.query().whereIn('code', permissionCodes)
    : []
  await role.related('permissions').sync(permissions.map((permission) => permission.id))
  return role
}

async function setupClinicAdmin(name: string) {
  const clinic = await ClinicFactory.merge({ name }).create()
  const administrator = await UserFactory.merge({
    fullName: `${name} Administrador`,
    email: `${randomUUID()}@example.test`,
  }).create()
  await createMembership({ user: administrator, clinic, roleCode: 'clinic_admin' })
  return { clinic, administrator, token: await createBearerToken(administrator) }
}

test.group('Clinic custom roles', (group) => {
  group.each.setup(async () => {
    await truncateClinicSchemaTables()
    await seedAuthorizationCatalog()

    return async () => {
      await truncateClinicSchemaTables()
    }
  })

  test('enforces system and clinic-scoped custom role schema constraints', async ({ assert }) => {
    const clinic = await ClinicFactory.create()

    await assert.rejects(() =>
      Role.create({
        code: `custom_${randomUUID().replaceAll('-', '')}`,
        name: 'Sem clínica',
        description: null,
        clinicId: null,
        isSystem: false,
        isActive: true,
      })
    )

    await assert.rejects(() =>
      Role.create({
        code: `custom_${randomUUID().replaceAll('-', '')}`,
        name: 'Clínica inexistente',
        description: null,
        clinicId: randomUUID(),
        isSystem: false,
        isActive: true,
      })
    )

    await assert.rejects(() =>
      Role.create({
        code: `custom_${randomUUID().replaceAll('-', '')}`,
        name: 'Sistema local',
        description: null,
        clinicId: clinic.id,
        isSystem: true,
        isActive: true,
      })
    )

    const systemRole = await Role.findByOrFail('code', 'doctor')
    assert.isNull(systemRole.clinicId)

    const customRole = await createCustomRole({
      clinicId: clinic.id,
      name: 'Atendimento avançado',
      permissionCodes: [],
    })
    assert.equal(customRole.clinicId, clinic.id)
  })

  test('enforces normalized names per clinic while allowing the same name in another clinic', async ({
    assert,
  }) => {
    const firstClinic = await ClinicFactory.create()
    const secondClinic = await ClinicFactory.create()

    await createCustomRole({
      clinicId: firstClinic.id,
      name: 'Coordenação Clínica',
      permissionCodes: [],
    })

    await assert.rejects(() =>
      createCustomRole({
        clinicId: firstClinic.id,
        name: '  coordenação clínica  ',
        permissionCodes: [],
      })
    )

    const otherClinicRole = await createCustomRole({
      clinicId: secondClinic.id,
      name: 'coordenação clínica',
      permissionCodes: [],
    })
    assert.equal(otherClinicRole.clinicId, secondClinic.id)
  })

  test('creates, lists, reads, updates, deactivates, and reactivates a custom role', async ({
    client,
    assert,
  }) => {
    const { clinic, token } = await setupClinicAdmin('Clínica CRUD')

    const createResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/roles`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        name: '  Supervisão assistencial  ',
        description: '  Perfil local  ',
        permissionCodes: ['patients.read', 'medical_records.access_all'],
      })

    createResponse.assertStatus(201)
    const created = createResponse.body().role
    assert.match(created.code, /^custom_[0-9a-f]{32}$/)
    assert.equal(created.clinicId, clinic.id)
    assert.isFalse(created.isSystem)
    assert.isTrue(created.isActive)
    assert.equal(created.name, 'Supervisão assistencial')
    assert.deepEqual(
      created.permissions.map((permission: { code: string }) => permission.code).sort(),
      ['medical_records.access_all', 'patients.read']
    )

    const duplicateResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/roles`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        name: ' supervisão assistencial ',
        permissionCodes: [],
      })
    duplicateResponse.assertStatus(409)

    const listResponse = await client
      .get(`/api/v1/clinics/${clinic.id}/roles`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
    listResponse.assertStatus(200)
    assert.lengthOf(listResponse.body().data, 4)

    const showResponse = await client
      .get(`/api/v1/clinics/${clinic.id}/roles/${created.id}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
    showResponse.assertStatus(200)

    const updateResponse = await client
      .patch(`/api/v1/clinics/${clinic.id}/roles/${created.id}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        name: 'Supervisão atualizada',
        description: null,
        permissionCodes: ['patients.read'],
      })
    updateResponse.assertStatus(200)
    assert.equal(updateResponse.body().role.name, 'Supervisão atualizada')
    assert.deepEqual(
      updateResponse.body().role.permissions.map((permission: { code: string }) => permission.code),
      ['patients.read']
    )

    for (const isActive of [false, true]) {
      const statusResponse = await client
        .patch(`/api/v1/clinics/${clinic.id}/roles/${created.id}/status`)
        .header('Accept', 'application/json')
        .header('Authorization', `Bearer ${token}`)
        .json({ isActive })
      statusResponse.assertStatus(200)
      assert.equal(statusResponse.body().role.isActive, isActive)

      if (!isActive) {
        const managedResponse = await client
          .get(`/api/v1/clinics/${clinic.id}/roles`)
          .header('Accept', 'application/json')
          .header('Authorization', `Bearer ${token}`)
        managedResponse.assertStatus(200)
        assert.isFalse(
          managedResponse.body().data.find((role: { id: string }) => role.id === created.id)
            .isActive
        )

        const assignableResponse = await client
          .get(`/api/v1/clinics/${clinic.id}/roles/assignable`)
          .header('Accept', 'application/json')
          .header('Authorization', `Bearer ${token}`)
        assignableResponse.assertStatus(200)
        assert.notInclude(
          assignableResponse.body().data.map((role: { id: string }) => role.id),
          created.id
        )
      }
    }
  })

  test('keeps system roles immutable and their normalized names reserved', async ({ client }) => {
    const { clinic, token } = await setupClinicAdmin('Clínica Imutável')
    const doctor = await Role.findByOrFail('code', 'doctor')

    const updateResponse = await client
      .patch(`/api/v1/clinics/${clinic.id}/roles/${doctor.id}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({ name: 'Outro nome', permissionCodes: [] })
    updateResponse.assertStatus(409)

    const statusResponse = await client
      .patch(`/api/v1/clinics/${clinic.id}/roles/${doctor.id}/status`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({ isActive: false })
    statusResponse.assertStatus(409)

    const reservedNameResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/roles`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({ name: '  MÉDICO ', permissionCodes: [] })
    reservedNameResponse.assertStatus(409)
  })

  test('isolates custom role reads and mutations between clinics', async ({ client, assert }) => {
    const first = await setupClinicAdmin('Clínica A')
    const second = await setupClinicAdmin('Clínica B')
    const role = await createCustomRole({
      clinicId: first.clinic.id,
      name: 'Exclusivo A',
      permissionCodes: ['patients.read'],
    })

    const secondList = await client
      .get(`/api/v1/clinics/${second.clinic.id}/roles`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${second.token}`)
    secondList.assertStatus(200)
    assert.notInclude(
      secondList.body().data.map((candidate: { id: string }) => candidate.id),
      role.id
    )

    const showResponse = await client
      .get(`/api/v1/clinics/${second.clinic.id}/roles/${role.id}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${second.token}`)
    showResponse.assertStatus(404)

    const updateResponse = await client
      .patch(`/api/v1/clinics/${second.clinic.id}/roles/${role.id}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${second.token}`)
      .json({ name: 'Tentativa', permissionCodes: [] })
    updateResponse.assertStatus(404)
  })

  test('exposes one canonical assignable permission catalog without global-only permissions', async ({
    client,
    assert,
  }) => {
    const { clinic, token } = await setupClinicAdmin('Clínica Catálogo')
    const response = await client
      .get(`/api/v1/clinics/${clinic.id}/roles/permissions`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    response.assertStatus(200)
    const codes = response.body().data.map((permission: { code: string }) => permission.code)
    assert.includeMembers(codes, [
      'roles.manage',
      'users.assign_role',
      'medical_records.access_all',
    ])
    assert.notIncludeMembers(codes, [
      'clinics.create',
      'clinics.update',
      'clinics.deactivate',
      'users.update',
      '*',
    ])
  })

  test('requires roles.manage without authorizing by role name', async ({ client }) => {
    const clinic = await ClinicFactory.create()
    const doctor = await UserFactory.create()
    await createMembership({ user: doctor, clinic, roleCode: 'doctor' })
    const token = await createBearerToken(doctor)

    const response = await client
      .get(`/api/v1/clinics/${clinic.id}/roles`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
    response.assertStatus(403)
  })

  test('blocks privilege escalation, wildcard, and non-assignable permissions', async ({
    client,
  }) => {
    const clinic = await ClinicFactory.create()
    const actor = await UserFactory.create()
    const actorRole = await createCustomRole({
      clinicId: clinic.id,
      name: 'Gestor limitado',
      permissionCodes: ['roles.manage', 'users.assign_role'],
    })
    await createMembership({ user: actor, clinic, roleCode: 'doctor' }).then(async (membership) => {
      membership.roleId = actorRole.id
      await membership.save()
    })
    const token = await createBearerToken(actor)

    for (const permissionCode of ['patients.read', '*', 'clinics.create']) {
      const response = await client
        .post(`/api/v1/clinics/${clinic.id}/roles`)
        .header('Accept', 'application/json')
        .header('Authorization', `Bearer ${token}`)
        .json({ name: `Perfil ${permissionCode}`, permissionCodes: [permissionCode] })
      response.assertStatus(permissionCode === 'patients.read' ? 403 : 422)
    }
  })

  test('supports roleId and legacy system roleCode with strict selector compatibility', async ({
    client,
    assert,
  }) => {
    const { clinic, token } = await setupClinicAdmin('Clínica Compatível')
    const customRole = await createCustomRole({
      clinicId: clinic.id,
      name: 'Atendimento customizado',
      permissionCodes: ['patients.read'],
    })
    const systemRole = await Role.findByOrFail('code', 'receptionist')

    const payloads = [
      { roleId: customRole.id, email: 'custom.role@example.test', expected: customRole.id },
      { roleId: systemRole.id, email: 'system.id@example.test', expected: systemRole.id },
      { roleCode: 'receptionist', email: 'legacy.code@example.test', expected: systemRole.id },
    ]

    for (const payload of payloads) {
      const response = await client
        .post(`/api/v1/clinics/${clinic.id}/members`)
        .header('Accept', 'application/json')
        .header('Authorization', `Bearer ${token}`)
        .json({
          fullName: 'Membro Compatível',
          email: payload.email,
          password: 'InitialPassword!123',
          ...(payload.roleId ? { roleId: payload.roleId } : { roleCode: payload.roleCode }),
        })
      response.assertStatus(201)
      assert.equal(response.body().membership.roleId, payload.expected)
    }

    for (const selector of [
      {},
      { roleId: customRole.id, roleCode: 'doctor' },
      { roleCode: customRole.code },
    ]) {
      const response = await client
        .post(`/api/v1/clinics/${clinic.id}/members`)
        .header('Accept', 'application/json')
        .header('Authorization', `Bearer ${token}`)
        .json({
          fullName: 'Membro Inválido',
          email: `${randomUUID()}@example.test`,
          password: 'InitialPassword!123',
          ...selector,
        })
      response.assertStatus(422)
    }
  })

  test('rejects inactive and cross-clinic custom roles during assignment', async ({ client }) => {
    const first = await setupClinicAdmin('Clínica de Atribuição')
    const secondClinic = await ClinicFactory.create()
    const inactiveRole = await createCustomRole({
      clinicId: first.clinic.id,
      name: 'Inativo',
      permissionCodes: [],
      isActive: false,
    })
    const foreignRole = await createCustomRole({
      clinicId: secondClinic.id,
      name: 'Outra clínica',
      permissionCodes: [],
    })

    for (const roleId of [inactiveRole.id, foreignRole.id]) {
      const response = await client
        .post(`/api/v1/clinics/${first.clinic.id}/members`)
        .header('Accept', 'application/json')
        .header('Authorization', `Bearer ${first.token}`)
        .json({
          fullName: 'Membro Negado',
          email: `${randomUUID()}@example.test`,
          password: 'InitialPassword!123',
          roleId,
        })
      response.assertStatus(404)
    }
  })

  test('validates the full permission set when assigning an existing role and on self-assignment', async ({
    client,
    assert,
  }) => {
    const clinic = await ClinicFactory.create()
    const actor = await UserFactory.create()
    const actorRole = await createCustomRole({
      clinicId: clinic.id,
      name: 'Atribuidor limitado',
      permissionCodes: ['users.assign_role'],
    })
    const actorMembership = await createMembership({
      user: actor,
      clinic,
      roleCode: 'doctor',
    })
    actorMembership.roleId = actorRole.id
    await actorMembership.save()
    const excessiveRole = await createCustomRole({
      clinicId: clinic.id,
      name: 'Mais privilegiado',
      permissionCodes: ['users.assign_role', 'patients.read'],
    })
    const equivalentRole = await createCustomRole({
      clinicId: clinic.id,
      name: 'Equivalente',
      permissionCodes: ['users.assign_role'],
    })
    const target = await UserFactory.create()
    const targetMembership = await createMembership({
      user: target,
      clinic,
      roleCode: 'receptionist',
    })
    const token = await createBearerToken(actor)

    const escalation = await client
      .patch(`/api/v1/clinics/${clinic.id}/members/${targetMembership.id}/role`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({ roleId: excessiveRole.id })
    escalation.assertStatus(403)

    const selfAssignment = await client
      .patch(`/api/v1/clinics/${clinic.id}/members/${actorMembership.id}/role`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({ roleId: equivalentRole.id })
    selfAssignment.assertStatus(200)
    assert.equal(selfAssignment.body().membership.roleId, equivalentRole.id)
  })

  test('blocks higher-privilege reactivation without restoring membership access', async ({
    client,
    assert,
  }) => {
    const clinic = await ClinicFactory.create()
    const actor = await UserFactory.create()
    const actorRole = await createCustomRole({
      clinicId: clinic.id,
      name: 'Gestor de status limitado',
      permissionCodes: ['roles.manage'],
    })
    const actorMembership = await createMembership({ user: actor, clinic, roleCode: 'doctor' })
    actorMembership.roleId = actorRole.id
    await actorMembership.save()

    const privilegedRole = await createCustomRole({
      clinicId: clinic.id,
      name: 'Atribuidor inativo',
      permissionCodes: ['roles.manage', 'users.assign_role'],
      isActive: false,
    })
    const assignedUser = await UserFactory.create()
    const assignedMembership = await createMembership({
      user: assignedUser,
      clinic,
      roleCode: 'doctor',
    })
    assignedMembership.roleId = privilegedRole.id
    await assignedMembership.save()

    const actorToken = await createBearerToken(actor)
    const assignedToken = await createBearerToken(assignedUser)
    const denied = await client
      .patch(`/api/v1/clinics/${clinic.id}/roles/${privilegedRole.id}/status`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${actorToken}`)
      .json({ isActive: true })
    denied.assertStatus(403)

    await privilegedRole.refresh()
    assert.isFalse(privilegedRole.isActive)

    const membershipStillDenied = await client
      .get(`/api/v1/clinics/${clinic.id}/roles/assignable`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${assignedToken}`)
    membershipStillDenied.assertStatus(403)

    const globalAdmin = await UserFactory.apply('globalAdmin').create()
    const globalAdminToken = await createBearerToken(globalAdmin)
    const allowed = await client
      .patch(`/api/v1/clinics/${clinic.id}/roles/${privilegedRole.id}/status`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${globalAdminToken}`)
      .json({ isActive: true })
    allowed.assertStatus(200)
    assert.isTrue(allowed.body().role.isActive)
  })

  test('allows valid-subset reactivation without blocking higher-privilege deactivation', async ({
    client,
    assert,
  }) => {
    const clinic = await ClinicFactory.create()
    const actor = await UserFactory.create()
    const actorRole = await createCustomRole({
      clinicId: clinic.id,
      name: 'Gestor de status',
      permissionCodes: ['roles.manage', 'users.assign_role'],
    })
    const actorMembership = await createMembership({ user: actor, clinic, roleCode: 'doctor' })
    actorMembership.roleId = actorRole.id
    await actorMembership.save()
    const actorToken = await createBearerToken(actor)

    const subsetRole = await createCustomRole({
      clinicId: clinic.id,
      name: 'Subset inativo',
      permissionCodes: ['roles.manage'],
      isActive: false,
    })
    const reactivated = await client
      .patch(`/api/v1/clinics/${clinic.id}/roles/${subsetRole.id}/status`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${actorToken}`)
      .json({ isActive: true })
    reactivated.assertStatus(200)
    assert.isTrue(reactivated.body().role.isActive)

    const limitedActor = await UserFactory.create()
    const limitedActorRole = await createCustomRole({
      clinicId: clinic.id,
      name: 'Revogador limitado',
      permissionCodes: ['roles.manage'],
    })
    const limitedMembership = await createMembership({
      user: limitedActor,
      clinic,
      roleCode: 'doctor',
    })
    limitedMembership.roleId = limitedActorRole.id
    await limitedMembership.save()
    const limitedToken = await createBearerToken(limitedActor)

    const morePrivilegedRole = await createCustomRole({
      clinicId: clinic.id,
      name: 'Mais privilegiado ativo',
      permissionCodes: ['roles.manage', 'users.assign_role'],
    })
    const deactivated = await client
      .patch(`/api/v1/clinics/${clinic.id}/roles/${morePrivilegedRole.id}/status`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${limitedToken}`)
      .json({ isActive: false })
    deactivated.assertStatus(200)
    assert.isFalse(deactivated.body().role.isActive)
  })

  test('applies permission sync and role activity on the next authorization request', async ({
    client,
  }) => {
    const { clinic, token: adminToken } = await setupClinicAdmin('Clínica Dinâmica')
    const user = await UserFactory.create()
    const role = await createCustomRole({
      clinicId: clinic.id,
      name: 'Leitor dinâmico',
      permissionCodes: ['patients.read'],
    })
    const membership = await createMembership({ user, clinic, roleCode: 'doctor' })
    membership.roleId = role.id
    await membership.save()
    const token = await createBearerToken(user)

    const allowed = await client
      .get(`/api/v1/clinics/${clinic.id}/patients`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
    allowed.assertStatus(200)

    const update = await client
      .patch(`/api/v1/clinics/${clinic.id}/roles/${role.id}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${adminToken}`)
      .json({ name: role.name, permissionCodes: [] })
    update.assertStatus(200)

    const permissionRemoved = await client
      .get(`/api/v1/clinics/${clinic.id}/patients`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
    permissionRemoved.assertStatus(403)

    const patientsReadPermission = await Permission.findByOrFail('code', 'patients.read')
    await role.related('permissions').sync([patientsReadPermission.id])
    role.isActive = false
    await role.save()

    const inactiveRole = await client
      .get(`/api/v1/clinics/${clinic.id}/patients`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
    inactiveRole.assertStatus(403)

    role.isActive = true
    await role.save()
    membership.isActive = false
    await membership.save()

    const inactiveMembership = await client
      .get(`/api/v1/clinics/${clinic.id}/patients`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
    inactiveMembership.assertStatus(403)

    membership.isActive = true
    await membership.save()
    clinic.isActive = false
    await clinic.save()

    const inactiveClinic = await client
      .get(`/api/v1/clinics/${clinic.id}/patients`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
    inactiveClinic.assertStatus(403)
  })

  test('preserves D2 unless access_all is granted alongside the operational permission', async ({
    client,
  }) => {
    const clinic = await ClinicFactory.create()
    const patient = await PatientFactory.create()
    await PatientClinicFactory.merge({ patientId: patient.id, clinicId: clinic.id }).create()
    await MedicalRecordFactory.merge({ patientId: patient.id }).create()

    const relatedPermissionSets = [
      { codes: ['patients.read', 'medical_records.read'], expected: 403 },
      {
        codes: ['patients.read', 'medical_records.read', 'medical_records.access_all'],
        expected: 200,
      },
      { codes: ['patients.read', 'medical_records.access_all'], expected: 403 },
    ]

    for (const [index, scenario] of relatedPermissionSets.entries()) {
      const user = await UserFactory.create()
      const role = await createCustomRole({
        clinicId: clinic.id,
        name: `Prontuário ${index}`,
        permissionCodes: scenario.codes,
      })
      const membership = await createMembership({ user, clinic, roleCode: 'doctor' })
      membership.roleId = role.id
      await membership.save()
      const token = await createBearerToken(user)

      const response = await client
        .get(
          `/api/v1/clinics/${clinic.id}/patients/${patient.id}/medical-record` +
            '?purposeCode=patient_care'
        )
        .header('Accept', 'application/json')
        .header('Authorization', `Bearer ${token}`)
      response.assertStatus(scenario.expected)
    }
  })

  test('allows Global Admin to grant assignable permissions but never wildcard or global-only codes', async ({
    client,
    assert,
  }) => {
    const clinic = await ClinicFactory.create()
    const globalAdmin = await UserFactory.apply('globalAdmin').create()
    const token = await createBearerToken(globalAdmin)

    const allowed = await client
      .post(`/api/v1/clinics/${clinic.id}/roles`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        name: 'Acesso clínico amplo',
        permissionCodes: ['medical_records.read', 'medical_records.access_all'],
      })
    allowed.assertStatus(201)
    assert.isTrue(globalAdmin.isGlobalAdmin)

    for (const permissionCode of ['*', 'users.update']) {
      const denied = await client
        .post(`/api/v1/clinics/${clinic.id}/roles`)
        .header('Accept', 'application/json')
        .header('Authorization', `Bearer ${token}`)
        .json({ name: `Negado ${permissionCode}`, permissionCodes: [permissionCode] })
      denied.assertStatus(422)
    }
  })
})
