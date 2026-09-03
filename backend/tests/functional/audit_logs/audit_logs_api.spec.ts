import { MedicalRecordAccessLogFactory } from '#database/factories/medical_record_access_log_factory'
import { MedicalRecordAttachmentFactory } from '#database/factories/medical_record_attachment_factory'
import { MedicalRecordEntryFactory } from '#database/factories/medical_record_entry_factory'
import { ClinicProfessionalFactory } from '#database/factories/clinic_professional_factory'
import { ProfessionalFactory } from '#database/factories/professional_factory'
import { PatientClinicFactory } from '#database/factories/patient_clinic_factory'
import { MedicalRecordFactory } from '#database/factories/medical_record_factory'
import { PatientFactory } from '#database/factories/patient_factory'
import { UserFactory } from '#database/factories/user_factory'
import { ClinicFactory } from '#database/factories/clinic_factory'
import { createMembership } from '#tests/helpers/membership'
import { createBearerToken } from '#tests/helpers/auth'
import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import User from '#models/user'
import Clinic from '#models/clinic'
import Patient from '#models/patient'
import PatientClinic from '#models/patient_clinic'
import MedicalRecord from '#models/medical_record'
import MedicalRecordEntry from '#models/medical_record_entry'
import MedicalRecordAttachment from '#models/medical_record_attachment'
import type {
  MedicalRecordAccessAction,
  MedicalRecordAccessPurpose,
} from '#models/medical_record_access_log'
import ClinicProfessional from '#models/clinic_professional'
import { truncateClinicSchemaTables } from '../../helpers/database.js'
import { seedAuthorizationCatalog } from '../../../database/seeders/authorization_catalog_seeder.js'

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
  content,
}: {
  medicalRecord: MedicalRecord
  patient: Patient
  clinic: Clinic
  patientLink: PatientClinic
  professionalLink: ClinicProfessional
  author: User
  content: string
}) {
  return MedicalRecordEntryFactory.merge({
    medicalRecordId: medicalRecord.id,
    patientId: patient.id,
    clinicId: clinic.id,
    patientClinicId: patientLink.id,
    clinicProfessionalId: professionalLink.id,
    authorUserId: author.id,
    content,
  }).create()
}

async function createAttachment({
  entry,
  medicalRecord,
  patient,
  clinic,
  uploader,
}: {
  entry: MedicalRecordEntry
  medicalRecord: MedicalRecord
  patient: Patient
  clinic: Clinic
  uploader: User
}) {
  return MedicalRecordAttachmentFactory.merge({
    medicalRecordEntryId: entry.id,
    medicalRecordId: medicalRecord.id,
    patientId: patient.id,
    clinicId: clinic.id,
    uploadedByUserId: uploader.id,
    originalName: 'exame-confidencial.pdf',
    storageKey: `medical-records/${medicalRecord.id}/entries/${entry.id}/audit-test.pdf`,
    sizeInBytes: 512,
  }).create()
}

async function createAccessLog({
  medicalRecord,
  patient,
  clinic,
  patientLink,
  user,
  accessAction,
  purposeCode,
  accessedAt,
  purposeNote = null,
  attachment = null,
}: {
  medicalRecord: MedicalRecord
  patient: Patient
  clinic: Clinic
  patientLink: PatientClinic
  user: User
  accessAction: MedicalRecordAccessAction
  purposeCode: MedicalRecordAccessPurpose
  accessedAt: DateTime
  purposeNote?: string | null
  attachment?: MedicalRecordAttachment | null
}) {
  return MedicalRecordAccessLogFactory.merge({
    medicalRecordId: medicalRecord.id,
    patientId: patient.id,
    clinicId: clinic.id,
    patientClinicId: patientLink.id,
    userId: user.id,
    medicalRecordAttachmentId: attachment?.id ?? null,
    accessAction,
    purposeCode,
    purposeNote,
    accessedAt,
  }).create()
}

