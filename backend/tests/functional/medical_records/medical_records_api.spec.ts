import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import User from '#models/user'
import Clinic from '#models/clinic'
import Role from '#models/role'
import UserClinicRole from '#models/user_clinic_role'
import Patient from '#models/patient'
import PatientClinic from '#models/patient_clinic'
import MedicalRecord from '#models/medical_record'
import MedicalRecordEntry from '#models/medical_record_entry'
import MedicalRecordAccessLog from '#models/medical_record_access_log'
import Professional from '#models/professional'
import ClinicProfessional from '#models/clinic_professional'
import { truncateClinicSchemaTables } from '../../helpers/database.js'
import { seedAuthorizationCatalog } from '../../../database/seeders/authorization_catalog_seeder.js'

async function createUser(email: string) {
  return User.create({
    fullName: 'Usuário do Prontuário',
    email,
    emailNormalized: email.toLowerCase(),
    passwordHash: 'TestPassword!123',
    isGlobalAdmin: false,
    isActive: true,
  })
}

async function createToken(user: User) {
  const token = await User.accessTokens.create(user)

  return token.value!.release()
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
}: {
  user: User
  clinic: Clinic
  roleCode: string
}) {
  const role = await Role.findByOrFail('code', roleCode)

  return UserClinicRole.create({
    userId: user.id,
    clinicId: clinic.id,
    roleId: role.id,
    isActive: true,
  })
}

async function createPatient(fullName: string) {
  const patient = await Patient.create({
    fullName,
    birthDate: DateTime.fromISO('1990-05-10'),
    cpf: null,
    phone: null,
    email: null,
    addressStreet: null,
    addressNumber: null,
    addressComplement: null,
    addressNeighborhood: null,
    addressCity: null,
    addressState: null,
    addressPostalCode: null,
    isActive: true,
  })

  const medicalRecord = await MedicalRecord.create({
    patientId: patient.id,
  })

  return {
    patient,
    medicalRecord,
  }
}

async function createPatientLink({ patient, clinic }: { patient: Patient; clinic: Clinic }) {
  return PatientClinic.create({
    patientId: patient.id,
    clinicId: clinic.id,
    localRecordNumber: null,
    isActive: true,
  })
}

async function createProfessionalLink({
  clinic,
  user,
  fullName,
  crmNumber,
}: {
  clinic: Clinic
  user: User
  fullName: string
  crmNumber: string
}) {
  const professional = await Professional.create({
    userId: user.id,
    fullName,
    crmNumber,
    crmState: 'MG',
    specialty: 'Clínica Médica',
    phone: null,
    email: null,
    isActive: true,
  })

  return ClinicProfessional.create({
    clinicId: clinic.id,
    professionalId: professional.id,
    localCode: null,
    defaultAppointmentDurationMinutes: 60,
    acceptsAppointments: true,
    isActive: true,
  })
}

async function createEntry({
  medicalRecord,
  patient,
  clinic,
  patientLink,
  professionalLink,
  author,
  entryTypeCode = 'evolution',
  content,
}: {
  medicalRecord: MedicalRecord
  patient: Patient
  clinic: Clinic
  patientLink: PatientClinic
  professionalLink: ClinicProfessional
  author: User
  entryTypeCode?: 'consultation' | 'evolution' | 'other'
  content: string
}) {
  return MedicalRecordEntry.create({
    medicalRecordId: medicalRecord.id,
    patientId: patient.id,
    clinicId: clinic.id,
    patientClinicId: patientLink.id,
    clinicProfessionalId: professionalLink.id,
    appointmentId: null,
    authorUserId: author.id,
    entryTypeCode,
    content,
    correctsEntryId: null,
  })
}

