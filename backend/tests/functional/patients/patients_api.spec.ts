import { UserFactory } from '#database/factories/user_factory'
import { ClinicFactory } from '#database/factories/clinic_factory'
import { createBearerToken as createToken } from '#tests/helpers/auth'
import { createMembership } from '#tests/helpers/membership'
import { test } from '@japa/runner'
import Patient from '#models/patient'
import PatientClinic from '#models/patient_clinic'
import MedicalRecord from '#models/medical_record'
import { truncateClinicSchemaTables } from '../../helpers/database.js'
import { seedAuthorizationCatalog } from '../../../database/seeders/authorization_catalog_seeder.js'

test.group('Patients API', (group) => {
  group.each.setup(async () => {
    await truncateClinicSchemaTables()
    await seedAuthorizationCatalog()

    return async () => {
      await truncateClinicSchemaTables()
    }
  })

  test('requires authentication and clinic permissions', async ({ client }) => {
    const clinic = await ClinicFactory.merge({ name: 'Clínica Protegida' }).create()

    const unauthenticatedResponse = await client
      .get(`/api/v1/clinics/${clinic.id}/patients`)
      .header('Accept', 'application/json')

    unauthenticatedResponse.assertStatus(401)

    const doctor = await UserFactory.merge({
      fullName: 'Usuário de Pacientes',
      email: 'patient.doctor@example.com',
    }).create()

    await createMembership({
      user: doctor,
      clinic,
      roleCode: 'doctor',
    })

    const token = await createToken(doctor)

    const readResponse = await client
      .get(`/api/v1/clinics/${clinic.id}/patients`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    readResponse.assertStatus(200)

    const createResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/patients`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Paciente Bloqueado',
        birthDate: '1990-05-10',
      })

    createResponse.assertStatus(403)
  })

  test('creates one global patient and links it to multiple clinics', async ({
    client,
    assert,
  }) => {
    const firstClinic = await ClinicFactory.merge({ name: 'Primeira Clínica' }).create()
    const secondClinic = await ClinicFactory.merge({ name: 'Segunda Clínica' }).create()
    const receptionist = await UserFactory.merge({
      fullName: 'Usuário de Pacientes',
      email: 'patient.receptionist@example.com',
    }).create()

    await createMembership({
      user: receptionist,
      clinic: firstClinic,
      roleCode: 'receptionist',
    })

    await createMembership({
      user: receptionist,
      clinic: secondClinic,
      roleCode: 'receptionist',
    })

    const token = await createToken(receptionist)

    const firstResponse = await client
      .post(`/api/v1/clinics/${firstClinic.id}/patients`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Paciente Compartilhado',
        birthDate: '1990-05-10',
        cpf: '12345678901',
        phone: '38999990000',
        addressState: 'mg',
        localRecordNumber: 'LOCAL-001',
      })

    firstResponse.assertStatus(201)

    const firstLink = firstResponse.body().patientLink

    assert.equal(firstLink.patient.fullName, 'Paciente Compartilhado')
    assert.equal(firstLink.patient.addressState, 'MG')
    assert.equal(firstLink.localRecordNumber, 'LOCAL-001')
    assert.isNotNull(firstLink.patient.medicalRecord)

    const secondResponse = await client
      .post(`/api/v1/clinics/${secondClinic.id}/patients`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Paciente Compartilhado',
        birthDate: '1990-05-10',
        cpf: '12345678901',
        localRecordNumber: 'LOCAL-002',
      })

    secondResponse.assertStatus(201)

    const secondLink = secondResponse.body().patientLink

    assert.equal(secondLink.patient.id, firstLink.patient.id)
    assert.equal(secondLink.patient.medicalRecord.id, firstLink.patient.medicalRecord.id)

    const patients = await Patient.all()
    const links = await PatientClinic.all()
    const records = await MedicalRecord.all()

    assert.lengthOf(patients, 1)
    assert.lengthOf(links, 2)
    assert.lengthOf(records, 1)

    const listResponse = await client
      .get(`/api/v1/clinics/${firstClinic.id}/patients?search=Compartilhado`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    listResponse.assertStatus(200)
    assert.lengthOf(listResponse.body().data, 1)

    const showResponse = await client
      .get(`/api/v1/clinics/${firstClinic.id}/patients/${firstLink.patient.id}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    showResponse.assertStatus(200)
  })

  test('updates patient data and the local clinic link status', async ({ client, assert }) => {
    const clinic = await ClinicFactory.merge({ name: 'Clínica de Atualização' }).create()
    const receptionist = await UserFactory.merge({
      fullName: 'Usuário de Pacientes',
      email: 'patient.update@example.com',
    }).create()

    await createMembership({
      user: receptionist,
      clinic,
      roleCode: 'receptionist',
    })

    const token = await createToken(receptionist)

    const createResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/patients`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Paciente Inicial',
        birthDate: '1985-02-15',
        cpf: '98765432100',
        localRecordNumber: 'ANTIGO-001',
      })

    createResponse.assertStatus(201)

    const patientId = createResponse.body().patientLink.patient.id

    const updateResponse = await client
      .patch(`/api/v1/clinics/${clinic.id}/patients/${patientId}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Paciente Atualizado',
        email: 'PACIENTE@example.com',
        addressState: 'sp',
        localRecordNumber: 'NOVO-001',
      })

    updateResponse.assertStatus(200)

    const updatedLink = updateResponse.body().patientLink

    assert.equal(updatedLink.patient.fullName, 'Paciente Atualizado')
    assert.equal(updatedLink.patient.email, 'paciente@example.com')
    assert.equal(updatedLink.patient.addressState, 'SP')
    assert.equal(updatedLink.localRecordNumber, 'NOVO-001')

    const statusResponse = await client
      .patch(`/api/v1/clinics/${clinic.id}/patients/${patientId}/status`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        isActive: false,
      })

    statusResponse.assertStatus(200)
    assert.isFalse(statusResponse.body().patientLink.isActive)
  })

  test('rejects duplicate links, conflicting identity and invalid data', async ({ client }) => {
    const firstClinic = await ClinicFactory.merge({ name: 'Clínica de Validação 1' }).create()
    const secondClinic = await ClinicFactory.merge({ name: 'Clínica de Validação 2' }).create()
    const receptionist = await UserFactory.merge({
      fullName: 'Usuário de Pacientes',
      email: 'patient.validation@example.com',
    }).create()

    await createMembership({
      user: receptionist,
      clinic: firstClinic,
      roleCode: 'receptionist',
    })

    await createMembership({
      user: receptionist,
      clinic: secondClinic,
      roleCode: 'receptionist',
    })

    const token = await createToken(receptionist)

    const firstResponse = await client
      .post(`/api/v1/clinics/${firstClinic.id}/patients`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Paciente Original',
        birthDate: '1992-03-20',
        cpf: '11122233344',
        localRecordNumber: 'DUP-001',
      })

    firstResponse.assertStatus(201)

    const duplicateLinkResponse = await client
      .post(`/api/v1/clinics/${firstClinic.id}/patients`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Paciente Original',
        birthDate: '1992-03-20',
        cpf: '11122233344',
      })

    duplicateLinkResponse.assertStatus(409)

    const conflictingIdentityResponse = await client
      .post(`/api/v1/clinics/${secondClinic.id}/patients`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Outro Paciente',
        birthDate: '2000-01-01',
        cpf: '11122233344',
      })

    conflictingIdentityResponse.assertStatus(409)

    const duplicateLocalRecordResponse = await client
      .post(`/api/v1/clinics/${firstClinic.id}/patients`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'Segundo Paciente',
        birthDate: '1980-01-01',
        cpf: '55566677788',
        localRecordNumber: 'DUP-001',
      })

    duplicateLocalRecordResponse.assertStatus(409)

    const invalidResponse = await client
      .post(`/api/v1/clinics/${firstClinic.id}/patients`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        fullName: 'A',
        birthDate: '2999-01-01',
        cpf: '123',
      })

    invalidResponse.assertStatus(422)
  })
})
