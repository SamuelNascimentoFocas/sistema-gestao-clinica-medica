import { AppointmentFactory } from '#database/factories/appointment_factory'
import { MedicalRecordEntryFactory } from '#database/factories/medical_record_entry_factory'
import { ClinicProfessionalFactory } from '#database/factories/clinic_professional_factory'
import { ProfessionalFactory } from '#database/factories/professional_factory'
import { PatientClinicFactory } from '#database/factories/patient_clinic_factory'
import { MedicalRecordFactory } from '#database/factories/medical_record_factory'
import { PatientFactory } from '#database/factories/patient_factory'
import { MedicalRecordAttachmentFactory } from '#database/factories/medical_record_attachment_factory'
import { UserFactory } from '#database/factories/user_factory'
import { ClinicFactory } from '#database/factories/clinic_factory'
import { createMembership } from '#tests/helpers/membership'
import { createBearerToken as createToken } from '#tests/helpers/auth'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { mock } from 'node:test'
import { MultipartFile } from '@adonisjs/core/bodyparser'
import { Response } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import User from '#models/user'
import Clinic from '#models/clinic'
import Patient from '#models/patient'
import PatientClinic from '#models/patient_clinic'
import MedicalRecord from '#models/medical_record'
import MedicalRecordEntry from '#models/medical_record_entry'
import MedicalRecordAccessLog from '#models/medical_record_access_log'
import MedicalRecordAttachment from '#models/medical_record_attachment'
import ClinicProfessional from '#models/clinic_professional'
import { truncateClinicSchemaTables } from '../../helpers/database.js'
import { seedAuthorizationCatalog } from '../../../database/seeders/authorization_catalog_seeder.js'

const privateAttachmentStorageRoot = app.makePath('storage/private')

const medicalRecordAttachmentStorageRoot = join(privateAttachmentStorageRoot, 'medical-records')

const validPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n')

const validPngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
)

function getStoredAttachmentPath(storageKey: string) {
  return join(privateAttachmentStorageRoot, storageKey)
}

async function listStoredMedicalRecordItems() {
  try {
    return await readdir(medicalRecordAttachmentStorageRoot)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }

    throw error
  }
}

async function createStoredAttachment({
  entry,
  medicalRecord,
  patient,
  clinic,
  uploader,
  originalName = 'imagem-clinica.png',
  content = validPngBuffer,
  contentType = 'image/png',
  status = 'available',
  statusReason,
  persistFile = status === 'available',
}: {
  entry: MedicalRecordEntry
  medicalRecord: MedicalRecord
  patient: Patient
  clinic: Clinic
  uploader: User
  originalName?: string
  content?: Buffer
  contentType?: 'application/pdf' | 'image/jpeg' | 'image/png'
  status?: 'pending' | 'available' | 'rejected'
  statusReason?: string | null
  persistFile?: boolean
}) {
  const extension =
    contentType === 'application/pdf' ? 'pdf' : contentType === 'image/jpeg' ? 'jpg' : 'png'

  const storageKey =
    `medical-records/${medicalRecord.id}/entries/${entry.id}/` + `${randomUUID()}.${extension}`

  const resolvedStatusReason =
    status === 'rejected' ? (statusReason ?? 'Arquivo rejeitado durante o processamento') : null

  const attachment = await MedicalRecordAttachmentFactory.merge({
    medicalRecordEntryId: entry.id,
    medicalRecordId: medicalRecord.id,
    patientId: patient.id,
    clinicId: clinic.id,
    uploadedByUserId: uploader.id,
    originalName,
    storageKey,
    contentType,
    sizeInBytes: content.length,
    sha256: createHash('sha256').update(content).digest('hex'),
    status,
    statusReason: resolvedStatusReason,
  }).create()

  if (persistFile) {
    const storedPath = getStoredAttachmentPath(storageKey)

    await mkdir(dirname(storedPath), {
      recursive: true,
    })

    await writeFile(storedPath, content)
  }

  return attachment
}

async function createPatient(fullName: string) {
  const patient = await PatientFactory.merge({ fullName }).create()

  const medicalRecord = await MedicalRecordFactory.merge({ patientId: patient.id }).create()

  return {
    patient,
    medicalRecord,
  }
}

