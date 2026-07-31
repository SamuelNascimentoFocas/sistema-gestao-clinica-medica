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
import MedicalRecordAttachment from '#models/medical_record_attachment'
import MedicalRecordAccessLog, {
  type MedicalRecordAccessAction,
  type MedicalRecordAccessPurpose,
} from '#models/medical_record_access_log'
import Professional from '#models/professional'
import ClinicProfessional from '#models/clinic_professional'
import { truncateClinicSchemaTables } from '../../helpers/database.js'
import { seedAuthorizationCatalog } from '../../../database/seeders/authorization_catalog_seeder.js'

type ClinicRoleCode = 'clinic_admin' | 'receptionist' | 'doctor'

async function createUser({
  email,
  fullName = 'Usuário de Auditoria',
  isGlobalAdmin = false,
}: {
  email: string
  fullName?: string
  isGlobalAdmin?: boolean
}) {
  return User.create({
    fullName,
    email,
    emailNormalized: email.toLowerCase(),
    passwordHash: 'TestPassword!123',
    isGlobalAdmin,
    isActive: true,
  })
}

async function createBearerToken(user: User) {
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
  roleCode: ClinicRoleCode
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
  return MedicalRecordEntry.create({
    medicalRecordId: medicalRecord.id,
    patientId: patient.id,
    clinicId: clinic.id,
    patientClinicId: patientLink.id,
    clinicProfessionalId: professionalLink.id,
    appointmentId: null,
    authorUserId: author.id,
    entryTypeCode: 'evolution',
    content,
    correctsEntryId: null,
  })
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
  return MedicalRecordAttachment.create({
    medicalRecordEntryId: entry.id,
    medicalRecordId: medicalRecord.id,
    patientId: patient.id,
    clinicId: clinic.id,
    uploadedByUserId: uploader.id,
    originalName: 'exame-confidencial.pdf',
    storageDisk: 'private_fs',
    storageKey: `medical-records/${medicalRecord.id}/entries/${entry.id}/audit-test.pdf`,
    contentType: 'application/pdf',
    sizeInBytes: 512,
    sha256: 'a'.repeat(64),
    status: 'available',
    statusReason: null,
  })
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
  return MedicalRecordAccessLog.create({
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
  })
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
    const clinic = await createClinic('Clínica de Permissões da Auditoria')

    const clinicAdmin = await createUser({
      email: 'audit.permissions.admin@example.com',
    })

    const doctor = await createUser({
      email: 'audit.permissions.doctor@example.com',
    })

    const receptionist = await createUser({
      email: 'audit.permissions.receptionist@example.com',
    })

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
    const firstClinic = await createClinic('Primeira Clínica de Auditoria')
    const secondClinic = await createClinic('Segunda Clínica de Auditoria')

    const localAdmin = await createUser({
      email: 'audit.isolation.local@example.com',
    })

    const globalAdmin = await createUser({
      email: 'audit.isolation.global@example.com',
      isGlobalAdmin: true,
    })

    const firstActor = await createUser({
      email: 'audit.isolation.first.actor@example.com',
    })

    const secondActor = await createUser({
      email: 'audit.isolation.second.actor@example.com',
    })

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
    const clinic = await createClinic('Clínica de Filtros da Auditoria')

    const clinicAdmin = await createUser({
      email: 'audit.filters.admin@example.com',
    })

    const firstActor = await createUser({
      email: 'audit.filters.first.actor@example.com',
      fullName: 'Primeiro Médico',
    })

    const secondActor = await createUser({
      email: 'audit.filters.second.actor@example.com',
      fullName: 'Segundo Médico',
    })

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
    const clinic = await createClinic('Clínica de Validação da Auditoria')

    const clinicAdmin = await createUser({
      email: 'audit.validation.admin@example.com',
    })

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
    const clinic = await createClinic('Clínica de Serialização Segura')

    const clinicAdmin = await createUser({
      email: 'audit.serialization.admin@example.com',
    })

    const doctor = await createUser({
      email: 'audit.serialization.doctor@example.com',
      fullName: 'Dra. Ana Auditora',
    })

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
