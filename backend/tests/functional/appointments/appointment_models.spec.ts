import { ClinicProfessionalFactory } from '#database/factories/clinic_professional_factory'
import { ProfessionalFactory } from '#database/factories/professional_factory'
import { PatientClinicFactory } from '#database/factories/patient_clinic_factory'
import { PatientFactory } from '#database/factories/patient_factory'
import { ClinicFactory } from '#database/factories/clinic_factory'
import { UserFactory } from '#database/factories/user_factory'
import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import Clinic from '#models/clinic'
import Appointment from '#models/appointment'
import { truncateClinicSchemaTables } from '../../helpers/database.js'

async function createPatientLink({ clinic, fullName }: { clinic: Clinic; fullName: string }) {
  const patient = await PatientFactory.merge({ fullName }).create()

  const link = await PatientClinicFactory.merge({
    patientId: patient.id,
    clinicId: clinic.id,
  }).create()

  return {
    patient,
    link,
  }
}

async function createProfessionalLink({
  clinic,
  fullName,
  crmNumber,
}: {
  clinic: Clinic
  fullName: string
  crmNumber: string
}) {
  const professional = await ProfessionalFactory.merge({ fullName, crmNumber }).create()

  const link = await ClinicProfessionalFactory.merge({
    clinicId: clinic.id,
    professionalId: professional.id,
  }).create()

  return {
    professional,
    link,
  }
}