test.group('Medical records API', (group) => {
  group.each.setup(async () => {
    await truncateClinicSchemaTables()
    await seedAuthorizationCatalog()

    return async () => {
      await truncateClinicSchemaTables()
    }
  })

  test('requires authentication and clinical permission', async ({ client, assert }) => {
    const clinic = await createClinic('Clínica de Permissões do Prontuário')

    const doctor = await createUser('records.api.doctor@example.com')
    const receptionist = await createUser('records.api.receptionist@example.com')

    await createMembership({
      user: doctor,
      clinic,
      roleCode: 'doctor',
    })

    await createMembership({
      user: receptionist,
      clinic,
      roleCode: 'receptionist',
    })

    const { patient } = await createPatient('Paciente de Permissões')

    await createPatientLink({
      patient,
      clinic,
    })

    const route =
      `/api/v1/clinics/${clinic.id}/patients/${patient.id}` +
      '/medical-record?purposeCode=patient_care'

    const unauthenticatedResponse = await client.get(route).header('Accept', 'application/json')

    unauthenticatedResponse.assertStatus(401)

    const receptionistToken = await createToken(receptionist)

    const receptionistResponse = await client
      .get(route)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${receptionistToken}`)

    receptionistResponse.assertStatus(403)

    const doctorToken = await createToken(doctor)

    const doctorResponse = await client
      .get(route)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${doctorToken}`)

    doctorResponse.assertStatus(200)
    assert.equal(doctorResponse.body().patient.id, patient.id)

    const logs = await MedicalRecordAccessLog.query().where('user_id', doctor.id)

    assert.lengthOf(logs, 1)
    assert.equal(logs[0].accessAction, 'view_timeline')
    assert.equal(logs[0].purposeCode, 'patient_care')
  })

  test('returns the global timeline and registers clinic-scoped access', async ({
    client,
    assert,
  }) => {
    const firstClinic = await createClinic('Primeira Clínica da Timeline Global')

    const secondClinic = await createClinic('Segunda Clínica da Timeline Global')

    const firstDoctor = await createUser('records.api.timeline.first@example.com')

    const secondDoctor = await createUser('records.api.timeline.second@example.com')

    await createMembership({
      user: firstDoctor,
      clinic: firstClinic,
      roleCode: 'doctor',
    })

    await createMembership({
      user: secondDoctor,
      clinic: secondClinic,
      roleCode: 'doctor',
    })

    const { patient, medicalRecord } = await createPatient('Paciente da Timeline Global')

    const firstPatientLink = await createPatientLink({
      patient,
      clinic: firstClinic,
    })

    const secondPatientLink = await createPatientLink({
      patient,
      clinic: secondClinic,
    })

    const firstProfessionalLink = await createProfessionalLink({
      clinic: firstClinic,
      user: firstDoctor,
      fullName: 'Dr. Primeira Timeline',
      crmNumber: '98001',
    })

    const secondProfessionalLink = await createProfessionalLink({
      clinic: secondClinic,
      user: secondDoctor,
      fullName: 'Dra. Segunda Timeline',
      crmNumber: '98002',
    })

    const firstEntry = await createEntry({
      medicalRecord,
      patient,
      clinic: firstClinic,
      patientLink: firstPatientLink,
      professionalLink: firstProfessionalLink,
      author: firstDoctor,
      entryTypeCode: 'consultation',
      content: 'Consulta registrada no primeiro consultório.',
    })

    const secondEntry = await createEntry({
      medicalRecord,
      patient,
      clinic: secondClinic,
      patientLink: secondPatientLink,
      professionalLink: secondProfessionalLink,
      author: secondDoctor,
      content: 'Evolução registrada no segundo consultório.',
    })

    const thirdEntry = await createEntry({
      medicalRecord,
      patient,
      clinic: firstClinic,
      patientLink: firstPatientLink,
      professionalLink: firstProfessionalLink,
      author: firstDoctor,
      content: 'Nova evolução registrada no primeiro consultório.',
    })

    const token = await createToken(firstDoctor)

    const route =
      `/api/v1/clinics/${firstClinic.id}/patients/${patient.id}` +
      '/medical-record?purposeCode=care_coordination&page=1&perPage=100'

    const response = await client
      .get(route)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    response.assertStatus(200)

    assert.equal(response.body().medicalRecord.id, medicalRecord.id)
    assert.equal(response.body().patient.id, patient.id)
    assert.equal(response.body().patientLink.id, firstPatientLink.id)
    assert.equal(response.body().meta.total, 3)
    assert.lengthOf(response.body().entries, 3)

    const entryIds = response.body().entries.map((entry: { id: string }) => entry.id)

    assert.include(entryIds, firstEntry.id)
    assert.include(entryIds, secondEntry.id)
    assert.include(entryIds, thirdEntry.id)

    const secondClinicEntry = response
      .body()
      .entries.find((entry: { id: string }) => entry.id === secondEntry.id)

    assert.exists(secondClinicEntry)
    assert.equal(secondClinicEntry.clinicId, secondClinic.id)

    const logs = await MedicalRecordAccessLog.query()
      .where('medical_record_id', medicalRecord.id)
      .where('user_id', firstDoctor.id)

    assert.lengthOf(logs, 1)
    assert.equal(logs[0].clinicId, firstClinic.id)
    assert.equal(logs[0].patientClinicId, firstPatientLink.id)
    assert.equal(logs[0].accessAction, 'view_timeline')
    assert.equal(logs[0].purposeCode, 'care_coordination')
  })

  test('shows one global entry and prevents access through another patient', async ({
    client,
    assert,
  }) => {
    const firstClinic = await createClinic('Clínica de Visualização de Entrada')

    const secondClinic = await createClinic('Clínica de Origem da Entrada')

    const readerDoctor = await createUser('records.api.entry.reader@example.com')

    const authorDoctor = await createUser('records.api.entry.author@example.com')

    await createMembership({
      user: readerDoctor,
      clinic: firstClinic,
      roleCode: 'doctor',
    })

    await createMembership({
      user: authorDoctor,
      clinic: secondClinic,
      roleCode: 'doctor',
    })

    const { patient, medicalRecord } = await createPatient('Paciente da Entrada Global')

    await createPatientLink({
      patient,
      clinic: firstClinic,
    })

    const secondPatientLink = await createPatientLink({
      patient,
      clinic: secondClinic,
    })

    const authorProfessionalLink = await createProfessionalLink({
      clinic: secondClinic,
      user: authorDoctor,
      fullName: 'Dra. Autora da Entrada',
      crmNumber: '98101',
    })

    const globalEntry = await createEntry({
      medicalRecord,
      patient,
      clinic: secondClinic,
      patientLink: secondPatientLink,
      professionalLink: authorProfessionalLink,
      author: authorDoctor,
      content: 'Entrada visível pela timeline global.',
    })

    const { patient: otherPatient, medicalRecord: otherMedicalRecord } = await createPatient(
      'Outro Paciente da Entrada'
    )

    const otherPatientLink = await createPatientLink({
      patient: otherPatient,
      clinic: firstClinic,
    })

    const readerProfessionalLink = await createProfessionalLink({
      clinic: firstClinic,
      user: readerDoctor,
      fullName: 'Dr. Leitor da Entrada',
      crmNumber: '98102',
    })

    const otherEntry = await createEntry({
      medicalRecord: otherMedicalRecord,
      patient: otherPatient,
      clinic: firstClinic,
      patientLink: otherPatientLink,
      professionalLink: readerProfessionalLink,
      author: readerDoctor,
      content: 'Entrada pertencente a outro prontuário.',
    })

    const token = await createToken(readerDoctor)

    const entryRoute =
      `/api/v1/clinics/${firstClinic.id}/patients/${patient.id}` +
      `/medical-record/entries/${globalEntry.id}` +
      '?purposeCode=care_coordination'

    const entryResponse = await client
      .get(entryRoute)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    entryResponse.assertStatus(200)
    assert.equal(entryResponse.body().entry.id, globalEntry.id)
    assert.equal(entryResponse.body().entry.clinicId, secondClinic.id)

    const logsAfterSuccess = await MedicalRecordAccessLog.query().where(
      'medical_record_id',
      medicalRecord.id
    )

    assert.lengthOf(logsAfterSuccess, 1)
    assert.equal(logsAfterSuccess[0].accessAction, 'view_entry')

    const wrongEntryRoute =
      `/api/v1/clinics/${firstClinic.id}/patients/${patient.id}` +
      `/medical-record/entries/${otherEntry.id}` +
      '?purposeCode=patient_care'

    const wrongEntryResponse = await client
      .get(wrongEntryRoute)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    wrongEntryResponse.assertStatus(404)

    const logsAfterFailure = await MedicalRecordAccessLog.query().where(
      'medical_record_id',
      medicalRecord.id
    )

    assert.lengthOf(logsAfterFailure, 1)
  })

  test('validates access purpose and active patient context before logging', async ({
    client,
    assert,
  }) => {
    const clinic = await createClinic('Clínica de Finalidade do Prontuário')

    const unrelatedClinic = await createClinic('Clínica sem Vínculo do Paciente')

    const doctor = await createUser('records.api.purpose.doctor@example.com')

    await createMembership({
      user: doctor,
      clinic,
      roleCode: 'doctor',
    })

    await createMembership({
      user: doctor,
      clinic: unrelatedClinic,
      roleCode: 'doctor',
    })

    const { patient, medicalRecord } = await createPatient('Paciente de Finalidade')

    const patientLink = await createPatientLink({
      patient,
      clinic,
    })

    const token = await createToken(doctor)

    const missingNoteRoute =
      `/api/v1/clinics/${clinic.id}/patients/${patient.id}` + '/medical-record?purposeCode=other'

    const missingNoteResponse = await client
      .get(missingNoteRoute)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    missingNoteResponse.assertStatus(422)

    let logs = await MedicalRecordAccessLog.query().where('medical_record_id', medicalRecord.id)

    assert.lengthOf(logs, 0)

    const purposeNote = 'Revisão clínica autorizada para finalidade específica'

    const validOtherRoute =
      `/api/v1/clinics/${clinic.id}/patients/${patient.id}` +
      '/medical-record?purposeCode=other&purposeNote=' +
      encodeURIComponent(purposeNote)

    const validOtherResponse = await client
      .get(validOtherRoute)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    validOtherResponse.assertStatus(200)

    logs = await MedicalRecordAccessLog.query().where('medical_record_id', medicalRecord.id)

    assert.lengthOf(logs, 1)
    assert.equal(logs[0].purposeCode, 'other')
    assert.equal(logs[0].purposeNote, purposeNote)

    patientLink.isActive = false
    await patientLink.save()

    const inactiveLinkRoute =
      `/api/v1/clinics/${clinic.id}/patients/${patient.id}` +
      '/medical-record?purposeCode=patient_care'

    const inactiveLinkResponse = await client
      .get(inactiveLinkRoute)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    inactiveLinkResponse.assertStatus(409)

    const unrelatedClinicRoute =
      `/api/v1/clinics/${unrelatedClinic.id}/patients/${patient.id}` +
      '/medical-record?purposeCode=patient_care'

    const unrelatedClinicResponse = await client
      .get(unrelatedClinicRoute)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    unrelatedClinicResponse.assertStatus(404)

    logs = await MedicalRecordAccessLog.query().where('medical_record_id', medicalRecord.id)

    assert.lengthOf(logs, 1)
  })
})
