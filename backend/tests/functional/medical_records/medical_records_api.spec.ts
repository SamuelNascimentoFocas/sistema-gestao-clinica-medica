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
import Appointment from '#models/appointment'

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

async function createAppointment({
  clinic,
  patientLink,
  professionalLink,
  author,
  startsAt,
  status = 'scheduled',
}: {
  clinic: Clinic
  patientLink: PatientClinic
  professionalLink: ClinicProfessional
  author: User
  startsAt: DateTime
  status?: 'scheduled' | 'cancelled'
}) {
  const isCancelled = status === 'cancelled'

  return Appointment.create({
    clinicId: clinic.id,
    patientClinicId: patientLink.id,
    clinicProfessionalId: professionalLink.id,
    startsAt,
    endsAt: startsAt.plus({ hours: 1 }),
    status,
    version: 1,
    appointmentTypeCode: null,
    administrativeNote: null,
    createdByUserId: author.id,
    confirmedAt: null,
    confirmedByUserId: null,
    completedAt: null,
    completedByUserId: null,
    cancelledAt: isCancelled ? DateTime.utc() : null,
    cancelledByUserId: isCancelled ? author.id : null,
    cancellationReasonCode: isCancelled ? 'patient_request' : null,
    cancellationNote: null,
    noShowAt: null,
    noShowByUserId: null,
    rescheduledFromAppointmentId: null,
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

  test('creates a clinical entry with derived authorship and a compatible appointment', async ({
    client,
    assert,
  }) => {
    const clinic = await createClinic('Clínica de Escrita Clínica')
    const doctor = await createUser('records.write.doctor@example.com')

    await createMembership({
      user: doctor,
      clinic,
      roleCode: 'doctor',
    })

    const { patient, medicalRecord } = await createPatient('Paciente de Escrita Clínica')

    const patientLink = await createPatientLink({
      patient,
      clinic,
    })

    const professionalLink = await createProfessionalLink({
      clinic,
      user: doctor,
      fullName: 'Dra. Escrita Clínica',
      crmNumber: '98201',
    })

    const appointment = await createAppointment({
      clinic,
      patientLink,
      professionalLink,
      author: doctor,
      startsAt: DateTime.utc().plus({ days: 10 }),
    })

    const token = await createToken(doctor)

    const response = await client
      .post(`/api/v1/clinics/${clinic.id}/patients/${patient.id}/medical-record/entries`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        appointmentId: appointment.id,
        entryTypeCode: 'consultation',
        content: 'Consulta clínica registrada pelo médico autenticado.',
        authorUserId: '00000000-0000-0000-0000-000000000000',
        clinicProfessionalId: '00000000-0000-0000-0000-000000000000',
      })

    response.assertStatus(201)

    const responseEntry = response.body().entry

    assert.equal(responseEntry.medicalRecordId, medicalRecord.id)
    assert.equal(responseEntry.patientId, patient.id)
    assert.equal(responseEntry.clinicId, clinic.id)
    assert.equal(responseEntry.patientClinicId, patientLink.id)
    assert.equal(responseEntry.clinicProfessionalId, professionalLink.id)
    assert.equal(responseEntry.authorUserId, doctor.id)
    assert.equal(responseEntry.appointmentId, appointment.id)
    assert.equal(responseEntry.entryTypeCode, 'consultation')
    assert.isNull(responseEntry.correctsEntryId)

    const persistedEntry = await MedicalRecordEntry.findOrFail(responseEntry.id)

    assert.equal(persistedEntry.authorUserId, doctor.id)
    assert.equal(persistedEntry.clinicProfessionalId, professionalLink.id)
    assert.equal(persistedEntry.appointmentId, appointment.id)

    const entries = await MedicalRecordEntry.query().where('medical_record_id', medicalRecord.id)

    assert.lengthOf(entries, 1)
  })

  test('requires both clinical permission and an active professional profile', async ({
    client,
    assert,
  }) => {
    const clinic = await createClinic('Clínica de Autoria Profissional')

    const receptionist = await createUser('records.write.receptionist@example.com')

    const administrator = await createUser('records.write.administrator@example.com')

    await createMembership({
      user: receptionist,
      clinic,
      roleCode: 'receptionist',
    })

    await createMembership({
      user: administrator,
      clinic,
      roleCode: 'clinic_admin',
    })

    const { patient, medicalRecord } = await createPatient('Paciente de Autoria Profissional')

    await createPatientLink({
      patient,
      clinic,
    })

    const route = `/api/v1/clinics/${clinic.id}/patients/${patient.id}` + '/medical-record/entries'

    const receptionistToken = await createToken(receptionist)

    const receptionistResponse = await client
      .post(route)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${receptionistToken}`)
      .json({
        entryTypeCode: 'evolution',
        content: 'Tentativa administrativa indevida.',
      })

    receptionistResponse.assertStatus(403)

    const administratorToken = await createToken(administrator)

    const administratorResponse = await client
      .post(route)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${administratorToken}`)
      .json({
        entryTypeCode: 'evolution',
        content: 'Tentativa sem perfil profissional clínico.',
      })

    administratorResponse.assertStatus(403)
    administratorResponse.assertBodyContains({
      message: 'O usuário não possui um perfil profissional clínico ativo neste consultório',
    })

    const entries = await MedicalRecordEntry.query().where('medical_record_id', medicalRecord.id)

    assert.lengthOf(entries, 0)
  })

  test('validates clinical content and appointment compatibility', async ({ client, assert }) => {
    const clinic = await createClinic('Clínica de Validação da Escrita')

    const firstDoctor = await createUser('records.write.validation.first@example.com')

    const secondDoctor = await createUser('records.write.validation.second@example.com')

    await createMembership({
      user: firstDoctor,
      clinic,
      roleCode: 'doctor',
    })

    await createMembership({
      user: secondDoctor,
      clinic,
      roleCode: 'doctor',
    })

    const { patient, medicalRecord } = await createPatient('Paciente de Validação da Escrita')

    const patientLink = await createPatientLink({
      patient,
      clinic,
    })

    const firstProfessionalLink = await createProfessionalLink({
      clinic,
      user: firstDoctor,
      fullName: 'Dr. Primeira Validação',
      crmNumber: '98202',
    })

    const secondProfessionalLink = await createProfessionalLink({
      clinic,
      user: secondDoctor,
      fullName: 'Dra. Segunda Validação',
      crmNumber: '98203',
    })

    const cancelledAppointment = await createAppointment({
      clinic,
      patientLink,
      professionalLink: firstProfessionalLink,
      author: firstDoctor,
      startsAt: DateTime.utc().plus({ days: 12 }),
      status: 'cancelled',
    })

    const otherDoctorAppointment = await createAppointment({
      clinic,
      patientLink,
      professionalLink: secondProfessionalLink,
      author: secondDoctor,
      startsAt: DateTime.utc().plus({ days: 13 }),
    })

    const token = await createToken(firstDoctor)

    const route = `/api/v1/clinics/${clinic.id}/patients/${patient.id}` + '/medical-record/entries'

    const blankContentResponse = await client
      .post(route)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        entryTypeCode: 'evolution',
        content: '   ',
      })

    blankContentResponse.assertStatus(422)

    const forbiddenTypeResponse = await client
      .post(route)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        entryTypeCode: 'correction',
        content: 'Correção enviada pela rota incorreta.',
      })

    forbiddenTypeResponse.assertStatus(422)

    const oversizedContentResponse = await client
      .post(route)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        entryTypeCode: 'evolution',
        content: 'a'.repeat(20001),
      })

    oversizedContentResponse.assertStatus(422)

    const cancelledAppointmentResponse = await client
      .post(route)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        appointmentId: cancelledAppointment.id,
        entryTypeCode: 'consultation',
        content: 'Entrada vinculada a consulta cancelada.',
      })

    cancelledAppointmentResponse.assertStatus(409)

    const otherDoctorAppointmentResponse = await client
      .post(route)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        appointmentId: otherDoctorAppointment.id,
        entryTypeCode: 'consultation',
        content: 'Entrada vinculada ao agendamento de outro médico.',
      })

    otherDoctorAppointmentResponse.assertStatus(404)

    const entries = await MedicalRecordEntry.query().where('medical_record_id', medicalRecord.id)

    assert.lengthOf(entries, 0)
  })

  test('creates a linear correction chain and preserves the original entry', async ({
    client,
    assert,
  }) => {
    const firstClinic = await createClinic('Primeira Clínica de Correções')

    const secondClinic = await createClinic('Segunda Clínica de Correções')

    const firstDoctor = await createUser('records.correction.first@example.com')

    const secondDoctor = await createUser('records.correction.second@example.com')

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

    const { patient, medicalRecord } = await createPatient('Paciente de Correções Lineares')

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
      fullName: 'Dr. Primeiro Corretor',
      crmNumber: '98204',
    })

    const secondProfessionalLink = await createProfessionalLink({
      clinic: secondClinic,
      user: secondDoctor,
      fullName: 'Dra. Segunda Corretora',
      crmNumber: '98205',
    })

    assert.equal(firstPatientLink.clinicId, firstClinic.id)
    assert.equal(firstProfessionalLink.clinicId, firstClinic.id)

    const originalEntry = await createEntry({
      medicalRecord,
      patient,
      clinic: secondClinic,
      patientLink: secondPatientLink,
      professionalLink: secondProfessionalLink,
      author: secondDoctor,
      content: 'Conteúdo clínico original.',
    })

    const firstToken = await createToken(firstDoctor)

    const wrongClinicResponse = await client
      .post(
        `/api/v1/clinics/${firstClinic.id}/patients/${patient.id}` +
          `/medical-record/entries/${originalEntry.id}/corrections`
      )
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${firstToken}`)
      .json({
        content: 'Tentativa de corrigir por outro consultório.',
      })

    wrongClinicResponse.assertStatus(404)

    const secondToken = await createToken(secondDoctor)

    const firstCorrectionResponse = await client
      .post(
        `/api/v1/clinics/${secondClinic.id}/patients/${patient.id}` +
          `/medical-record/entries/${originalEntry.id}/corrections`
      )
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${secondToken}`)
      .json({
        content: 'Primeira correção clínica.',
      })

    firstCorrectionResponse.assertStatus(201)

    const firstCorrection = firstCorrectionResponse.body().entry

    assert.equal(firstCorrection.entryTypeCode, 'correction')
    assert.equal(firstCorrection.correctsEntryId, originalEntry.id)
    assert.equal(firstCorrection.authorUserId, secondDoctor.id)
    assert.equal(firstCorrection.clinicProfessionalId, secondProfessionalLink.id)

    const persistedOriginal = await MedicalRecordEntry.findOrFail(originalEntry.id)

    assert.equal(persistedOriginal.content, 'Conteúdo clínico original.')
    assert.equal(persistedOriginal.entryTypeCode, 'evolution')

    const repeatedCorrectionResponse = await client
      .post(
        `/api/v1/clinics/${secondClinic.id}/patients/${patient.id}` +
          `/medical-record/entries/${originalEntry.id}/corrections`
      )
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${secondToken}`)
      .json({
        content: 'Segunda correção direta indevida.',
      })

    repeatedCorrectionResponse.assertStatus(409)

    const correctionOfCorrectionResponse = await client
      .post(
        `/api/v1/clinics/${secondClinic.id}/patients/${patient.id}` +
          `/medical-record/entries/${firstCorrection.id}/corrections`
      )
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${secondToken}`)
      .json({
        content: 'Correção da versão corrigida.',
      })

    correctionOfCorrectionResponse.assertStatus(201)

    const secondCorrection = correctionOfCorrectionResponse.body().entry

    assert.equal(secondCorrection.correctsEntryId, firstCorrection.id)

    const allEntries = await MedicalRecordEntry.query().where('medical_record_id', medicalRecord.id)

    assert.lengthOf(allEntries, 3)

    const originalSuccessors = await MedicalRecordEntry.query().where(
      'corrects_entry_id',
      originalEntry.id
    )

    const firstCorrectionSuccessors = await MedicalRecordEntry.query().where(
      'corrects_entry_id',
      firstCorrection.id
    )

    assert.lengthOf(originalSuccessors, 1)
    assert.lengthOf(firstCorrectionSuccessors, 1)
  })

  test('allows only one correction when concurrent requests target the same entry', async ({
    client,
    assert,
  }) => {
    const clinic = await createClinic('Clínica de Correção Concorrente')

    const doctor = await createUser('records.correction.concurrent@example.com')

    await createMembership({
      user: doctor,
      clinic,
      roleCode: 'doctor',
    })

    const { patient, medicalRecord } = await createPatient('Paciente de Correção Concorrente')

    const patientLink = await createPatientLink({
      patient,
      clinic,
    })

    const professionalLink = await createProfessionalLink({
      clinic,
      user: doctor,
      fullName: 'Dr. Correção Concorrente',
      crmNumber: '98206',
    })

    const originalEntry = await createEntry({
      medicalRecord,
      patient,
      clinic,
      patientLink,
      professionalLink,
      author: doctor,
      content: 'Entrada sujeita a correções concorrentes.',
    })

    const token = await createToken(doctor)

    const route =
      `/api/v1/clinics/${clinic.id}/patients/${patient.id}` +
      `/medical-record/entries/${originalEntry.id}/corrections`

    const [firstResponse, secondResponse] = await Promise.all([
      client
        .post(route)
        .header('Accept', 'application/json')
        .header('Authorization', `Bearer ${token}`)
        .json({
          content: 'Primeira tentativa concorrente.',
        }),

      client
        .post(route)
        .header('Accept', 'application/json')
        .header('Authorization', `Bearer ${token}`)
        .json({
          content: 'Segunda tentativa concorrente.',
        }),
    ])

    const statuses = [firstResponse.status(), secondResponse.status()].sort(
      (first, second) => first - second
    )

    assert.deepEqual(statuses, [201, 409])

    const corrections = await MedicalRecordEntry.query().where(
      'corrects_entry_id',
      originalEntry.id
    )

    assert.lengthOf(corrections, 1)

    const persistedOriginal = await MedicalRecordEntry.findOrFail(originalEntry.id)

    assert.equal(persistedOriginal.content, 'Entrada sujeita a correções concorrentes.')
  })
})
