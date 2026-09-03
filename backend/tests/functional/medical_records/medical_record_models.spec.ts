import { MedicalRecordEntryFactory } from '#database/factories/medical_record_entry_factory'
import { AppointmentFactory } from '#database/factories/appointment_factory'
import { ClinicProfessionalFactory } from '#database/factories/clinic_professional_factory'
import { ProfessionalFactory } from '#database/factories/professional_factory'
import { PatientClinicFactory } from '#database/factories/patient_clinic_factory'
import { MedicalRecordFactory } from '#database/factories/medical_record_factory'
import { PatientFactory } from '#database/factories/patient_factory'
import { UserFactory } from '#database/factories/user_factory'
import { ClinicFactory } from '#database/factories/clinic_factory'
import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
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

type PostgreSqlError = {
  code?: string
  constraint?: string
}

async function captureRejectedError(action: () => Promise<unknown>) {
  try {
    await action()
  } catch (error) {
    return error as PostgreSqlError
  }

  throw new Error('A operação deveria ter sido rejeitada pelo banco de dados')
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

  const professionalLink = await ClinicProfessionalFactory.merge({
    clinicId: clinic.id,
    professionalId: professional.id,
    defaultAppointmentDurationMinutes: 60,
  }).create()

  return {
    professional,
    professionalLink,
  }
}

async function createAppointment({
  clinic,
  patientLink,
  professionalLink,
  user,
  startsAt,
}: {
  clinic: Clinic
  patientLink: PatientClinic
  professionalLink: ClinicProfessional
  user: User
  startsAt: DateTime
}) {
  return AppointmentFactory.merge({
    clinicId: clinic.id,
    patientClinicId: patientLink.id,
    clinicProfessionalId: professionalLink.id,
    startsAt,
    endsAt: startsAt.plus({ hours: 1 }),
    createdByUserId: user.id,
  }).create()
}

async function createClinicalEntry({
  medicalRecord,
  patient,
  clinic,
  patientLink,
  professionalLink,
  user,
  content = 'Clinical entry with attachment.',
}: {
  medicalRecord: MedicalRecord
  patient: Patient
  clinic: Clinic
  patientLink: PatientClinic
  professionalLink: ClinicProfessional
  user: User
  content?: string
}) {
  return MedicalRecordEntryFactory.merge({
    medicalRecordId: medicalRecord.id,
    patientId: patient.id,
    clinicId: clinic.id,
    patientClinicId: patientLink.id,
    clinicProfessionalId: professionalLink.id,
    authorUserId: user.id,
    content,
  }).create()
}

async function createAttachment({
  entry,
  medicalRecord,
  patient,
  clinic,
  user,
  storageKey,
  originalName = 'clinical-document.pdf',
  contentType = 'application/pdf',
  sizeInBytes = 2048,
  sha256 = 'a'.repeat(64),
  status = 'available',
  statusReason = null,
}: {
  entry: MedicalRecordEntry
  medicalRecord: MedicalRecord
  patient: Patient
  clinic: Clinic
  user: User
  storageKey: string
  originalName?: string
  contentType?: string
  sizeInBytes?: number
  sha256?: string
  status?: 'pending' | 'available' | 'rejected'
  statusReason?: string | null
}) {
  return MedicalRecordAttachment.create({
    medicalRecordEntryId: entry.id,
    medicalRecordId: medicalRecord.id,
    patientId: patient.id,
    clinicId: clinic.id,
    uploadedByUserId: user.id,
    originalName,
    storageDisk: 'private_fs',
    storageKey,
    contentType,
    sizeInBytes,
    sha256,
    status,
    statusReason,
  })
}