test.group('Audit logs API', (group) => {
  group.each.setup(async () => {
    await truncateClinicSchemaTables()
    await seedAuthorizationCatalog()

    return async () => {
      await truncateClinicSchemaTables()
    }
  })

  test('requires authentication and audit permission', async ({ client, assert }) => {
    const clinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica de Permissões da Auditoria',
    }).create()

    const clinicAdmin = await UserFactory.merge({
      fullName: 'Usuário de Auditoria',
      email: 'audit.permissions.admin@example.com',
    }).create()

    const doctor = await UserFactory.merge({
      fullName: 'Usuário de Auditoria',
      email: 'audit.permissions.doctor@example.com',
    }).create()

    const receptionist = await UserFactory.merge({
      fullName: 'Usuário de Auditoria',
      email: 'audit.permissions.receptionist@example.com',
    }).create()

    await createMembership({
      user: clinicAdmin,
      clinic,
      roleCode: 'clinic_admin',
    })

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

    const route = `/api/v1/clinics/${clinic.id}/audit-logs`

    const unauthenticatedResponse = await client.get(route).header('Accept', 'application/json')

    unauthenticatedResponse.assertStatus(401)

    const doctorToken = await createBearerToken(doctor)

    const doctorResponse = await client
      .get(route)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${doctorToken}`)

    doctorResponse.assertStatus(403)
    doctorResponse.assertBodyContains({
      message: 'Permissão insuficiente para acessar este recurso',
    })

    const receptionistToken = await createBearerToken(receptionist)

    const receptionistResponse = await client
      .get(route)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${receptionistToken}`)

    receptionistResponse.assertStatus(403)

    const clinicAdminToken = await createBearerToken(clinicAdmin)

    const clinicAdminResponse = await client
      .get(route)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${clinicAdminToken}`)

    clinicAdminResponse.assertStatus(200)

    assert.deepEqual(clinicAdminResponse.body().data, [])
  })

  test('allows local and global administrators while isolating clinics', async ({
    client,
    assert,
  }) => {
    const firstClinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Primeira Clínica de Auditoria',
    }).create()
    const secondClinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Segunda Clínica de Auditoria',
    }).create()

    const localAdmin = await UserFactory.merge({
      fullName: 'Usuário de Auditoria',
      email: 'audit.isolation.local@example.com',
    }).create()

    const globalAdmin = await UserFactory.apply('globalAdmin')
      .merge({ fullName: 'Usuário de Auditoria', email: 'audit.isolation.global@example.com' })
      .create()

    const firstActor = await UserFactory.merge({
      fullName: 'Usuário de Auditoria',
      email: 'audit.isolation.first.actor@example.com',
    }).create()

    const secondActor = await UserFactory.merge({
      fullName: 'Usuário de Auditoria',
      email: 'audit.isolation.second.actor@example.com',
    }).create()

    await createMembership({
      user: localAdmin,
      clinic: firstClinic,
      roleCode: 'clinic_admin',
    })

    await createMembership({
      user: firstActor,
      clinic: firstClinic,
      roleCode: 'doctor',
    })

    await createMembership({
      user: secondActor,
      clinic: secondClinic,
      roleCode: 'doctor',
    })

    const firstPatientData = await createPatient('Paciente da Primeira Clínica')
    const secondPatientData = await createPatient('Paciente da Segunda Clínica')

    const firstPatientLink = await createPatientLink({
      patient: firstPatientData.patient,
      clinic: firstClinic,
    })

    const secondPatientLink = await createPatientLink({
      patient: secondPatientData.patient,
      clinic: secondClinic,
    })

    const firstLog = await createAccessLog({
      medicalRecord: firstPatientData.medicalRecord,
      patient: firstPatientData.patient,
      clinic: firstClinic,
      patientLink: firstPatientLink,
      user: firstActor,
      accessAction: 'view_timeline',
      purposeCode: 'patient_care',
      accessedAt: DateTime.fromISO('2026-07-01T12:00:00Z'),
    })

    const secondLog = await createAccessLog({
      medicalRecord: secondPatientData.medicalRecord,
      patient: secondPatientData.patient,
      clinic: secondClinic,
      patientLink: secondPatientLink,
      user: secondActor,
      accessAction: 'view_entry',
      purposeCode: 'care_coordination',
      accessedAt: DateTime.fromISO('2026-07-02T12:00:00Z'),
    })

    const localToken = await createBearerToken(localAdmin)

    const localResponse = await client
      .get(`/api/v1/clinics/${firstClinic.id}/audit-logs`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${localToken}`)

    localResponse.assertStatus(200)

    assert.lengthOf(localResponse.body().data, 1)
    assert.equal(localResponse.body().data[0].id, firstLog.id)
    assert.notEqual(localResponse.body().data[0].id, secondLog.id)

    const forbiddenOtherClinicResponse = await client
      .get(`/api/v1/clinics/${secondClinic.id}/audit-logs`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${localToken}`)

    forbiddenOtherClinicResponse.assertStatus(403)

    const globalToken = await createBearerToken(globalAdmin)

    const globalFirstClinicResponse = await client
      .get(`/api/v1/clinics/${firstClinic.id}/audit-logs`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${globalToken}`)

    globalFirstClinicResponse.assertStatus(200)

    assert.lengthOf(globalFirstClinicResponse.body().data, 1)
    assert.equal(globalFirstClinicResponse.body().data[0].id, firstLog.id)

    const globalSecondClinicResponse = await client
      .get(`/api/v1/clinics/${secondClinic.id}/audit-logs`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${globalToken}`)

    globalSecondClinicResponse.assertStatus(200)

    assert.lengthOf(globalSecondClinicResponse.body().data, 1)
    assert.equal(globalSecondClinicResponse.body().data[0].id, secondLog.id)
  })

  test('orders, filters and paginates audit logs', async ({ client, assert }) => {
    const clinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica de Filtros da Auditoria',
    }).create()

    const clinicAdmin = await UserFactory.merge({
      fullName: 'Usuário de Auditoria',
      email: 'audit.filters.admin@example.com',
    }).create()

    const firstActor = await UserFactory.merge({
      email: 'audit.filters.first.actor@example.com',
      fullName: 'Primeiro Médico',
    }).create()

    const secondActor = await UserFactory.merge({
      email: 'audit.filters.second.actor@example.com',
      fullName: 'Segundo Médico',
    }).create()

    await createMembership({
      user: clinicAdmin,
      clinic,
      roleCode: 'clinic_admin',
    })

    const firstPatientData = await createPatient('Primeiro Paciente')
    const secondPatientData = await createPatient('Segundo Paciente')

    const firstPatientLink = await createPatientLink({
      patient: firstPatientData.patient,
      clinic,
    })

    const secondPatientLink = await createPatientLink({
      patient: secondPatientData.patient,
      clinic,
    })

    const oldestLog = await createAccessLog({
      medicalRecord: firstPatientData.medicalRecord,
      patient: firstPatientData.patient,
      clinic,
      patientLink: firstPatientLink,
      user: firstActor,
      accessAction: 'view_timeline',
      purposeCode: 'patient_care',
      accessedAt: DateTime.fromISO('2026-07-01T10:00:00Z'),
    })

    const middleLog = await createAccessLog({
      medicalRecord: secondPatientData.medicalRecord,
      patient: secondPatientData.patient,
      clinic,
      patientLink: secondPatientLink,
      user: secondActor,
      accessAction: 'view_entry',
      purposeCode: 'care_coordination',
      accessedAt: DateTime.fromISO('2026-07-02T10:00:00Z'),
    })

    const newestLog = await createAccessLog({
      medicalRecord: secondPatientData.medicalRecord,
      patient: secondPatientData.patient,
      clinic,
      patientLink: secondPatientLink,
      user: firstActor,
      accessAction: 'view_timeline',
      purposeCode: 'legal_obligation',
      accessedAt: DateTime.fromISO('2026-07-03T10:00:00Z'),
    })

    const token = await createBearerToken(clinicAdmin)
    const route = `/api/v1/clinics/${clinic.id}/audit-logs`

    const firstPageResponse = await client
      .get(route)
      .qs({
        page: 1,
        perPage: 2,
      })
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    firstPageResponse.assertStatus(200)

    assert.lengthOf(firstPageResponse.body().data, 2)
    assert.equal(firstPageResponse.body().data[0].id, newestLog.id)
    assert.equal(firstPageResponse.body().data[1].id, middleLog.id)
    assert.equal(Number(firstPageResponse.body().meta.total), 3)

    const secondPageResponse = await client
      .get(route)
      .qs({
        page: 2,
        perPage: 2,
      })
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    secondPageResponse.assertStatus(200)

    assert.lengthOf(secondPageResponse.body().data, 1)
    assert.equal(secondPageResponse.body().data[0].id, oldestLog.id)

    const filteredResponse = await client
      .get(route)
      .qs({
        userId: firstActor.id,
        patientId: secondPatientData.patient.id,
        accessAction: 'view_timeline',
        purposeCode: 'legal_obligation',
        from: '2026-07-02T00:00:00Z',
        to: '2026-07-04T00:00:00Z',
      })
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    filteredResponse.assertStatus(200)

    assert.lengthOf(filteredResponse.body().data, 1)
    assert.equal(filteredResponse.body().data[0].id, newestLog.id)
  })

  test('rejects invalid date ranges and invalid filters', async ({ client }) => {
    const clinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica de Validação da Auditoria',
    }).create()

    const clinicAdmin = await UserFactory.merge({
      fullName: 'Usuário de Auditoria',
      email: 'audit.validation.admin@example.com',
    }).create()

    await createMembership({
      user: clinicAdmin,
      clinic,
      roleCode: 'clinic_admin',
    })

    const token = await createBearerToken(clinicAdmin)
    const route = `/api/v1/clinics/${clinic.id}/audit-logs`

    const invalidRangeResponse = await client
      .get(route)
      .qs({
        from: '2026-07-10T00:00:00Z',
        to: '2026-07-01T00:00:00Z',
      })
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    invalidRangeResponse.assertStatus(422)
    invalidRangeResponse.assertBodyContains({
      message: 'A data inicial do filtro deve ser anterior à data final',
    })

    const invalidActionResponse = await client
      .get(route)
      .qs({
        accessAction: 'delete_medical_record',
      })
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    invalidActionResponse.assertStatus(422)

    const invalidPageSizeResponse = await client
      .get(route)
      .qs({
        perPage: 101,
      })
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    invalidPageSizeResponse.assertStatus(422)
  })

  test('returns only safe audit information', async ({ client, assert }) => {
    const clinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica de Serialização Segura',
    }).create()

    const clinicAdmin = await UserFactory.merge({
      fullName: 'Usuário de Auditoria',
      email: 'audit.serialization.admin@example.com',
    }).create()

    const doctor = await UserFactory.merge({
      email: 'audit.serialization.doctor@example.com',
      fullName: 'Dra. Ana Auditora',
    }).create()

    await createMembership({
      user: clinicAdmin,
      clinic,
      roleCode: 'clinic_admin',
    })

    await createMembership({
      user: doctor,
      clinic,
      roleCode: 'doctor',
    })

    const { patient, medicalRecord } = await createPatient('Paciente com Dados Confidenciais')

    const patientLink = await createPatientLink({
      patient,
      clinic,
    })

    const professionalLink = await createProfessionalLink({
      clinic,
      user: doctor,
      fullName: 'Dra. Ana Auditora',
      crmNumber: 'AUDIT-12345',
    })

    const entry = await createEntry({
      medicalRecord,
      patient,
      clinic,
      patientLink,
      professionalLink,
      author: doctor,
      content: 'Conteúdo clínico sigiloso que não pode aparecer na auditoria.',
    })

    const attachment = await createAttachment({
      entry,
      medicalRecord,
      patient,
      clinic,
      uploader: doctor,
    })

    const accessLog = await createAccessLog({
      medicalRecord,
      patient,
      clinic,
      patientLink,
      user: doctor,
      attachment,
      accessAction: 'download_attachment',
      purposeCode: 'other',
      purposeNote: 'Revisão administrativa autorizada',
      accessedAt: DateTime.fromISO('2026-07-04T10:00:00Z'),
    })

    const token = await createBearerToken(clinicAdmin)

    const response = await client
      .get(`/api/v1/clinics/${clinic.id}/audit-logs`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    response.assertStatus(200)

    assert.lengthOf(response.body().data, 1)

    const result = response.body().data[0]

    assert.equal(result.id, accessLog.id)
    assert.equal(result.medicalRecordId, medicalRecord.id)
    assert.equal(result.patientClinicId, patientLink.id)
    assert.equal(result.accessAction, 'download_attachment')
    assert.equal(result.purposeCode, 'other')
    assert.equal(result.purposeNote, 'Revisão administrativa autorizada')

    assert.deepEqual(result.user, {
      id: doctor.id,
      fullName: doctor.fullName,
    })

    assert.notProperty(result.user, 'email')
    assert.notProperty(result.user, 'emailNormalized')
    assert.notProperty(result.user, 'passwordHash')
    assert.notProperty(result.user, 'isGlobalAdmin')

    assert.deepEqual(result.patient, {
      id: patient.id,
      fullName: patient.fullName,
    })

    assert.notProperty(result.patient, 'cpf')
    assert.notProperty(result.patient, 'phone')
    assert.notProperty(result.patient, 'email')
    assert.notProperty(result.patient, 'birthDate')

    assert.deepEqual(result.attachment, {
      id: attachment.id,
      originalName: attachment.originalName,
      contentType: attachment.contentType,
      sizeInBytes: attachment.sizeInBytes,
    })

    assert.notProperty(result.attachment, 'storageDisk')
    assert.notProperty(result.attachment, 'storageKey')
    assert.notProperty(result.attachment, 'sha256')
    assert.notProperty(result.attachment, 'status')
    assert.notProperty(result.attachment, 'statusReason')

    assert.notProperty(result, 'clinicId')
    assert.notProperty(result, 'userId')
    assert.notProperty(result, 'patientId')
    assert.notProperty(result, 'medicalRecordAttachmentId')
    assert.notProperty(result, 'content')
  })
})
