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
import Professional from '#models/professional'
import ClinicProfessional from '#models/clinic_professional'
import Appointment from '#models/appointment'
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

async function createUser(email: string) {
  return User.create({
    fullName: 'Usuário Clínico',
    email,
    emailNormalized: email.toLowerCase(),
    passwordHash: 'TestPassword!123',
    isGlobalAdmin: false,
    isActive: true,
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

  const professionalLink = await ClinicProfessional.create({
    clinicId: clinic.id,
    professionalId: professional.id,
    localCode: null,
    defaultAppointmentDurationMinutes: 60,
    acceptsAppointments: true,
    isActive: true,
  })

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
  return Appointment.create({
    clinicId: clinic.id,
    patientClinicId: patientLink.id,
    clinicProfessionalId: professionalLink.id,
    startsAt,
    endsAt: startsAt.plus({ hours: 1 }),
    status: 'scheduled',
    version: 1,
    appointmentTypeCode: null,
    administrativeNote: null,
    createdByUserId: user.id,
    confirmedAt: null,
    confirmedByUserId: null,
    completedAt: null,
    completedByUserId: null,
    cancelledAt: null,
    cancelledByUserId: null,
    cancellationReasonCode: null,
    cancellationNote: null,
    noShowAt: null,
    noShowByUserId: null,
    rescheduledFromAppointmentId: null,
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
    const firstClinic = await createClinic('Primeiro Consultório Clínico')
    const secondClinic = await createClinic('Segundo Consultório Clínico')

    const firstDoctor = await createUser('records.first.doctor@example.com')
    const secondDoctor = await createUser('records.second.doctor@example.com')

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
    const firstClinic = await createClinic('Clínica de Contexto Um')
    const secondClinic = await createClinic('Clínica de Contexto Dois')

    const firstDoctor = await createUser('records.context.first@example.com')
    const secondDoctor = await createUser('records.context.second@example.com')

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

    const secondClinicDoctor = await createUser('records.context.second.clinic@example.com')

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
    const clinic = await createClinic('Clínica de Imutabilidade')
    const doctor = await createUser('records.immutable@example.com')

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
    const clinic = await createClinic('Clínica de Logs')
    const doctor = await createUser('records.logs@example.com')

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
})