test.group('Medical record models', (group) => {
  group.each.setup(async () => {
    await truncateClinicSchemaTables()

    return async () => {
      await truncateClinicSchemaTables()
    }
  })

  test('builds one global timeline with entries and access logs from multiple clinics', async ({
    assert,
  }) => {
    const firstClinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Primeiro Consultório Clínico',
    }).create()
    const secondClinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Segundo Consultório Clínico',
    }).create()

    const firstDoctor = await UserFactory.merge({
      fullName: 'Usuário Clínico',
      email: 'records.first.doctor@example.com',
    }).create()
    const secondDoctor = await UserFactory.merge({
      fullName: 'Usuário Clínico',
      email: 'records.second.doctor@example.com',
    }).create()

    const { patient, medicalRecord } = await createPatient('Paciente com Prontuário Global')

    const firstPatientLink = await createPatientLink({
      patient,
      clinic: firstClinic,
    })

    const secondPatientLink = await createPatientLink({
      patient,
      clinic: secondClinic,
    })

    const { professionalLink: firstProfessionalLink } = await createProfessionalLink({
      clinic: firstClinic,
      user: firstDoctor,
      fullName: 'Dr. Primeiro Prontuário',
      crmNumber: '97001',
    })

    const { professionalLink: secondProfessionalLink } = await createProfessionalLink({
      clinic: secondClinic,
      user: secondDoctor,
      fullName: 'Dra. Segundo Prontuário',
      crmNumber: '97002',
    })

    const appointment = await createAppointment({
      clinic: firstClinic,
      patientLink: firstPatientLink,
      professionalLink: firstProfessionalLink,
      user: firstDoctor,
      startsAt: DateTime.utc().plus({ days: 10 }),
    })

    const consultationEntry = await MedicalRecordEntry.create({
      medicalRecordId: medicalRecord.id,
      patientId: patient.id,
      clinicId: firstClinic.id,
      patientClinicId: firstPatientLink.id,
      clinicProfessionalId: firstProfessionalLink.id,
      appointmentId: appointment.id,
      authorUserId: firstDoctor.id,
      entryTypeCode: 'consultation',
      content: 'Consulta clínica inicial.',
      correctsEntryId: null,
    })

    const evolutionEntry = await MedicalRecordEntry.create({
      medicalRecordId: medicalRecord.id,
      patientId: patient.id,
      clinicId: secondClinic.id,
      patientClinicId: secondPatientLink.id,
      clinicProfessionalId: secondProfessionalLink.id,
      appointmentId: null,
      authorUserId: secondDoctor.id,
      entryTypeCode: 'evolution',
      content: 'Evolução clínica registrada no segundo consultório.',
      correctsEntryId: null,
    })

    const correctionEntry = await MedicalRecordEntry.create({
      medicalRecordId: medicalRecord.id,
      patientId: patient.id,
      clinicId: firstClinic.id,
      patientClinicId: firstPatientLink.id,
      clinicProfessionalId: firstProfessionalLink.id,
      appointmentId: appointment.id,
      authorUserId: firstDoctor.id,
      entryTypeCode: 'correction',
      content: 'Correção complementar da consulta inicial.',
      correctsEntryId: consultationEntry.id,
    })

    await MedicalRecordAccessLog.create({
      medicalRecordId: medicalRecord.id,
      patientId: patient.id,
      clinicId: firstClinic.id,
      patientClinicId: firstPatientLink.id,
      userId: firstDoctor.id,
      accessAction: 'view_timeline',
      purposeCode: 'patient_care',
      purposeNote: null,
    })

    await MedicalRecordAccessLog.create({
      medicalRecordId: medicalRecord.id,
      patientId: patient.id,
      clinicId: secondClinic.id,
      patientClinicId: secondPatientLink.id,
      userId: secondDoctor.id,
      accessAction: 'view_entry',
      purposeCode: 'care_coordination',
      purposeNote: null,
    })

    const loadedRecord = await MedicalRecord.query()
      .where('id', medicalRecord.id)
      .preload('patient')
      .preload('entries', (entryQuery) => {
        entryQuery
          .preload('clinic')
          .preload('patientClinic')
          .preload('clinicProfessional', (professionalQuery) => {
            professionalQuery.preload('professional')
          })
          .preload('appointment')
          .preload('authorUser')
          .preload('correctedEntry')
          .preload('corrections')
      })
      .preload('accessLogs', (logQuery) => {
        logQuery.preload('clinic').preload('patientClinic').preload('user')
      })
      .firstOrFail()

    assert.equal(loadedRecord.patient.id, patient.id)
    assert.lengthOf(loadedRecord.entries, 3)
    assert.lengthOf(loadedRecord.accessLogs, 2)

    const entryClinicIds = loadedRecord.entries.map((entry) => entry.clinicId)

    assert.include(entryClinicIds, firstClinic.id)
    assert.include(entryClinicIds, secondClinic.id)

    const loadedConsultation = loadedRecord.entries.find(
      (entry) => entry.id === consultationEntry.id
    )

    const loadedEvolution = loadedRecord.entries.find((entry) => entry.id === evolutionEntry.id)

    const loadedCorrection = loadedRecord.entries.find((entry) => entry.id === correctionEntry.id)

    assert.exists(loadedConsultation)
    assert.exists(loadedEvolution)
    assert.exists(loadedCorrection)

    assert.equal(loadedConsultation!.appointment.id, appointment.id)
    assert.equal(loadedConsultation!.authorUser.id, firstDoctor.id)
    assert.lengthOf(loadedConsultation!.corrections, 1)
    assert.equal(loadedConsultation!.corrections[0].id, correctionEntry.id)

    assert.equal(loadedCorrection!.correctedEntry.id, consultationEntry.id)

    assert.isNull(loadedEvolution!.appointmentId)
  })

  test('enforces patient, clinic, professional and appointment context', async ({ assert }) => {
    const firstClinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica de Contexto Um',
    }).create()
    const secondClinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica de Contexto Dois',
    }).create()

    const firstDoctor = await UserFactory.merge({
      fullName: 'Usuário Clínico',
      email: 'records.context.first@example.com',
    }).create()
    const secondDoctor = await UserFactory.merge({
      fullName: 'Usuário Clínico',
      email: 'records.context.second@example.com',
    }).create()

    const { patient: firstPatient, medicalRecord: firstRecord } = await createPatient(
      'Primeiro Paciente de Contexto'
    )

    const { patient: secondPatient, medicalRecord: secondRecord } = await createPatient(
      'Segundo Paciente de Contexto'
    )

    const firstPatientLink = await createPatientLink({
      patient: firstPatient,
      clinic: firstClinic,
    })

    const secondPatientLink = await createPatientLink({
      patient: secondPatient,
      clinic: firstClinic,
    })

    const secondClinicPatientLink = await createPatientLink({
      patient: firstPatient,
      clinic: secondClinic,
    })

    const { professionalLink: firstProfessionalLink } = await createProfessionalLink({
      clinic: firstClinic,
      user: firstDoctor,
      fullName: 'Dr. Primeiro Contexto',
      crmNumber: '97101',
    })

    const { professionalLink: alternateProfessionalLink } = await createProfessionalLink({
      clinic: firstClinic,
      user: secondDoctor,
      fullName: 'Dra. Contexto Alternativo',
      crmNumber: '97102',
    })

    const secondClinicDoctor = await UserFactory.merge({
      fullName: 'Usuário Clínico',
      email: 'records.context.second.clinic@example.com',
    }).create()

    const { professionalLink: secondClinicProfessionalLink } = await createProfessionalLink({
      clinic: secondClinic,
      user: secondClinicDoctor,
      fullName: 'Dr. Segundo Consultório',
      crmNumber: '97103',
    })

    const appointment = await createAppointment({
      clinic: firstClinic,
      patientLink: firstPatientLink,
      professionalLink: firstProfessionalLink,
      user: firstDoctor,
      startsAt: DateTime.utc().plus({ days: 15 }),
    })

    const originalEntry = await MedicalRecordEntry.create({
      medicalRecordId: firstRecord.id,
      patientId: firstPatient.id,
      clinicId: firstClinic.id,
      patientClinicId: firstPatientLink.id,
      clinicProfessionalId: firstProfessionalLink.id,
      appointmentId: appointment.id,
      authorUserId: firstDoctor.id,
      entryTypeCode: 'consultation',
      content: 'Entrada original válida.',
      correctsEntryId: null,
    })

    const wrongPatientLinkError = await captureRejectedError(() =>
      MedicalRecordEntry.create({
        medicalRecordId: firstRecord.id,
        patientId: firstPatient.id,
        clinicId: firstClinic.id,
        patientClinicId: secondPatientLink.id,
        clinicProfessionalId: firstProfessionalLink.id,
        appointmentId: null,
        authorUserId: firstDoctor.id,
        entryTypeCode: 'evolution',
        content: 'Contexto de paciente incompatível.',
        correctsEntryId: null,
      })
    )

    assert.equal(wrongPatientLinkError.code, '23503')

    const wrongClinicProfessionalError = await captureRejectedError(() =>
      MedicalRecordEntry.create({
        medicalRecordId: firstRecord.id,
        patientId: firstPatient.id,
        clinicId: secondClinic.id,
        patientClinicId: secondClinicPatientLink.id,
        clinicProfessionalId: firstProfessionalLink.id,
        appointmentId: null,
        authorUserId: secondClinicDoctor.id,
        entryTypeCode: 'evolution',
        content: 'Profissional pertencente a outro consultório.',
        correctsEntryId: null,
      })
    )

    assert.equal(wrongClinicProfessionalError.code, '23503')

    const wrongAppointmentProfessionalError = await captureRejectedError(() =>
      MedicalRecordEntry.create({
        medicalRecordId: firstRecord.id,
        patientId: firstPatient.id,
        clinicId: firstClinic.id,
        patientClinicId: firstPatientLink.id,
        clinicProfessionalId: alternateProfessionalLink.id,
        appointmentId: appointment.id,
        authorUserId: secondDoctor.id,
        entryTypeCode: 'consultation',
        content: 'Profissional incompatível com o agendamento.',
        correctsEntryId: null,
      })
    )

    assert.equal(wrongAppointmentProfessionalError.code, '23503')

    const crossRecordCorrectionError = await captureRejectedError(() =>
      MedicalRecordEntry.create({
        medicalRecordId: secondRecord.id,
        patientId: secondPatient.id,
        clinicId: firstClinic.id,
        patientClinicId: secondPatientLink.id,
        clinicProfessionalId: alternateProfessionalLink.id,
        appointmentId: null,
        authorUserId: secondDoctor.id,
        entryTypeCode: 'correction',
        content: 'Correção apontando para outro prontuário.',
        correctsEntryId: originalEntry.id,
      })
    )

    assert.equal(crossRecordCorrectionError.code, '23503')

    const invalidCorrectionError = await captureRejectedError(() =>
      MedicalRecordEntry.create({
        medicalRecordId: firstRecord.id,
        patientId: firstPatient.id,
        clinicId: firstClinic.id,
        patientClinicId: firstPatientLink.id,
        clinicProfessionalId: firstProfessionalLink.id,
        appointmentId: null,
        authorUserId: firstDoctor.id,
        entryTypeCode: 'correction',
        content: 'Correção sem entrada original.',
        correctsEntryId: null,
      })
    )

    assert.equal(invalidCorrectionError.code, '23514')

    const blankContentError = await captureRejectedError(() =>
      MedicalRecordEntry.create({
        medicalRecordId: firstRecord.id,
        patientId: firstPatient.id,
        clinicId: firstClinic.id,
        patientClinicId: firstPatientLink.id,
        clinicProfessionalId: firstProfessionalLink.id,
        appointmentId: null,
        authorUserId: firstDoctor.id,
        entryTypeCode: 'evolution',
        content: '   ',
        correctsEntryId: null,
      })
    )

    assert.equal(blankContentError.code, '23514')

    assert.equal(secondClinicProfessionalLink.clinicId, secondClinic.id)
  })

  test('keeps clinical entries and access logs immutable', async ({ assert }) => {
    const clinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica de Imutabilidade',
    }).create()
    const doctor = await UserFactory.merge({
      fullName: 'Usuário Clínico',
      email: 'records.immutable@example.com',
    }).create()

    const { patient, medicalRecord } = await createPatient('Paciente de Imutabilidade')

    const patientLink = await createPatientLink({
      patient,
      clinic,
    })

    const { professionalLink } = await createProfessionalLink({
      clinic,
      user: doctor,
      fullName: 'Dra. Imutabilidade',
      crmNumber: '97201',
    })

    const entry = await MedicalRecordEntry.create({
      medicalRecordId: medicalRecord.id,
      patientId: patient.id,
      clinicId: clinic.id,
      patientClinicId: patientLink.id,
      clinicProfessionalId: professionalLink.id,
      appointmentId: null,
      authorUserId: doctor.id,
      entryTypeCode: 'evolution',
      content: 'Conteúdo clínico original e imutável.',
      correctsEntryId: null,
    })

    const accessLog = await MedicalRecordAccessLog.create({
      medicalRecordId: medicalRecord.id,
      patientId: patient.id,
      clinicId: clinic.id,
      patientClinicId: patientLink.id,
      userId: doctor.id,
      accessAction: 'view_timeline',
      purposeCode: 'patient_care',
      purposeNote: null,
    })

    const entryUpdateError = await captureRejectedError(() =>
      db.rawQuery(
        `
          UPDATE clinic.medical_record_entries
          SET content = ?
          WHERE id = ?
        `,
        ['Conteúdo indevidamente alterado.', entry.id]
      )
    )

    assert.equal(entryUpdateError.code, '55000')

    const entryDeleteError = await captureRejectedError(() =>
      db.rawQuery(
        `
          DELETE FROM clinic.medical_record_entries
          WHERE id = ?
        `,
        [entry.id]
      )
    )

    assert.equal(entryDeleteError.code, '55000')

    const logUpdateError = await captureRejectedError(() =>
      db.rawQuery(
        `
          UPDATE clinic.medical_record_access_logs
          SET purpose_code = ?
          WHERE id = ?
        `,
        ['legal_obligation', accessLog.id]
      )
    )

    assert.equal(logUpdateError.code, '55000')

    const logDeleteError = await captureRejectedError(() =>
      db.rawQuery(
        `
          DELETE FROM clinic.medical_record_access_logs
          WHERE id = ?
        `,
        [accessLog.id]
      )
    )

    assert.equal(logDeleteError.code, '55000')

    const persistedEntry = await MedicalRecordEntry.findOrFail(entry.id)
    const persistedLog = await MedicalRecordAccessLog.findOrFail(accessLog.id)

    assert.equal(persistedEntry.content, 'Conteúdo clínico original e imutável.')

    assert.equal(persistedLog.purposeCode, 'patient_care')
  })

  test('validates access-log purpose and medical-record context', async ({ assert }) => {
    const clinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica de Logs',
    }).create()
    const doctor = await UserFactory.merge({
      fullName: 'Usuário Clínico',
      email: 'records.logs@example.com',
    }).create()

    const { patient: firstPatient, medicalRecord: firstRecord } = await createPatient(
      'Primeiro Paciente de Logs'
    )

    const { patient: secondPatient } = await createPatient('Segundo Paciente de Logs')

    const firstPatientLink = await createPatientLink({
      patient: firstPatient,
      clinic,
    })

    const secondPatientLink = await createPatientLink({
      patient: secondPatient,
      clinic,
    })

    const validLog = await MedicalRecordAccessLog.create({
      medicalRecordId: firstRecord.id,
      patientId: firstPatient.id,
      clinicId: clinic.id,
      patientClinicId: firstPatientLink.id,
      userId: doctor.id,
      accessAction: 'view_timeline',
      purposeCode: 'other',
      purposeNote: 'Revisão autorizada para finalidade específica.',
    })

    assert.equal(validLog.purposeCode, 'other')

    const missingPurposeNoteError = await captureRejectedError(() =>
      MedicalRecordAccessLog.create({
        medicalRecordId: firstRecord.id,
        patientId: firstPatient.id,
        clinicId: clinic.id,
        patientClinicId: firstPatientLink.id,
        userId: doctor.id,
        accessAction: 'view_timeline',
        purposeCode: 'other',
        purposeNote: null,
      })
    )

    assert.equal(missingPurposeNoteError.code, '23514')

    const incompatiblePatientLinkError = await captureRejectedError(() =>
      MedicalRecordAccessLog.create({
        medicalRecordId: firstRecord.id,
        patientId: firstPatient.id,
        clinicId: clinic.id,
        patientClinicId: secondPatientLink.id,
        userId: doctor.id,
        accessAction: 'view_entry',
        purposeCode: 'patient_care',
        purposeNote: null,
      })
    )

    assert.equal(incompatiblePatientLinkError.code, '23503')
  })

  test('relates attachments to entries, records, users and download logs', async ({ assert }) => {
    const clinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Attachment Relations Clinic',
    }).create()
    const doctor = await UserFactory.merge({
      fullName: 'Usuário Clínico',
      email: 'attachments.relations@example.com',
    }).create()

    const { patient, medicalRecord } = await createPatient('Attachment Relations Patient')

    const patientLink = await createPatientLink({
      patient,
      clinic,
    })

    const { professionalLink } = await createProfessionalLink({
      clinic,
      user: doctor,
      fullName: 'Dr. Attachment Relations',
      crmNumber: '97301',
    })

    const entry = await createClinicalEntry({
      medicalRecord,
      patient,
      clinic,
      patientLink,
      professionalLink,
      user: doctor,
    })

    const attachment = await createAttachment({
      entry,
      medicalRecord,
      patient,
      clinic,
      user: doctor,
      storageKey: `${medicalRecord.id}/${entry.id}/relations-document.pdf`,
    })

    const downloadLog = await MedicalRecordAccessLog.create({
      medicalRecordId: medicalRecord.id,
      patientId: patient.id,
      clinicId: clinic.id,
      patientClinicId: patientLink.id,
      userId: doctor.id,
      medicalRecordAttachmentId: attachment.id,
      accessAction: 'download_attachment',
      purposeCode: 'patient_care',
      purposeNote: null,
    })

    const loadedEntry = await MedicalRecordEntry.query()
      .where('id', entry.id)
      .preload('attachments')
      .firstOrFail()

    const loadedRecord = await MedicalRecord.query()
      .where('id', medicalRecord.id)
      .preload('attachments')
      .firstOrFail()

    const loadedAttachment = await MedicalRecordAttachment.query()
      .where('id', attachment.id)
      .preload('medicalRecordEntry')
      .preload('medicalRecord')
      .preload('patient')
      .preload('clinic')
      .preload('uploadedByUser')
      .preload('accessLogs')
      .firstOrFail()

    const loadedLog = await MedicalRecordAccessLog.query()
      .where('id', downloadLog.id)
      .preload('medicalRecordAttachment')
      .firstOrFail()

    assert.lengthOf(loadedEntry.attachments, 1)
    assert.equal(loadedEntry.attachments[0].id, attachment.id)

    assert.lengthOf(loadedRecord.attachments, 1)
    assert.equal(loadedRecord.attachments[0].id, attachment.id)

    assert.equal(loadedAttachment.medicalRecordEntry.id, entry.id)
    assert.equal(loadedAttachment.medicalRecord.id, medicalRecord.id)
    assert.equal(loadedAttachment.patient.id, patient.id)
    assert.equal(loadedAttachment.clinic.id, clinic.id)
    assert.equal(loadedAttachment.uploadedByUser.id, doctor.id)

    assert.lengthOf(loadedAttachment.accessLogs, 1)
    assert.equal(loadedAttachment.accessLogs[0].id, downloadLog.id)

    assert.equal(loadedLog.medicalRecordAttachment.id, attachment.id)
  })

  test('enforces attachment scope, storage uniqueness and metadata constraints', async ({
    assert,
  }) => {
    const clinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Attachment Constraints Clinic',
    }).create()
    const doctor = await UserFactory.merge({
      fullName: 'Usuário Clínico',
      email: 'attachments.constraints@example.com',
    }).create()

    const { patient: firstPatient, medicalRecord: firstRecord } = await createPatient(
      'First Attachment Patient'
    )

    const { patient: secondPatient, medicalRecord: secondRecord } = await createPatient(
      'Second Attachment Patient'
    )

    const firstPatientLink = await createPatientLink({
      patient: firstPatient,
      clinic,
    })

    const secondPatientLink = await createPatientLink({
      patient: secondPatient,
      clinic,
    })

    const { professionalLink } = await createProfessionalLink({
      clinic,
      user: doctor,
      fullName: 'Dr. Attachment Constraints',
      crmNumber: '97302',
    })

    const firstEntry = await createClinicalEntry({
      medicalRecord: firstRecord,
      patient: firstPatient,
      clinic,
      patientLink: firstPatientLink,
      professionalLink,
      user: doctor,
    })

    const secondEntry = await createClinicalEntry({
      medicalRecord: secondRecord,
      patient: secondPatient,
      clinic,
      patientLink: secondPatientLink,
      professionalLink,
      user: doctor,
    })

    const pendingAttachment = await MedicalRecordAttachment.create({
      medicalRecordEntryId: firstEntry.id,
      medicalRecordId: firstRecord.id,
      patientId: firstPatient.id,
      clinicId: clinic.id,
      uploadedByUserId: doctor.id,
      originalName: 'pending-document.pdf',
      storageDisk: 'private_fs',
      storageKey: `${firstRecord.id}/${firstEntry.id}/pending-document.pdf`,
      contentType: 'application/pdf',
      sizeInBytes: 1024,
      sha256: 'b'.repeat(64),
    })

    const persistedPendingAttachment = await MedicalRecordAttachment.findOrFail(
      pendingAttachment.id
    )

    assert.equal(persistedPendingAttachment.status, 'pending')
    assert.isNull(persistedPendingAttachment.statusReason)

    const wrongScopeError = await captureRejectedError(() =>
      createAttachment({
        entry: firstEntry,
        medicalRecord: secondRecord,
        patient: secondPatient,
        clinic,
        user: doctor,
        storageKey: 'invalid/wrong-scope.pdf',
      })
    )

    assert.equal(wrongScopeError.code, '23503')
    assert.equal(wrongScopeError.constraint, 'medical_record_attachments_entry_scope_foreign')

    const duplicateStorageError = await captureRejectedError(() =>
      createAttachment({
        entry: secondEntry,
        medicalRecord: secondRecord,
        patient: secondPatient,
        clinic,
        user: doctor,
        storageKey: pendingAttachment.storageKey,
      })
    )

    assert.equal(duplicateStorageError.code, '23505')
    assert.equal(duplicateStorageError.constraint, 'medical_record_attachments_storage_unique')

    const emptyFileError = await captureRejectedError(() =>
      createAttachment({
        entry: firstEntry,
        medicalRecord: firstRecord,
        patient: firstPatient,
        clinic,
        user: doctor,
        storageKey: 'invalid/empty-file.pdf',
        sizeInBytes: 0,
      })
    )

    assert.equal(emptyFileError.code, '23514')
    assert.equal(emptyFileError.constraint, 'medical_record_attachments_size_valid')

    const oversizedFileError = await captureRejectedError(() =>
      createAttachment({
        entry: firstEntry,
        medicalRecord: firstRecord,
        patient: firstPatient,
        clinic,
        user: doctor,
        storageKey: 'invalid/oversized-file.pdf',
        sizeInBytes: 10_485_761,
      })
    )

    assert.equal(oversizedFileError.code, '23514')
    assert.equal(oversizedFileError.constraint, 'medical_record_attachments_size_valid')

    const invalidHashError = await captureRejectedError(() =>
      createAttachment({
        entry: firstEntry,
        medicalRecord: firstRecord,
        patient: firstPatient,
        clinic,
        user: doctor,
        storageKey: 'invalid/hash.pdf',
        sha256: 'INVALID',
      })
    )

    assert.equal(invalidHashError.code, '23514')
    assert.equal(invalidHashError.constraint, 'medical_record_attachments_sha256_format')

    const blankNameError = await captureRejectedError(() =>
      createAttachment({
        entry: firstEntry,
        medicalRecord: firstRecord,
        patient: firstPatient,
        clinic,
        user: doctor,
        storageKey: 'invalid/blank-name.pdf',
        originalName: '   ',
      })
    )

    assert.equal(blankNameError.code, '23514')
    assert.equal(blankNameError.constraint, 'medical_record_attachments_original_name_not_blank')

    const rejectedWithoutReasonError = await captureRejectedError(() =>
      createAttachment({
        entry: firstEntry,
        medicalRecord: firstRecord,
        patient: firstPatient,
        clinic,
        user: doctor,
        storageKey: 'invalid/rejected-without-reason.pdf',
        status: 'rejected',
        statusReason: null,
      })
    )

    assert.equal(rejectedWithoutReasonError.code, '23514')
    assert.equal(
      rejectedWithoutReasonError.constraint,
      'medical_record_attachments_rejection_consistency'
    )

    const availableWithReasonError = await captureRejectedError(() =>
      createAttachment({
        entry: firstEntry,
        medicalRecord: firstRecord,
        patient: firstPatient,
        clinic,
        user: doctor,
        storageKey: 'invalid/available-with-reason.pdf',
        status: 'available',
        statusReason: 'A reason is not valid for an available file.',
      })
    )

    assert.equal(availableWithReasonError.code, '23514')
    assert.equal(
      availableWithReasonError.constraint,
      'medical_record_attachments_rejection_consistency'
    )
  })

  test('validates attachment-aware access logs and their medical-record scope', async ({
    assert,
  }) => {
    const clinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Attachment Access Logs Clinic',
    }).create()
    const doctor = await UserFactory.merge({
      fullName: 'Usuário Clínico',
      email: 'attachments.logs@example.com',
    }).create()

    const { patient: firstPatient, medicalRecord: firstRecord } = await createPatient(
      'First Attachment Log Patient'
    )

    const { patient: secondPatient, medicalRecord: secondRecord } = await createPatient(
      'Second Attachment Log Patient'
    )

    const firstPatientLink = await createPatientLink({
      patient: firstPatient,
      clinic,
    })

    const secondPatientLink = await createPatientLink({
      patient: secondPatient,
      clinic,
    })

    const { professionalLink } = await createProfessionalLink({
      clinic,
      user: doctor,
      fullName: 'Dr. Attachment Logs',
      crmNumber: '97303',
    })

    const firstEntry = await createClinicalEntry({
      medicalRecord: firstRecord,
      patient: firstPatient,
      clinic,
      patientLink: firstPatientLink,
      professionalLink,
      user: doctor,
    })

    const attachment = await createAttachment({
      entry: firstEntry,
      medicalRecord: firstRecord,
      patient: firstPatient,
      clinic,
      user: doctor,
      storageKey: `${firstRecord.id}/${firstEntry.id}/access-log-document.pdf`,
    })

    const listLog = await MedicalRecordAccessLog.create({
      medicalRecordId: firstRecord.id,
      patientId: firstPatient.id,
      clinicId: clinic.id,
      patientClinicId: firstPatientLink.id,
      userId: doctor.id,
      medicalRecordAttachmentId: null,
      accessAction: 'list_attachments',
      purposeCode: 'patient_care',
      purposeNote: null,
    })

    const downloadLog = await MedicalRecordAccessLog.create({
      medicalRecordId: firstRecord.id,
      patientId: firstPatient.id,
      clinicId: clinic.id,
      patientClinicId: firstPatientLink.id,
      userId: doctor.id,
      medicalRecordAttachmentId: attachment.id,
      accessAction: 'download_attachment',
      purposeCode: 'patient_care',
      purposeNote: null,
    })

    assert.equal(listLog.accessAction, 'list_attachments')
    assert.isNull(listLog.medicalRecordAttachmentId)

    assert.equal(downloadLog.accessAction, 'download_attachment')
    assert.equal(downloadLog.medicalRecordAttachmentId, attachment.id)

    const downloadWithoutAttachmentError = await captureRejectedError(() =>
      MedicalRecordAccessLog.create({
        medicalRecordId: firstRecord.id,
        patientId: firstPatient.id,
        clinicId: clinic.id,
        patientClinicId: firstPatientLink.id,
        userId: doctor.id,
        medicalRecordAttachmentId: null,
        accessAction: 'download_attachment',
        purposeCode: 'patient_care',
        purposeNote: null,
      })
    )

    assert.equal(downloadWithoutAttachmentError.code, '23514')
    assert.equal(
      downloadWithoutAttachmentError.constraint,
      'medical_record_access_logs_attachment_consistency'
    )

    const listWithAttachmentError = await captureRejectedError(() =>
      MedicalRecordAccessLog.create({
        medicalRecordId: firstRecord.id,
        patientId: firstPatient.id,
        clinicId: clinic.id,
        patientClinicId: firstPatientLink.id,
        userId: doctor.id,
        medicalRecordAttachmentId: attachment.id,
        accessAction: 'list_attachments',
        purposeCode: 'patient_care',
        purposeNote: null,
      })
    )

    assert.equal(listWithAttachmentError.code, '23514')
    assert.equal(
      listWithAttachmentError.constraint,
      'medical_record_access_logs_attachment_consistency'
    )

    const crossPatientAttachmentError = await captureRejectedError(() =>
      MedicalRecordAccessLog.create({
        medicalRecordId: secondRecord.id,
        patientId: secondPatient.id,
        clinicId: clinic.id,
        patientClinicId: secondPatientLink.id,
        userId: doctor.id,
        medicalRecordAttachmentId: attachment.id,
        accessAction: 'download_attachment',
        purposeCode: 'care_coordination',
        purposeNote: null,
      })
    )

    assert.equal(crossPatientAttachmentError.code, '23503')
    assert.equal(
      crossPatientAttachmentError.constraint,
      'medical_record_access_logs_attachment_scope_foreign'
    )
  })
})