async function createPatientLink({ patient, clinic }: { patient: Patient; clinic: Clinic }) {
  return PatientClinicFactory.merge({ patientId: patient.id, clinicId: clinic.id }).create()
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
  const professional = await ProfessionalFactory.merge({
    userId: user.id,
    fullName,
    crmNumber,
  }).create()

  return ClinicProfessionalFactory.merge({
    clinicId: clinic.id,
    professionalId: professional.id,
    defaultAppointmentDurationMinutes: 60,
  }).create()
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
  return MedicalRecordEntryFactory.merge({
    medicalRecordId: medicalRecord.id,
    patientId: patient.id,
    clinicId: clinic.id,
    patientClinicId: patientLink.id,
    clinicProfessionalId: professionalLink.id,
    authorUserId: author.id,
    entryTypeCode,
    content,
  }).create()
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

  return AppointmentFactory.merge({
    clinicId: clinic.id,
    patientClinicId: patientLink.id,
    clinicProfessionalId: professionalLink.id,
    startsAt,
    endsAt: startsAt.plus({ hours: 1 }),
    status,
    createdByUserId: author.id,
    cancelledAt: isCancelled ? DateTime.utc() : null,
    cancelledByUserId: isCancelled ? author.id : null,
    cancellationReasonCode: isCancelled ? 'patient_request' : null,
  }).create()
}