test.group('Appointment models', (group) => {
  group.each.setup(async () => {
    await truncateClinicSchemaTables()

    return async () => {
      await truncateClinicSchemaTables()
    }
  })

  test('relates appointments to clinic, patient, professional, users and rescheduling', async ({
    assert,
  }) => {
    const user = await UserFactory.merge({
      fullName: 'Usuário de Agendamento',
      email: 'appointment.relations@example.com',
    }).create()

    const clinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica de Relacionamentos',
    }).create()

    const { patient, link: patientLink } = await createPatientLink({
      clinic,
      fullName: 'Paciente de Relacionamentos',
    })

    const { professional, link: professionalLink } = await createProfessionalLink({
      clinic,
      fullName: 'Dra. Relacionamentos',
      crmNumber: '81001',
    })

    const original = await Appointment.create({
      clinicId: clinic.id,
      patientClinicId: patientLink.id,
      clinicProfessionalId: professionalLink.id,
      startsAt: DateTime.fromISO('2026-09-10T08:00:00.000Z'),
      endsAt: DateTime.fromISO('2026-09-10T09:00:00.000Z'),
      status: 'cancelled',
      version: 1,
      appointmentTypeCode: 'RETURN',
      administrativeNote: 'Consulta reagendada',
      createdByUserId: user.id,
      confirmedAt: null,
      confirmedByUserId: null,
      completedAt: null,
      completedByUserId: null,
      cancelledAt: DateTime.fromISO('2026-09-01T12:00:00.000Z'),
      cancelledByUserId: user.id,
      cancellationReasonCode: 'rescheduled',
      cancellationNote: 'Alteração solicitada',
      noShowAt: null,
      noShowByUserId: null,
      rescheduledFromAppointmentId: null,
    })

    const replacement = await Appointment.create({
      clinicId: clinic.id,
      patientClinicId: patientLink.id,
      clinicProfessionalId: professionalLink.id,
      startsAt: DateTime.fromISO('2026-09-10T09:00:00.000Z'),
      endsAt: DateTime.fromISO('2026-09-10T10:00:00.000Z'),
      status: 'scheduled',
      version: 1,
      appointmentTypeCode: 'RETURN',
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
      rescheduledFromAppointmentId: original.id,
    })

    const confirmed = await Appointment.create({
      clinicId: clinic.id,
      patientClinicId: patientLink.id,
      clinicProfessionalId: professionalLink.id,
      startsAt: DateTime.fromISO('2026-09-10T10:00:00.000Z'),
      endsAt: DateTime.fromISO('2026-09-10T11:00:00.000Z'),
      status: 'confirmed',
      version: 1,
      appointmentTypeCode: null,
      administrativeNote: null,
      createdByUserId: user.id,
      confirmedAt: DateTime.fromISO('2026-09-01T13:00:00.000Z'),
      confirmedByUserId: user.id,
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

    const completed = await Appointment.create({
      clinicId: clinic.id,
      patientClinicId: patientLink.id,
      clinicProfessionalId: professionalLink.id,
      startsAt: DateTime.fromISO('2026-09-10T11:00:00.000Z'),
      endsAt: DateTime.fromISO('2026-09-10T12:00:00.000Z'),
      status: 'completed',
      version: 1,
      appointmentTypeCode: null,
      administrativeNote: null,
      createdByUserId: user.id,
      confirmedAt: null,
      confirmedByUserId: null,
      completedAt: DateTime.fromISO('2026-09-10T12:00:00.000Z'),
      completedByUserId: user.id,
      cancelledAt: null,
      cancelledByUserId: null,
      cancellationReasonCode: null,
      cancellationNote: null,
      noShowAt: null,
      noShowByUserId: null,
      rescheduledFromAppointmentId: null,
    })

    const noShow = await Appointment.create({
      clinicId: clinic.id,
      patientClinicId: patientLink.id,
      clinicProfessionalId: professionalLink.id,
      startsAt: DateTime.fromISO('2026-09-10T12:00:00.000Z'),
      endsAt: DateTime.fromISO('2026-09-10T13:00:00.000Z'),
      status: 'no_show',
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
      noShowAt: DateTime.fromISO('2026-09-10T13:00:00.000Z'),
      noShowByUserId: user.id,
      rescheduledFromAppointmentId: null,
    })

    const loadedReplacement = await Appointment.query()
      .where('id', replacement.id)
      .preload('clinic')
      .preload('patientClinic', (query) => {
        query.preload('patient')
      })
      .preload('clinicProfessional', (query) => {
        query.preload('professional')
      })
      .preload('createdByUser')
      .preload('rescheduledFrom')
      .firstOrFail()

    assert.equal(loadedReplacement.clinic.id, clinic.id)
    assert.equal(loadedReplacement.patientClinic.patient.id, patient.id)
    assert.equal(loadedReplacement.clinicProfessional.professional.id, professional.id)
    assert.equal(loadedReplacement.createdByUser.id, user.id)
    assert.equal(loadedReplacement.rescheduledFrom.id, original.id)

    await original.load('cancelledByUser')
    await original.load('rescheduledTo')
    await confirmed.load('confirmedByUser')
    await completed.load('completedByUser')
    await noShow.load('noShowByUser')

    assert.equal(original.cancelledByUser.id, user.id)
    assert.equal(original.rescheduledTo.id, replacement.id)
    assert.equal(confirmed.confirmedByUser.id, user.id)
    assert.equal(completed.completedByUser.id, user.id)
    assert.equal(noShow.noShowByUser.id, user.id)

    await clinic.load('appointments')
    await patientLink.load('appointments')
    await professionalLink.load('appointments')
    await user.load('createdAppointments')
    await user.load('confirmedAppointments')
    await user.load('completedAppointments')
    await user.load('cancelledAppointments')
    await user.load('noShowAppointments')

    assert.lengthOf(clinic.appointments, 5)
    assert.lengthOf(patientLink.appointments, 5)
    assert.lengthOf(professionalLink.appointments, 5)
    assert.lengthOf(user.createdAppointments, 5)
    assert.lengthOf(user.confirmedAppointments, 1)
    assert.lengthOf(user.completedAppointments, 1)
    assert.lengthOf(user.cancelledAppointments, 1)
    assert.lengthOf(user.noShowAppointments, 1)
  })

  test('enforces clinic scope and one direct rescheduling successor', async ({ assert }) => {
    const user = await UserFactory.merge({
      fullName: 'Usuário de Agendamento',
      email: 'appointment.scope@example.com',
    }).create()

    const firstClinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Primeira Clínica de Escopo',
    }).create()

    const secondClinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Segunda Clínica de Escopo',
    }).create()

    const { link: firstPatientLink } = await createPatientLink({
      clinic: firstClinic,
      fullName: 'Paciente da Primeira Clínica',
    })

    const { link: secondPatientLink } = await createPatientLink({
      clinic: secondClinic,
      fullName: 'Paciente da Segunda Clínica',
    })

    const { link: firstProfessionalLink } = await createProfessionalLink({
      clinic: firstClinic,
      fullName: 'Dr. Primeira Clínica',
      crmNumber: '82001',
    })

    const { link: secondProfessionalLink } = await createProfessionalLink({
      clinic: secondClinic,
      fullName: 'Dra. Segunda Clínica',
      crmNumber: '82002',
    })

    const original = await Appointment.create({
      clinicId: firstClinic.id,
      patientClinicId: firstPatientLink.id,
      clinicProfessionalId: firstProfessionalLink.id,
      startsAt: DateTime.fromISO('2026-09-11T08:00:00.000Z'),
      endsAt: DateTime.fromISO('2026-09-11T09:00:00.000Z'),
      status: 'cancelled',
      version: 1,
      appointmentTypeCode: null,
      administrativeNote: null,
      createdByUserId: user.id,
      confirmedAt: null,
      confirmedByUserId: null,
      completedAt: null,
      completedByUserId: null,
      cancelledAt: DateTime.fromISO('2026-09-01T10:00:00.000Z'),
      cancelledByUserId: user.id,
      cancellationReasonCode: 'rescheduled',
      cancellationNote: null,
      noShowAt: null,
      noShowByUserId: null,
      rescheduledFromAppointmentId: null,
    })

    await assert.rejects(() =>
      Appointment.create({
        clinicId: firstClinic.id,
        patientClinicId: secondPatientLink.id,
        clinicProfessionalId: firstProfessionalLink.id,
        startsAt: DateTime.fromISO('2026-09-11T09:00:00.000Z'),
        endsAt: DateTime.fromISO('2026-09-11T10:00:00.000Z'),
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
    )

    await assert.rejects(() =>
      Appointment.create({
        clinicId: firstClinic.id,
        patientClinicId: firstPatientLink.id,
        clinicProfessionalId: secondProfessionalLink.id,
        startsAt: DateTime.fromISO('2026-09-11T09:00:00.000Z'),
        endsAt: DateTime.fromISO('2026-09-11T10:00:00.000Z'),
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
    )

    await assert.rejects(() =>
      Appointment.create({
        clinicId: secondClinic.id,
        patientClinicId: secondPatientLink.id,
        clinicProfessionalId: secondProfessionalLink.id,
        startsAt: DateTime.fromISO('2026-09-11T09:00:00.000Z'),
        endsAt: DateTime.fromISO('2026-09-11T10:00:00.000Z'),
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
        rescheduledFromAppointmentId: original.id,
      })
    )

    await Appointment.create({
      clinicId: firstClinic.id,
      patientClinicId: firstPatientLink.id,
      clinicProfessionalId: firstProfessionalLink.id,
      startsAt: DateTime.fromISO('2026-09-11T09:00:00.000Z'),
      endsAt: DateTime.fromISO('2026-09-11T10:00:00.000Z'),
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
      rescheduledFromAppointmentId: original.id,
    })

    await assert.rejects(() =>
      Appointment.create({
        clinicId: firstClinic.id,
        patientClinicId: firstPatientLink.id,
        clinicProfessionalId: firstProfessionalLink.id,
        startsAt: DateTime.fromISO('2026-09-11T10:00:00.000Z'),
        endsAt: DateTime.fromISO('2026-09-11T11:00:00.000Z'),
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
        rescheduledFromAppointmentId: original.id,
      })
    )
  })

  test('enforces duration, version and status metadata consistency', async ({ assert }) => {
    const user = await UserFactory.merge({
      fullName: 'Usuário de Agendamento',
      email: 'appointment.constraints@example.com',
    }).create()

    const clinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica de Constraints',
    }).create()

    const { link: patientLink } = await createPatientLink({
      clinic,
      fullName: 'Paciente de Constraints',
    })

    const { link: professionalLink } = await createProfessionalLink({
      clinic,
      fullName: 'Dr. Constraints',
      crmNumber: '83001',
    })

    const base = {
      clinicId: clinic.id,
      patientClinicId: patientLink.id,
      clinicProfessionalId: professionalLink.id,
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
    }

    await assert.rejects(() =>
      Appointment.create({
        ...base,
        startsAt: DateTime.fromISO('2026-09-12T08:00:00.000Z'),
        endsAt: DateTime.fromISO('2026-09-12T08:04:00.000Z'),
        status: 'scheduled',
      })
    )

    await assert.rejects(() =>
      Appointment.create({
        ...base,
        startsAt: DateTime.fromISO('2026-09-12T08:00:00.000Z'),
        endsAt: DateTime.fromISO('2026-09-12T16:01:00.000Z'),
        status: 'scheduled',
      })
    )

    await assert.rejects(() =>
      Appointment.create({
        ...base,
        startsAt: DateTime.fromISO('2026-09-12T08:00:00.000Z'),
        endsAt: DateTime.fromISO('2026-09-12T09:00:00.000Z'),
        status: 'scheduled',
        version: 0,
      })
    )

    await assert.rejects(() =>
      Appointment.create({
        ...base,
        startsAt: DateTime.fromISO('2026-09-12T08:00:00.000Z'),
        endsAt: DateTime.fromISO('2026-09-12T09:00:00.000Z'),
        status: 'scheduled',
        confirmedAt: DateTime.fromISO('2026-09-01T10:00:00.000Z'),
        confirmedByUserId: user.id,
      })
    )

    await assert.rejects(() =>
      Appointment.create({
        ...base,
        startsAt: DateTime.fromISO('2026-09-12T09:00:00.000Z'),
        endsAt: DateTime.fromISO('2026-09-12T10:00:00.000Z'),
        status: 'confirmed',
      })
    )

    await assert.rejects(() =>
      Appointment.create({
        ...base,
        startsAt: DateTime.fromISO('2026-09-12T10:00:00.000Z'),
        endsAt: DateTime.fromISO('2026-09-12T11:00:00.000Z'),
        status: 'completed',
      })
    )

    await assert.rejects(() =>
      Appointment.create({
        ...base,
        startsAt: DateTime.fromISO('2026-09-12T11:00:00.000Z'),
        endsAt: DateTime.fromISO('2026-09-12T12:00:00.000Z'),
        status: 'cancelled',
      })
    )

    await assert.rejects(() =>
      Appointment.create({
        ...base,
        startsAt: DateTime.fromISO('2026-09-12T12:00:00.000Z'),
        endsAt: DateTime.fromISO('2026-09-12T13:00:00.000Z'),
        status: 'no_show',
      })
    )

    const confirmed = await Appointment.create({
      ...base,
      startsAt: DateTime.fromISO('2026-09-12T13:00:00.000Z'),
      endsAt: DateTime.fromISO('2026-09-12T14:00:00.000Z'),
      status: 'confirmed',
      confirmedAt: DateTime.fromISO('2026-09-01T10:00:00.000Z'),
      confirmedByUserId: user.id,
    })

    assert.equal(confirmed.status, 'confirmed')
    assert.equal(confirmed.version, 1)
  })

  test('prevents overlapping active appointments and allows valid exceptions', async ({
    assert,
  }) => {
    const user = await UserFactory.merge({
      fullName: 'Usuário de Agendamento',
      email: 'appointment.overlap@example.com',
    }).create()

    const clinic = await ClinicFactory.merge({
      timezone: 'America/Sao_Paulo',
      name: 'Clínica de Sobreposição',
    }).create()

    const { link: patientLink } = await createPatientLink({
      clinic,
      fullName: 'Paciente de Sobreposição',
    })

    const { link: firstProfessionalLink } = await createProfessionalLink({
      clinic,
      fullName: 'Dr. Primeiro Horário',
      crmNumber: '84001',
    })

    const { link: secondProfessionalLink } = await createProfessionalLink({
      clinic,
      fullName: 'Dra. Segundo Horário',
      crmNumber: '84002',
    })

    const base = {
      clinicId: clinic.id,
      patientClinicId: patientLink.id,
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
      version: 1,
    }

    await Appointment.create({
      ...base,
      clinicProfessionalId: firstProfessionalLink.id,
      startsAt: DateTime.fromISO('2026-09-13T08:00:00.000Z'),
      endsAt: DateTime.fromISO('2026-09-13T09:00:00.000Z'),
      status: 'scheduled',
    })

    await Appointment.create({
      ...base,
      clinicProfessionalId: firstProfessionalLink.id,
      startsAt: DateTime.fromISO('2026-09-13T09:00:00.000Z'),
      endsAt: DateTime.fromISO('2026-09-13T10:00:00.000Z'),
      status: 'scheduled',
    })

    await Appointment.create({
      ...base,
      clinicProfessionalId: firstProfessionalLink.id,
      startsAt: DateTime.fromISO('2026-09-13T08:30:00.000Z'),
      endsAt: DateTime.fromISO('2026-09-13T09:30:00.000Z'),
      status: 'cancelled',
      cancelledAt: DateTime.fromISO('2026-09-01T10:00:00.000Z'),
      cancelledByUserId: user.id,
      cancellationReasonCode: 'patient_request',
    })

    await Appointment.create({
      ...base,
      clinicProfessionalId: secondProfessionalLink.id,
      startsAt: DateTime.fromISO('2026-09-13T08:30:00.000Z'),
      endsAt: DateTime.fromISO('2026-09-13T09:30:00.000Z'),
      status: 'scheduled',
    })

    await assert.rejects(() =>
      Appointment.create({
        ...base,
        clinicProfessionalId: firstProfessionalLink.id,
        startsAt: DateTime.fromISO('2026-09-13T08:30:00.000Z'),
        endsAt: DateTime.fromISO('2026-09-13T09:30:00.000Z'),
        status: 'scheduled',
      })
    )

    await assert.rejects(() =>
      Appointment.create({
        ...base,
        clinicProfessionalId: firstProfessionalLink.id,
        startsAt: DateTime.fromISO('2026-09-13T08:15:00.000Z'),
        endsAt: DateTime.fromISO('2026-09-13T08:45:00.000Z'),
        status: 'confirmed',
        confirmedAt: DateTime.fromISO('2026-09-01T10:00:00.000Z'),
        confirmedByUserId: user.id,
      })
    )

    const appointments = await Appointment.query().where('clinic_id', clinic.id)

    assert.lengthOf(appointments, 4)
  })
})
