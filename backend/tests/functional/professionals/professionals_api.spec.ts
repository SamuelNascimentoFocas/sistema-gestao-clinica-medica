import { UserFactory } from '#database/factories/user_factory'
import { ClinicFactory } from '#database/factories/clinic_factory'
import { createBearerToken as createToken } from '#tests/helpers/auth'
import { createMembership } from '#tests/helpers/membership'
import { test } from '@japa/runner'
import Professional from '#models/professional'
import ClinicProfessional from '#models/clinic_professional'
import Role from '#models/role'
import UserClinicRole from '#models/user_clinic_role'
import { truncateClinicSchemaTables } from '../../helpers/database.js'
import { seedAuthorizationCatalog } from '../../../database/seeders/authorization_catalog_seeder.js'

test.group('Professionals API', (group) => {
  group.each.setup(async () => {
    await truncateClinicSchemaTables()
    await seedAuthorizationCatalog()

    return async () => {
      await truncateClinicSchemaTables()
    }
  })

  test('requires authentication and professional permissions', async ({ client }) => {
    const clinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica Protegida',
    }).create()

    const unauthenticatedResponse = await client
      .get(`/api/v1/clinics/${clinic.id}/professionals`)
      .header('Accept', 'application/json')

    unauthenticatedResponse.assertStatus(401)

    const receptionist = await UserFactory.merge({
      fullName: 'Usuário de Profissionais',
      email: 'professional.receptionist@example.com',
    }).create()

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
    const clinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica de Profissionais',
    }).create()

    const clinicAdmin = await UserFactory.merge({
      fullName: 'Usuário de Profissionais',
      email: 'professional.admin@example.com',
    }).create()

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
    const firstClinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Primeira Clínica',
    }).create()
    const secondClinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Segunda Clínica',
    }).create()

    const clinicAdmin = await UserFactory.merge({
      fullName: 'Usuário de Profissionais',
      email: 'shared.professional.admin@example.com',
    }).create()

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
    const firstClinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica de Validação 1',
    }).create()
    const secondClinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica de Validação 2',
    }).create()

    const clinicAdmin = await UserFactory.merge({
      fullName: 'Usuário de Profissionais',
      email: 'validation.professional.admin@example.com',
    }).create()

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

    const doctorUser = await UserFactory.merge({
      fullName: 'Usuário de Profissionais',
      email: 'linked.doctor@example.com',
    }).create()

    await createMembership({
      user: doctorUser,
      clinic: firstClinic,
      roleCode: 'doctor',
    })

    const receptionistUser = await UserFactory.merge({
      fullName: 'Usuário de Profissionais',
      email: 'linked.receptionist@example.com',
    }).create()

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

    const nonDoctorRoleResponse = await client
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

    nonDoctorRoleResponse.assertStatus(201)
    assert.equal(
      nonDoctorRoleResponse.body().professionalLink.professional.user.id,
      receptionistUser.id
    )

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

    assert.lengthOf(professionals, 2)
    assert.lengthOf(links, 2)
  })

  test('links custom-role accounts without granting permissions and preserves scope checks', async ({
    client,
    assert,
  }) => {
    const clinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica de Perfil Personalizado',
    }).create()
    const otherClinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Outra Clínica de Perfil Personalizado',
    }).create()

    const clinicAdmin = await UserFactory.merge({
      fullName: 'Administrador de Profissionais Customizados',
      email: 'custom.professional.admin@example.com',
    }).create()
    await createMembership({ user: clinicAdmin, clinic, roleCode: 'clinic_admin' })

    const customRole = await Role.create({
      code: 'custom_professional_identity',
      name: 'Profissional personalizado',
      description: 'Perfil sem permissões operacionais',
      clinicId: clinic.id,
      isSystem: false,
      isActive: true,
    })
    assert.notEqual(customRole.code, 'doctor')

    const customRoleUser = await UserFactory.merge({
      fullName: 'Conta com Perfil Personalizado',
      email: 'custom.professional.user@example.com',
    }).create()
    await UserClinicRole.create({
      userId: customRoleUser.id,
      clinicId: clinic.id,
      roleId: customRole.id,
      isActive: true,
    })

    const token = await createToken(clinicAdmin)
    const linkResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/professionals`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Dra. Perfil Personalizado',
        crmNumber: '77770',
        crmState: 'MG',
        specialty: 'Clínica Médica',
        userId: customRoleUser.id,
      })

    linkResponse.assertStatus(201)
    assert.equal(linkResponse.body().professionalLink.professional.user.id, customRoleUser.id)

    const customRoleUserToken = await createToken(customRoleUser)
    const unauthorizedResponse = await client
      .get(`/api/v1/clinics/${clinic.id}/professionals`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${customRoleUserToken}`)

    unauthorizedResponse.assertStatus(403)

    const otherClinicUser = await UserFactory.merge({
      fullName: 'Conta de Outra Clínica',
      email: 'other.clinic.professional@example.com',
    }).create()
    await createMembership({ user: otherClinicUser, clinic: otherClinic, roleCode: 'doctor' })

    const crossClinicResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/professionals`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Dr. Outra Clínica',
        crmNumber: '77771',
        crmState: 'MG',
        specialty: 'Cardiologia',
        userId: otherClinicUser.id,
      })

    crossClinicResponse.assertStatus(409)
    crossClinicResponse.assertBodyContains({
      message: 'A conta informada não possui vínculo ativo neste consultório',
    })

    const inactiveUser = await UserFactory.merge({
      fullName: 'Conta Globalmente Inativa',
      email: 'inactive.custom.professional@example.com',
      isActive: false,
    }).create()
    await UserClinicRole.create({
      userId: inactiveUser.id,
      clinicId: clinic.id,
      roleId: customRole.id,
      isActive: true,
    })

    const inactiveUserResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/professionals`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Dra. Conta Inativa',
        crmNumber: '77772',
        crmState: 'MG',
        specialty: 'Neurologia',
        userId: inactiveUser.id,
      })

    inactiveUserResponse.assertStatus(409)

    const inactiveMembershipUser = await UserFactory.merge({
      fullName: 'Conta com Vínculo Inativo',
      email: 'inactive.membership.professional@example.com',
    }).create()
    await UserClinicRole.create({
      userId: inactiveMembershipUser.id,
      clinicId: clinic.id,
      roleId: customRole.id,
      isActive: false,
    })

    const inactiveMembershipResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/professionals`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Dr. Vínculo Inativo',
        crmNumber: '77773',
        crmState: 'MG',
        specialty: 'Pediatria',
        userId: inactiveMembershipUser.id,
      })

    inactiveMembershipResponse.assertStatus(409)

    const inactiveClinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica Inativa de Profissionais',
      isActive: false,
    }).create()
    const inactiveClinicAdmin = await UserFactory.merge({
      fullName: 'Administrador da Clínica Inativa',
      email: 'inactive.clinic.professional.admin@example.com',
    }).create()
    const inactiveClinicCandidate = await UserFactory.merge({
      fullName: 'Conta da Clínica Inativa',
      email: 'inactive.clinic.professional.user@example.com',
    }).create()
    await createMembership({
      user: inactiveClinicAdmin,
      clinic: inactiveClinic,
      roleCode: 'clinic_admin',
    })
    await createMembership({
      user: inactiveClinicCandidate,
      clinic: inactiveClinic,
      roleCode: 'doctor',
    })

    const inactiveClinicToken = await createToken(inactiveClinicAdmin)
    const inactiveClinicResponse = await client
      .post(`/api/v1/clinics/${inactiveClinic.id}/professionals`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${inactiveClinicToken}`)
      .json({
        fullName: 'Dra. Clínica Inativa',
        crmNumber: '77774',
        crmState: 'MG',
        specialty: 'Dermatologia',
        userId: inactiveClinicCandidate.id,
      })

    inactiveClinicResponse.assertStatus(403)
  })
})