test.group('Medical records API', (group) => {
  group.each.setup(async () => {
    await rm(medicalRecordAttachmentStorageRoot, {
      recursive: true,
      force: true,
    })

    await truncateClinicSchemaTables()
    await seedAuthorizationCatalog()

    return async () => {
      await rm(medicalRecordAttachmentStorageRoot, {
        recursive: true,
        force: true,
      })

      await truncateClinicSchemaTables()
    }
  })

  test('requires authentication and clinical permission', async ({ client, assert }) => {
    const clinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica de Permissões do Prontuário',
    }).create()

    const doctor = await UserFactory.merge({
      fullName: 'Usuário do Prontuário',
      email: 'records.api.doctor@example.com',
    }).create()
    const receptionist = await UserFactory.merge({
      fullName: 'Usuário do Prontuário',
      email: 'records.api.receptionist@example.com',
    }).create()

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
    const firstClinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Primeira Clínica da Timeline Global',
    }).create()

    const secondClinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Segunda Clínica da Timeline Global',
    }).create()

    const firstDoctor = await UserFactory.merge({
      fullName: 'Usuário do Prontuário',
      email: 'records.api.timeline.first@example.com',
    }).create()

    const secondDoctor = await UserFactory.merge({
      fullName: 'Usuário do Prontuário',
      email: 'records.api.timeline.second@example.com',
    }).create()

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
    const firstClinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica de Visualização de Entrada',
    }).create()

    const secondClinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica de Origem da Entrada',
    }).create()

    const readerDoctor = await UserFactory.merge({
      fullName: 'Usuário do Prontuário',
      email: 'records.api.entry.reader@example.com',
    }).create()

    const authorDoctor = await UserFactory.merge({
      fullName: 'Usuário do Prontuário',
      email: 'records.api.entry.author@example.com',
    }).create()

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
    const clinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica de Finalidade do Prontuário',
    }).create()

    const unrelatedClinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica sem Vínculo do Paciente',
    }).create()

    const doctor = await UserFactory.merge({
      fullName: 'Usuário do Prontuário',
      email: 'records.api.purpose.doctor@example.com',
    }).create()

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
    const clinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica de Escrita Clínica',
    }).create()
    const doctor = await UserFactory.merge({
      fullName: 'Usuário do Prontuário',
      email: 'records.write.doctor@example.com',
    }).create()

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
    const clinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica de Autoria Profissional',
    }).create()

    const receptionist = await UserFactory.merge({
      fullName: 'Usuário do Prontuário',
      email: 'records.write.receptionist@example.com',
    }).create()

    const administrator = await UserFactory.merge({
      fullName: 'Usuário do Prontuário',
      email: 'records.write.administrator@example.com',
    }).create()

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
    const clinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica de Validação da Escrita',
    }).create()

    const firstDoctor = await UserFactory.merge({
      fullName: 'Usuário do Prontuário',
      email: 'records.write.validation.first@example.com',
    }).create()

    const secondDoctor = await UserFactory.merge({
      fullName: 'Usuário do Prontuário',
      email: 'records.write.validation.second@example.com',
    }).create()

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
    const firstClinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Primeira Clínica de Correções',
    }).create()

    const secondClinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Segunda Clínica de Correções',
    }).create()

    const firstDoctor = await UserFactory.merge({
      fullName: 'Usuário do Prontuário',
      email: 'records.correction.first@example.com',
    }).create()

    const secondDoctor = await UserFactory.merge({
      fullName: 'Usuário do Prontuário',
      email: 'records.correction.second@example.com',
    }).create()

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
    const clinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica de Correção Concorrente',
    }).create()

    const doctor = await UserFactory.merge({
      fullName: 'Usuário do Prontuário',
      email: 'records.correction.concurrent@example.com',
    }).create()

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

  test('uploads two private attachments and persists trusted metadata', async ({
    client,
    assert,
  }) => {
    const clinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica de Upload de Anexos',
    }).create()
    const doctor = await UserFactory.merge({
      fullName: 'Usuário do Prontuário',
      email: 'attachments.upload.doctor@example.com',
    }).create()

    await createMembership({
      user: doctor,
      clinic,
      roleCode: 'doctor',
    })

    const { patient, medicalRecord } = await createPatient('Paciente de Upload de Anexos')

    const patientLink = await createPatientLink({
      patient,
      clinic,
    })

    const professionalLink = await createProfessionalLink({
      clinic,
      user: doctor,
      fullName: 'Dra. Upload de Anexos',
      crmNumber: '98301',
    })

    const entry = await createEntry({
      medicalRecord,
      patient,
      clinic,
      patientLink,
      professionalLink,
      author: doctor,
      content: 'Entrada clínica destinada aos anexos.',
    })

    const token = await createToken(doctor)

    const route =
      `/api/v1/clinics/${clinic.id}/patients/${patient.id}` +
      `/medical-record/entries/${entry.id}/attachments`

    const response = await client
      .post(route)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .file('files[]', validPdfBuffer, {
        filename: 'resultado-laboratorial.pdf',
        contentType: 'application/pdf',
      })
      .file('files[]', validPngBuffer, {
        filename: 'imagem-clinica.png',
        contentType: 'image/png',
      })

    response.assertStatus(201)

    assert.equal(response.header('cache-control'), 'private, no-store')
    assert.lengthOf(response.body().attachments, 2)

    const attachments = await MedicalRecordAttachment.query()
      .where('medical_record_entry_id', entry.id)
      .orderBy('original_name', 'asc')

    assert.lengthOf(attachments, 2)

    const imageAttachment = attachments.find(
      (attachment) => attachment.originalName === 'imagem-clinica.png'
    )

    const pdfAttachment = attachments.find(
      (attachment) => attachment.originalName === 'resultado-laboratorial.pdf'
    )

    assert.exists(imageAttachment)
    assert.exists(pdfAttachment)

    assert.equal(pdfAttachment!.medicalRecordEntryId, entry.id)
    assert.equal(pdfAttachment!.medicalRecordId, medicalRecord.id)
    assert.equal(pdfAttachment!.patientId, patient.id)
    assert.equal(pdfAttachment!.clinicId, clinic.id)
    assert.equal(pdfAttachment!.uploadedByUserId, doctor.id)
    assert.equal(pdfAttachment!.storageDisk, 'private_fs')
    assert.equal(pdfAttachment!.contentType, 'application/pdf')
    assert.equal(pdfAttachment!.sizeInBytes, validPdfBuffer.length)
    assert.equal(pdfAttachment!.status, 'available')
    assert.isNull(pdfAttachment!.statusReason)

    assert.isTrue(
      pdfAttachment!.storageKey.startsWith(
        `medical-records/${medicalRecord.id}/entries/${entry.id}/`
      )
    )

    assert.isTrue(pdfAttachment!.storageKey.endsWith('.pdf'))

    assert.equal(pdfAttachment!.sha256, createHash('sha256').update(validPdfBuffer).digest('hex'))

    assert.equal(imageAttachment!.contentType, 'image/png')
    assert.equal(imageAttachment!.sizeInBytes, validPngBuffer.length)

    assert.equal(imageAttachment!.sha256, createHash('sha256').update(validPngBuffer).digest('hex'))

    const storedPdf = await readFile(getStoredAttachmentPath(pdfAttachment!.storageKey))

    const storedImage = await readFile(getStoredAttachmentPath(imageAttachment!.storageKey))

    assert.deepEqual(storedPdf, validPdfBuffer)
    assert.deepEqual(storedImage, validPngBuffer)

    for (const responseAttachment of response.body().attachments) {
      assert.notProperty(responseAttachment, 'url')
      assert.notProperty(responseAttachment, 'publicUrl')
    }
  })

  for (const failureStage of ['second_move', 'second_save', 'response'] as const) {
    test(`compensates attachment files on ${failureStage} failure`, async ({ client, assert }) => {
      const clinic = await ClinicFactory.merge({
        timezone: 'America/Sao_Paulo',
        name: 'Clínica de Compensação de Anexos',
      }).create()
      const doctor = await UserFactory.merge({
        fullName: 'Usuário do Prontuário',
        email: 'attachments.compensation@example.com',
      }).create()
      await createMembership({ user: doctor, clinic, roleCode: 'doctor' })
      const { patient, medicalRecord } = await createPatient('Paciente de Compensação')
      const patientLink = await createPatientLink({ patient, clinic })
      const professionalLink = await createProfessionalLink({
        clinic,
        user: doctor,
        fullName: 'Dra. Compensação',
        crmNumber: '98309',
      })
      const entry = await createEntry({
        medicalRecord,
        patient,
        clinic,
        patientLink,
        professionalLink,
        author: doctor,
        content: 'Entrada para testar compensação de arquivos sintéticos.',
      })
      const token = await createToken(doctor)
      const failure = new Error(`Synthetic attachment failure: ${failureStage}`)
      let calls = 0
      let restore: () => void

      if (failureStage === 'second_move') {
        const original = MultipartFile.prototype.moveToDisk
        const mocked = mock.method(
          MultipartFile.prototype,
          'moveToDisk',
          async function (this: MultipartFile, ...args: Parameters<typeof original>) {
            if (++calls === 2) throw failure
            return original.apply(this, args)
          }
        )
        restore = () => mocked.mock.restore()
      } else if (failureStage === 'second_save') {
        const original = MedicalRecordAttachment.prototype.save
        const mocked = mock.method(
          MedicalRecordAttachment.prototype,
          'save',
          async function (this: MedicalRecordAttachment) {
            if (++calls === 2) throw failure
            return original.call(this)
          }
        )
        restore = () => mocked.mock.restore()
      } else {
        const mocked = mock.method(Response.prototype, 'created', () => {
          throw failure
        })
        restore = () => mocked.mock.restore()
      }

      try {
        const response = await client
          .post(
            `/api/v1/clinics/${clinic.id}/patients/${patient.id}` +
              `/medical-record/entries/${entry.id}/attachments`
          )
          .header('Accept', 'application/json')
          .header('Authorization', `Bearer ${token}`)
          .file('files[]', validPdfBuffer, { filename: 'primeiro.pdf' })
          .file('files[]', validPngBuffer, { filename: 'segundo.png' })

        response.assertStatus(500)
        const attachments = await MedicalRecordAttachment.query().where(
          'medical_record_entry_id',
          entry.id
        )
        // The original transaction commits before HTTP serialization. Keep that boundary:
        // persistence failure rolls back rows; response failure compensates files only.
        assert.lengthOf(attachments, failureStage === 'response' ? 2 : 0)
        assert.deepEqual(
          await readdir(
            getStoredAttachmentPath(`medical-records/${medicalRecord.id}/entries/${entry.id}`)
          ),
          []
        )
      } finally {
        restore()
      }
    })
  }

  test('requires attachment permission and restricts uploads to the entry origin clinic', async ({
    client,
    assert,
  }) => {
    const firstClinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Primeira Clínica de Anexos',
    }).create()
    const secondClinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Segunda Clínica de Anexos',
    }).create()

    const firstDoctor = await UserFactory.merge({
      fullName: 'Usuário do Prontuário',
      email: 'attachments.scope.first.doctor@example.com',
    }).create()

    const secondDoctor = await UserFactory.merge({
      fullName: 'Usuário do Prontuário',
      email: 'attachments.scope.second.doctor@example.com',
    }).create()

    const receptionist = await UserFactory.merge({
      fullName: 'Usuário do Prontuário',
      email: 'attachments.scope.receptionist@example.com',
    }).create()

    await createMembership({
      user: firstDoctor,
      clinic: firstClinic,
      roleCode: 'doctor',
    })

    await createMembership({
      user: receptionist,
      clinic: firstClinic,
      roleCode: 'receptionist',
    })

    await createMembership({
      user: secondDoctor,
      clinic: secondClinic,
      roleCode: 'doctor',
    })

    const { patient, medicalRecord } = await createPatient('Paciente de Isolamento de Anexos')

    await createPatientLink({
      patient,
      clinic: firstClinic,
    })

    const secondPatientLink = await createPatientLink({
      patient,
      clinic: secondClinic,
    })

    const secondProfessionalLink = await createProfessionalLink({
      clinic: secondClinic,
      user: secondDoctor,
      fullName: 'Dra. Origem do Anexo',
      crmNumber: '98302',
    })

    const secondClinicEntry = await createEntry({
      medicalRecord,
      patient,
      clinic: secondClinic,
      patientLink: secondPatientLink,
      professionalLink: secondProfessionalLink,
      author: secondDoctor,
      content: 'Entrada criada no segundo consultório.',
    })

    const route =
      `/api/v1/clinics/${firstClinic.id}/patients/${patient.id}` +
      `/medical-record/entries/${secondClinicEntry.id}/attachments`

    const unauthenticatedResponse = await client
      .post(route)
      .header('Accept', 'application/json')
      .file('files[]', validPdfBuffer, {
        filename: 'sem-autenticacao.pdf',
        contentType: 'application/pdf',
      })

    unauthenticatedResponse.assertStatus(401)

    const receptionistToken = await createToken(receptionist)

    const receptionistResponse = await client
      .post(route)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${receptionistToken}`)
      .file('files[]', validPdfBuffer, {
        filename: 'sem-permissao.pdf',
        contentType: 'application/pdf',
      })

    receptionistResponse.assertStatus(403)

    const firstDoctorToken = await createToken(firstDoctor)

    const wrongOriginClinicResponse = await client
      .post(route)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${firstDoctorToken}`)
      .file('files[]', validPdfBuffer, {
        filename: 'clinica-incorreta.pdf',
        contentType: 'application/pdf',
      })

    wrongOriginClinicResponse.assertStatus(404)

    const attachments = await MedicalRecordAttachment.all()

    assert.lengthOf(attachments, 0)

    const storedItems = await listStoredMedicalRecordItems()

    assert.lengthOf(storedItems, 0)
  })

  test('validates attachment quantity, extension, real type and size', async ({
    client,
    assert,
  }) => {
    const clinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica de Validação de Anexos',
    }).create()
    const doctor = await UserFactory.merge({
      fullName: 'Usuário do Prontuário',
      email: 'attachments.validation.doctor@example.com',
    }).create()

    await createMembership({
      user: doctor,
      clinic,
      roleCode: 'doctor',
    })

    const { patient, medicalRecord } = await createPatient('Paciente de Validação de Anexos')

    const patientLink = await createPatientLink({
      patient,
      clinic,
    })

    const professionalLink = await createProfessionalLink({
      clinic,
      user: doctor,
      fullName: 'Dr. Validação de Anexos',
      crmNumber: '98303',
    })

    const entry = await createEntry({
      medicalRecord,
      patient,
      clinic,
      patientLink,
      professionalLink,
      author: doctor,
      content: 'Entrada para validação dos arquivos.',
    })

    const token = await createToken(doctor)

    const route =
      `/api/v1/clinics/${clinic.id}/patients/${patient.id}` +
      `/medical-record/entries/${entry.id}/attachments`

    const missingFilesResponse = await client
      .post(route)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    missingFilesResponse.assertStatus(422)

    const tooManyFilesResponse = await client
      .post(route)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .file('files[]', validPdfBuffer, {
        filename: 'primeiro.pdf',
        contentType: 'application/pdf',
      })
      .file('files[]', validPdfBuffer, {
        filename: 'segundo.pdf',
        contentType: 'application/pdf',
      })
      .file('files[]', validPdfBuffer, {
        filename: 'terceiro.pdf',
        contentType: 'application/pdf',
      })

    tooManyFilesResponse.assertStatus(422)

    const invalidExtensionResponse = await client
      .post(route)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .file('files[]', Buffer.from('arquivo de texto'), {
        filename: 'observacoes.txt',
        contentType: 'text/plain',
      })

    invalidExtensionResponse.assertStatus(422)

    const disguisedFileResponse = await client
      .post(route)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .file('files[]', Buffer.from('este conteúdo não é um PDF'), {
        filename: 'arquivo-falso.pdf',
        contentType: 'application/pdf',
      })

    disguisedFileResponse.assertStatus(422)

    const oversizedPdfBuffer = Buffer.concat([
      Buffer.from('%PDF-1.4\n'),
      Buffer.alloc(10 * 1024 * 1024),
    ])

    const oversizedFileResponse = await client
      .post(route)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .file('files[]', oversizedPdfBuffer, {
        filename: 'arquivo-grande.pdf',
        contentType: 'application/pdf',
      })

    oversizedFileResponse.assertStatus(422)

    const attachments = await MedicalRecordAttachment.all()

    assert.lengthOf(attachments, 0)

    const storedItems = await listStoredMedicalRecordItems()

    assert.lengthOf(storedItems, 0)
  })

  test('lists only available attachments through the global record and audits access', async ({
    client,
    assert,
  }) => {
    const firstClinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica Leitora de Anexos',
    }).create()
    const secondClinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica de Origem dos Anexos',
    }).create()

    const readerDoctor = await UserFactory.merge({
      fullName: 'Usuário do Prontuário',
      email: 'attachments.list.reader@example.com',
    }).create()
    const authorDoctor = await UserFactory.merge({
      fullName: 'Usuário do Prontuário',
      email: 'attachments.list.author@example.com',
    }).create()

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

    const { patient, medicalRecord } = await createPatient('Paciente de Listagem Global de Anexos')

    const firstPatientLink = await createPatientLink({
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
      fullName: 'Dra. Autora dos Anexos',
      crmNumber: '98401',
    })

    const entry = await createEntry({
      medicalRecord,
      patient,
      clinic: secondClinic,
      patientLink: secondPatientLink,
      professionalLink: authorProfessionalLink,
      author: authorDoctor,
      content: 'Entrada clínica com anexos globais.',
    })

    const firstAvailableAttachment = await createStoredAttachment({
      entry,
      medicalRecord,
      patient,
      clinic: secondClinic,
      uploader: authorDoctor,
      originalName: 'primeira-imagem.png',
    })

    const secondAvailableAttachment = await createStoredAttachment({
      entry,
      medicalRecord,
      patient,
      clinic: secondClinic,
      uploader: authorDoctor,
      originalName: 'segunda-imagem.png',
    })

    await createStoredAttachment({
      entry,
      medicalRecord,
      patient,
      clinic: secondClinic,
      uploader: authorDoctor,
      originalName: 'arquivo-pendente.png',
      status: 'pending',
      persistFile: false,
    })

    await createStoredAttachment({
      entry,
      medicalRecord,
      patient,
      clinic: secondClinic,
      uploader: authorDoctor,
      originalName: 'arquivo-rejeitado.png',
      status: 'rejected',
      persistFile: false,
    })

    const token = await createToken(readerDoctor)

    const route =
      `/api/v1/clinics/${firstClinic.id}/patients/${patient.id}` +
      `/medical-record/entries/${entry.id}/attachments` +
      '?purposeCode=care_coordination&page=1&perPage=1'

    const response = await client
      .get(route)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    response.assertStatus(200)

    assert.equal(response.header('cache-control'), 'private, no-store')
    assert.equal(response.body().meta.total, 2)
    assert.lengthOf(response.body().attachments, 1)

    const responseAttachment = response.body().attachments[0]

    assert.include(
      [firstAvailableAttachment.id, secondAvailableAttachment.id],
      responseAttachment.id
    )

    assert.equal(responseAttachment.medicalRecordEntryId, entry.id)
    assert.equal(responseAttachment.medicalRecordId, medicalRecord.id)
    assert.equal(responseAttachment.patientId, patient.id)
    assert.equal(responseAttachment.clinicId, secondClinic.id)
    assert.equal(responseAttachment.status, 'available')

    assert.notProperty(responseAttachment, 'storageDisk')
    assert.notProperty(responseAttachment, 'storageKey')
    assert.notProperty(responseAttachment, 'sha256')
    assert.notProperty(responseAttachment, 'url')
    assert.notProperty(responseAttachment, 'publicUrl')

    const logs = await MedicalRecordAccessLog.query()
      .where('medical_record_id', medicalRecord.id)
      .where('user_id', readerDoctor.id)
      .where('access_action', 'list_attachments')

    assert.lengthOf(logs, 1)
    assert.equal(logs[0].patientId, patient.id)
    assert.equal(logs[0].clinicId, firstClinic.id)
    assert.equal(logs[0].patientClinicId, firstPatientLink.id)
    assert.equal(logs[0].purposeCode, 'care_coordination')
    assert.isNull(logs[0].purposeNote)
    assert.isNull(logs[0].medicalRecordAttachmentId)
  })

  test('downloads a private attachment with secure headers and audited purpose', async ({
    client,
    assert,
  }) => {
    const clinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica de Download de Anexos',
    }).create()
    const doctor = await UserFactory.merge({
      fullName: 'Usuário do Prontuário',
      email: 'attachments.download.doctor@example.com',
    }).create()

    await createMembership({
      user: doctor,
      clinic,
      roleCode: 'doctor',
    })

    const { patient, medicalRecord } = await createPatient('Paciente de Download de Anexos')

    const patientLink = await createPatientLink({
      patient,
      clinic,
    })

    const professionalLink = await createProfessionalLink({
      clinic,
      user: doctor,
      fullName: 'Dr. Download de Anexos',
      crmNumber: '98402',
    })

    const entry = await createEntry({
      medicalRecord,
      patient,
      clinic,
      patientLink,
      professionalLink,
      author: doctor,
      content: 'Entrada destinada ao teste de download.',
    })

    const attachment = await createStoredAttachment({
      entry,
      medicalRecord,
      patient,
      clinic,
      uploader: doctor,
      originalName: 'imagem-clínica.png',
      content: validPngBuffer,
      contentType: 'image/png',
    })

    const token = await createToken(doctor)
    const purposeNote = 'Revisão do exame durante atendimento clínico'

    const route =
      `/api/v1/clinics/${clinic.id}/patients/${patient.id}` +
      `/medical-record/entries/${entry.id}` +
      `/attachments/${attachment.id}/download` +
      `?purposeCode=other&purposeNote=${encodeURIComponent(purposeNote)}`

    const response = await client.get(route).header('Authorization', `Bearer ${token}`)

    response.assertStatus(200)

    assert.equal(response.header('cache-control'), 'private, no-store')
    assert.equal(response.header('content-type'), 'image/png')
    assert.equal(response.header('content-length'), String(validPngBuffer.length))
    assert.equal(response.header('x-content-type-options'), 'nosniff')

    assert.equal(
      response.header('content-disposition'),
      `attachment; filename="imagem-cl_nica.png"; ` + `filename*=UTF-8''imagem-cl%C3%ADnica.png`
    )

    const downloadedBody = response.body()

    assert.isTrue(Buffer.isBuffer(downloadedBody))
    assert.deepEqual(downloadedBody, validPngBuffer)

    const logs = await MedicalRecordAccessLog.query()
      .where('medical_record_id', medicalRecord.id)
      .where('access_action', 'download_attachment')

    assert.lengthOf(logs, 1)
    assert.equal(logs[0].userId, doctor.id)
    assert.equal(logs[0].clinicId, clinic.id)
    assert.equal(logs[0].patientClinicId, patientLink.id)
    assert.equal(logs[0].purposeCode, 'other')
    assert.equal(logs[0].purposeNote, purposeNote)
    assert.equal(logs[0].medicalRecordAttachmentId, attachment.id)
  })

  test('rejects invalid purpose and attachments that are not physically available', async ({
    client,
    assert,
  }) => {
    const clinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica de Indisponibilidade de Anexos',
    }).create()
    const doctor = await UserFactory.merge({
      fullName: 'Usuário do Prontuário',
      email: 'attachments.unavailable.doctor@example.com',
    }).create()

    await createMembership({
      user: doctor,
      clinic,
      roleCode: 'doctor',
    })

    const { patient, medicalRecord } = await createPatient('Paciente de Anexos Indisponíveis')

    const patientLink = await createPatientLink({
      patient,
      clinic,
    })

    const professionalLink = await createProfessionalLink({
      clinic,
      user: doctor,
      fullName: 'Dra. Anexos Indisponíveis',
      crmNumber: '98403',
    })

    const entry = await createEntry({
      medicalRecord,
      patient,
      clinic,
      patientLink,
      professionalLink,
      author: doctor,
      content: 'Entrada com anexos indisponíveis.',
    })

    const pendingAttachment = await createStoredAttachment({
      entry,
      medicalRecord,
      patient,
      clinic,
      uploader: doctor,
      originalName: 'pendente.png',
      status: 'pending',
      persistFile: false,
    })

    const rejectedAttachment = await createStoredAttachment({
      entry,
      medicalRecord,
      patient,
      clinic,
      uploader: doctor,
      originalName: 'rejeitado.png',
      status: 'rejected',
      statusReason: 'Arquivo rejeitado para acesso',
      persistFile: false,
    })

    const physicallyMissingAttachment = await createStoredAttachment({
      entry,
      medicalRecord,
      patient,
      clinic,
      uploader: doctor,
      originalName: 'arquivo-ausente.png',
      status: 'available',
      persistFile: false,
    })

    const token = await createToken(doctor)

    const routePrefix =
      `/api/v1/clinics/${clinic.id}/patients/${patient.id}` +
      `/medical-record/entries/${entry.id}/attachments`

    const invalidPurposeResponse = await client
      .get(`${routePrefix}?purposeCode=other`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    invalidPurposeResponse.assertStatus(422)

    const pendingResponse = await client
      .get(`${routePrefix}/${pendingAttachment.id}/download` + '?purposeCode=patient_care')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    pendingResponse.assertStatus(409)

    const rejectedResponse = await client
      .get(`${routePrefix}/${rejectedAttachment.id}/download` + '?purposeCode=patient_care')
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    rejectedResponse.assertStatus(409)

    const missingPhysicalFileResponse = await client
      .get(
        `${routePrefix}/${physicallyMissingAttachment.id}/download` + '?purposeCode=patient_care'
      )
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    missingPhysicalFileResponse.assertStatus(409)

    const logs = await MedicalRecordAccessLog.query().where('medical_record_id', medicalRecord.id)

    assert.lengthOf(logs, 0)
  })

  test('requires read permission and prevents attachment access through another patient', async ({
    client,
    assert,
  }) => {
    const clinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica de Escopo de Leitura de Anexos',
    }).create()

    const doctor = await UserFactory.merge({
      fullName: 'Usuário do Prontuário',
      email: 'attachments.read.doctor@example.com',
    }).create()
    const receptionist = await UserFactory.merge({
      fullName: 'Usuário do Prontuário',
      email: 'attachments.read.receptionist@example.com',
    }).create()

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

    const { patient: firstPatient, medicalRecord: firstMedicalRecord } = await createPatient(
      'Primeiro Paciente de Anexos'
    )

    const { patient: secondPatient, medicalRecord: secondMedicalRecord } = await createPatient(
      'Segundo Paciente de Anexos'
    )

    await createPatientLink({
      patient: firstPatient,
      clinic,
    })

    const secondPatientLink = await createPatientLink({
      patient: secondPatient,
      clinic,
    })

    const professionalLink = await createProfessionalLink({
      clinic,
      user: doctor,
      fullName: 'Dr. Escopo de Anexos',
      crmNumber: '98404',
    })

    const secondEntry = await createEntry({
      medicalRecord: secondMedicalRecord,
      patient: secondPatient,
      clinic,
      patientLink: secondPatientLink,
      professionalLink,
      author: doctor,
      content: 'Entrada pertencente ao segundo paciente.',
    })

    const attachment = await createStoredAttachment({
      entry: secondEntry,
      medicalRecord: secondMedicalRecord,
      patient: secondPatient,
      clinic,
      uploader: doctor,
      originalName: 'anexo-segundo-paciente.png',
    })

    const listRoute =
      `/api/v1/clinics/${clinic.id}/patients/${secondPatient.id}` +
      `/medical-record/entries/${secondEntry.id}/attachments` +
      '?purposeCode=patient_care'

    const unauthenticatedResponse = await client.get(listRoute).header('Accept', 'application/json')

    unauthenticatedResponse.assertStatus(401)

    const receptionistToken = await createToken(receptionist)

    const unauthorizedRoleResponse = await client
      .get(listRoute)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${receptionistToken}`)

    unauthorizedRoleResponse.assertStatus(403)

    const doctorToken = await createToken(doctor)

    const wrongPatientDownloadRoute =
      `/api/v1/clinics/${clinic.id}/patients/${firstPatient.id}` +
      `/medical-record/entries/${secondEntry.id}` +
      `/attachments/${attachment.id}/download` +
      '?purposeCode=patient_care'

    const wrongPatientResponse = await client
      .get(wrongPatientDownloadRoute)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${doctorToken}`)

    wrongPatientResponse.assertStatus(404)

    const firstPatientLogs = await MedicalRecordAccessLog.query().where(
      'medical_record_id',
      firstMedicalRecord.id
    )

    const secondPatientLogs = await MedicalRecordAccessLog.query().where(
      'medical_record_id',
      secondMedicalRecord.id
    )

    assert.lengthOf(firstPatientLogs, 0)
    assert.lengthOf(secondPatientLogs, 0)
  })
})
