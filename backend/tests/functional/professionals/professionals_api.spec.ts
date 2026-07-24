import { test } from '@japa/runner'
import User from '#models/user'
import Clinic from '#models/clinic'
import Role from '#models/role'
import Professional from '#models/professional'
import ClinicProfessional from '#models/clinic_professional'
import UserClinicRole from '#models/user_clinic_role'
import { truncateClinicSchemaTables } from '../../helpers/database.js'
import { seedAuthorizationCatalog } from '../../../database/seeders/authorization_catalog_seeder.js'

type RoleCode = 'clinic_admin' | 'receptionist' | 'doctor'

async function createUser({
  email,
  isActive = true,
  isGlobalAdmin = false,
}: {
  email: string
  isActive?: boolean
  isGlobalAdmin?: boolean
}) {
  return User.create({
    fullName: 'Usuário de Profissionais',
    email,
    emailNormalized: email.toLowerCase(),
    passwordHash: 'TestPassword!123',
    isGlobalAdmin,
    isActive,
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
    timezone: 'America/Sao_Paulo',
    isActive: true,
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
  roleCode: RoleCode
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

async function createToken(user: User) {
  const token = await User.accessTokens.create(user)
  return token.value!.release()
}

test.group('Professionals API', (group) => {
  group.each.setup(async () => {
    await truncateClinicSchemaTables()
    await seedAuthorizationCatalog()

    return async () => {
      await truncateClinicSchemaTables()
    }
  })

  test('requires authentication and professional permissions', async ({ client }) => {
    const clinic = await createClinic('Clínica Protegida')

    const unauthenticatedResponse = await client
      .get(`/api/v1/clinics/${clinic.id}/professionals`)
      .header('Accept', 'application/json')

    unauthenticatedResponse.assertStatus(401)

    const receptionist = await createUser({
      email: 'professional.receptionist@example.com',
    })

    await createMembership({
      user: receptionist,
      clinic,
      roleCode: 'receptionist',
    })

    const token = await createToken(receptionist)

    const readResponse = await client
      .get(`/api/v1/clinics/${clinic.id}/professionals`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    readResponse.assertStatus(200)

    const createResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/professionals`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Profissional Bloqueado',
        crmNumber: '10000',
        crmState: 'MG',
        specialty: 'Clínica Médica',
      })

    createResponse.assertStatus(403)
  })

  test('creates, lists, shows and updates a clinic professional', async ({ client, assert }) => {
    const clinic = await createClinic('Clínica de Profissionais')

    const clinicAdmin = await createUser({
      email: 'professional.admin@example.com',
    })

    await createMembership({
      user: clinicAdmin,
      clinic,
      roleCode: 'clinic_admin',
    })

    const token = await createToken(clinicAdmin)

    const createResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/professionals`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Dra. Helena Martins',
        crmNumber: '12345',
        crmState: 'mg',
        specialty: 'Clínica Médica',
        phone: '38999990000',
        email: 'HELENA@example.com',
        localCode: 'MED-001',
        defaultAppointmentDurationMinutes: 45,
        acceptsAppointments: false,
      })

    createResponse.assertStatus(201)

    const createdLink = createResponse.body().professionalLink

    assert.equal(createdLink.professional.fullName, 'Dra. Helena Martins')
    assert.equal(createdLink.professional.crmNumber, '12345')
    assert.equal(createdLink.professional.crmState, 'MG')
    assert.equal(createdLink.professional.email, 'helena@example.com')
    assert.equal(createdLink.localCode, 'MED-001')
    assert.equal(createdLink.defaultAppointmentDurationMinutes, 45)
    assert.isFalse(createdLink.acceptsAppointments)
    assert.isTrue(createdLink.isActive)
    assert.lengthOf(createdLink.weeklyAvailabilities, 0)
    assert.lengthOf(createdLink.scheduleBlocks, 0)

    const professionalId = createdLink.professional.id

    const listResponse = await client
      .get(`/api/v1/clinics/${clinic.id}/professionals?search=Helena`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    listResponse.assertStatus(200)
    assert.lengthOf(listResponse.body().data, 1)

    const showResponse = await client
      .get(`/api/v1/clinics/${clinic.id}/professionals/${professionalId}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    showResponse.assertStatus(200)
    assert.equal(showResponse.body().professionalLink.professional.id, professionalId)

    const updateResponse = await client
      .patch(`/api/v1/clinics/${clinic.id}/professionals/${professionalId}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        localCode: 'MED-002',
        defaultAppointmentDurationMinutes: 60,
        acceptsAppointments: true,
      })

    updateResponse.assertStatus(200)

    const updatedLink = updateResponse.body().professionalLink

    assert.equal(updatedLink.localCode, 'MED-002')
    assert.equal(updatedLink.defaultAppointmentDurationMinutes, 60)
    assert.isTrue(updatedLink.acceptsAppointments)

    const statusResponse = await client
      .patch(`/api/v1/clinics/${clinic.id}/professionals/${professionalId}/status`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        isActive: false,
      })

    statusResponse.assertStatus(200)
    assert.isFalse(statusResponse.body().professionalLink.isActive)

    const professionals = await Professional.all()
    const links = await ClinicProfessional.all()

    assert.lengthOf(professionals, 1)
    assert.lengthOf(links, 1)
  })

  test('links one global professional to multiple clinics', async ({ client, assert }) => {
    const firstClinic = await createClinic('Primeira Clínica')
    const secondClinic = await createClinic('Segunda Clínica')

    const clinicAdmin = await createUser({
      email: 'shared.professional.admin@example.com',
    })

    await createMembership({
      user: clinicAdmin,
      clinic: firstClinic,
      roleCode: 'clinic_admin',
    })

    await createMembership({
      user: clinicAdmin,
      clinic: secondClinic,
      roleCode: 'clinic_admin',
    })

    const token = await createToken(clinicAdmin)

    const firstResponse = await client
      .post(`/api/v1/clinics/${firstClinic.id}/professionals`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Dr. Profissional Compartilhado',
        crmNumber: '22222',
        crmState: 'MG',
        specialty: 'Cardiologia',
        localCode: 'CARD-A',
      })

    firstResponse.assertStatus(201)

    const secondResponse = await client
      .post(`/api/v1/clinics/${secondClinic.id}/professionals`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Dr. Profissional Compartilhado',
        crmNumber: '22222',
        crmState: 'MG',
        specialty: 'Cardiologia',
        localCode: 'CARD-B',
      })

    secondResponse.assertStatus(201)

    const firstLink = firstResponse.body().professionalLink
    const secondLink = secondResponse.body().professionalLink

    assert.equal(firstLink.professional.id, secondLink.professional.id)
    assert.notEqual(firstLink.id, secondLink.id)
    assert.equal(firstLink.localCode, 'CARD-A')
    assert.equal(secondLink.localCode, 'CARD-B')

    const professionals = await Professional.all()
    const links = await ClinicProfessional.all()

    assert.lengthOf(professionals, 1)
    assert.lengthOf(links, 2)

    const firstUpdateResponse = await client
      .patch(`/api/v1/clinics/${firstClinic.id}/professionals/${firstLink.professional.id}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        localCode: 'CARD-A-UPDATED',
        defaultAppointmentDurationMinutes: 50,
      })

    firstUpdateResponse.assertStatus(200)

    const unchangedSecondLink = await ClinicProfessional.query()
      .where('id', secondLink.id)
      .firstOrFail()

    assert.equal(unchangedSecondLink.localCode, 'CARD-B')
    assert.equal(unchangedSecondLink.defaultAppointmentDurationMinutes, 30)
  })

  test('validates user links, duplicate data and professional identity', async ({
    client,
    assert,
  }) => {
    const firstClinic = await createClinic('Clínica de Validação 1')
    const secondClinic = await createClinic('Clínica de Validação 2')

    const clinicAdmin = await createUser({
      email: 'validation.professional.admin@example.com',
    })

    await createMembership({
      user: clinicAdmin,
      clinic: firstClinic,
      roleCode: 'clinic_admin',
    })

    await createMembership({
      user: clinicAdmin,
      clinic: secondClinic,
      roleCode: 'clinic_admin',
    })

    const doctorUser = await createUser({
      email: 'linked.doctor@example.com',
    })

    await createMembership({
      user: doctorUser,
      clinic: firstClinic,
      roleCode: 'doctor',
    })

    const receptionistUser = await createUser({
      email: 'linked.receptionist@example.com',
    })

    await createMembership({
      user: receptionistUser,
      clinic: firstClinic,
      roleCode: 'receptionist',
    })

    const token = await createToken(clinicAdmin)

    const firstResponse = await client
      .post(`/api/v1/clinics/${firstClinic.id}/professionals`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Dr. Médico Vinculado',
        crmNumber: '33333',
        crmState: 'MG',
        specialty: 'Ortopedia',
        userId: doctorUser.id,
        localCode: 'ORT-001',
      })

    firstResponse.assertStatus(201)

    assert.equal(firstResponse.body().professionalLink.professional.user.id, doctorUser.id)

    const duplicateUserResponse = await client
      .post(`/api/v1/clinics/${firstClinic.id}/professionals`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Outro Profissional',
        crmNumber: '44444',
        crmState: 'MG',
        specialty: 'Neurologia',
        userId: doctorUser.id,
      })

    duplicateUserResponse.assertStatus(409)
    duplicateUserResponse.assertBodyContains({
      message: 'Esta conta de usuário já está vinculada a outro profissional',
    })

    const invalidRoleResponse = await client
      .post(`/api/v1/clinics/${firstClinic.id}/professionals`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Profissional com Conta Inválida',
        crmNumber: '55555',
        crmState: 'MG',
        specialty: 'Pediatria',
        userId: receptionistUser.id,
      })

    invalidRoleResponse.assertStatus(409)
    invalidRoleResponse.assertBodyContains({
      message: 'A conta informada não possui vínculo médico ativo neste consultório',
    })

    const duplicateLinkResponse = await client
      .post(`/api/v1/clinics/${firstClinic.id}/professionals`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Dr. Médico Vinculado',
        crmNumber: '33333',
        crmState: 'MG',
        specialty: 'Ortopedia',
        userId: doctorUser.id,
      })

    duplicateLinkResponse.assertStatus(409)

    const conflictingIdentityResponse = await client
      .post(`/api/v1/clinics/${secondClinic.id}/professionals`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Nome Diferente',
        crmNumber: '33333',
        crmState: 'MG',
        specialty: 'Ortopedia',
      })

    conflictingIdentityResponse.assertStatus(409)
    conflictingIdentityResponse.assertBodyContains({
      message: 'O CRM informado pertence a um profissional com outro nome',
    })

    const duplicateLocalCodeResponse = await client
      .post(`/api/v1/clinics/${firstClinic.id}/professionals`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Segundo Médico',
        crmNumber: '66666',
        crmState: 'MG',
        specialty: 'Dermatologia',
        localCode: 'ORT-001',
      })

    duplicateLocalCodeResponse.assertStatus(409)

    const invalidResponse = await client
      .post(`/api/v1/clinics/${firstClinic.id}/professionals`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'A',
        crmNumber: '',
        crmState: 'Minas Gerais',
        specialty: 'X',
        defaultAppointmentDurationMinutes: 3,
      })

    invalidResponse.assertStatus(422)

    const professionals = await Professional.all()
    const links = await ClinicProfessional.all()

    assert.lengthOf(professionals, 1)
    assert.lengthOf(links, 1)
  })
})
