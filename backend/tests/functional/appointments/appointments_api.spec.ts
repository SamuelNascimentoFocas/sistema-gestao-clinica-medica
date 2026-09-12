import { ProfessionalWeeklyAvailabilityFactory } from '#database/factories/professional_weekly_availability_factory'
import { ClinicProfessionalFactory } from '#database/factories/clinic_professional_factory'
import { ProfessionalFactory } from '#database/factories/professional_factory'
import { PatientClinicFactory } from '#database/factories/patient_clinic_factory'
import { PatientFactory } from '#database/factories/patient_factory'
import { UserFactory } from '#database/factories/user_factory'
import { ClinicFactory } from '#database/factories/clinic_factory'
import { createBearerToken as createToken } from '#tests/helpers/auth'
import { createMembership } from '#tests/helpers/membership'
import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import Clinic from '#models/clinic'
import ClinicProfessional from '#models/clinic_professional'
import ProfessionalScheduleBlock from '#models/professional_schedule_block'
import Appointment from '#models/appointment'
import { truncateClinicSchemaTables } from '../../helpers/database.js'
import { seedAuthorizationCatalog } from '../../../database/seeders/authorization_catalog_seeder.js'

const CLINIC_TIMEZONE = 'America/Sao_Paulo'

function futureMondayAt(hour: number, minute = 0) {
  const now = DateTime.now().setZone(CLINIC_TIMEZONE)

  let target = now.plus({ weeks: 4 }).startOf('week').set({
    hour,
    minute,
    second: 0,
    millisecond: 0,
  })

  if (target.toMillis() <= now.toMillis()) {
    target = target.plus({ weeks: 1 })
  }

  return target
}

function toUtcIso(value: DateTime) {
  return value.toUTC().toISO()!
}

async function createPatientLink({ clinic, fullName }: { clinic: Clinic; fullName: string }) {
  const patient = await PatientFactory.merge({ fullName }).create()

  const patientLink = await PatientClinicFactory.merge({
    patientId: patient.id,
    clinicId: clinic.id,
  }).create()

  return {
    patient,
    patientLink,
  }
}

async function createProfessionalLink({
  clinic,
  fullName,
  crmNumber,
  userId = null,
  acceptsAppointments = true,
  isActive = true,
}: {
  clinic: Clinic
  fullName: string
  crmNumber: string
  userId?: string | null
  acceptsAppointments?: boolean
  isActive?: boolean
}) {
  const professional = await ProfessionalFactory.merge({ userId, fullName, crmNumber }).create()

  const professionalLink = await ClinicProfessionalFactory.merge({
    clinicId: clinic.id,
    professionalId: professional.id,
    defaultAppointmentDurationMinutes: 60,
    acceptsAppointments,
    isActive,
  }).create()

  return {
    professional,
    professionalLink,
  }
}

async function createAvailability({
  professionalLink,
  weekday,
  startTime = '08:00',
  endTime = '18:00',
}: {
  professionalLink: ClinicProfessional
  weekday: number
  startTime?: string
  endTime?: string
}) {
  return ProfessionalWeeklyAvailabilityFactory.merge({
    clinicProfessionalId: professionalLink.id,
    weekday,
    startTime,
    endTime,
  }).create()
}

async function createReceptionistAppointmentContext({
  clinicName,
  email,
  patientName,
  professionalName,
  crmNumber,
}: {
  clinicName: string
  email: string
  patientName: string
  professionalName: string
  crmNumber: string
}) {
  const clinic = await ClinicFactory.merge({ timezone: CLINIC_TIMEZONE, name: clinicName }).create()
  const receptionist = await UserFactory.merge({
    fullName: 'Usuário de Agendamentos',
    email: email,
  }).create()

  await createMembership({
    user: receptionist,
    clinic,
    roleCode: 'receptionist',
  })

  const { patientLink } = await createPatientLink({
    clinic,
    fullName: patientName,
  })

  const { professionalLink } = await createProfessionalLink({
    clinic,
    fullName: professionalName,
    crmNumber,
  })

  return {
    clinic,
    receptionist,
    patientLink,
    professionalLink,
  }
}

test.group('Appointments API', (group) => {
  group.each.setup(async () => {
    await truncateClinicSchemaTables()
    await seedAuthorizationCatalog()

    return async () => {
      await truncateClinicSchemaTables()
    }
  })

  test('requires authentication and a valid list interval', async ({ client, assert }) => {
    const clinic = await ClinicFactory.merge({
      timezone: CLINIC_TIMEZONE,
      name: 'Clínica de Leitura',
    }).create()

    const from = futureMondayAt(0)
    const to = from.plus({ days: 7 })

    const unauthenticatedResponse = await client
      .get(`/api/v1/clinics/${clinic.id}/appointments?from=${toUtcIso(from)}&to=${toUtcIso(to)}`)
      .header('Accept', 'application/json')

    unauthenticatedResponse.assertStatus(401)

    const receptionist = await UserFactory.merge({
      fullName: 'Usuário de Agendamentos',
      email: 'appointments.read.receptionist@example.com',
    }).create()

    await createMembership({
      user: receptionist,
      clinic,
      roleCode: 'receptionist',
    })

    const token = await createToken(receptionist)

    const missingIntervalResponse = await client
      .get(`/api/v1/clinics/${clinic.id}/appointments`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    missingIntervalResponse.assertStatus(422)

    const reversedIntervalResponse = await client
      .get(`/api/v1/clinics/${clinic.id}/appointments?from=${toUtcIso(to)}&to=${toUtcIso(from)}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    reversedIntervalResponse.assertStatus(422)
    reversedIntervalResponse.assertBodyContains({
      message: 'A data inicial do filtro deve ser anterior à data final',
    })

    const excessiveIntervalResponse = await client
      .get(
        `/api/v1/clinics/${clinic.id}/appointments?from=${toUtcIso(from)}&to=${toUtcIso(
          from.plus({ days: 32 })
        )}`
      )
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    excessiveIntervalResponse.assertStatus(422)
    excessiveIntervalResponse.assertBodyContains({
      message: 'O intervalo da agenda não pode ultrapassar 31 dias',
    })

    const validResponse = await client
      .get(`/api/v1/clinics/${clinic.id}/appointments?from=${toUtcIso(from)}&to=${toUtcIso(to)}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    validResponse.assertStatus(200)
    assert.lengthOf(validResponse.body().data, 0)
  })

  test('creates, lists, shows and updates an appointment with optimistic versioning', async ({
    client,
    assert,
  }) => {
    const clinic = await ClinicFactory.merge({
      timezone: CLINIC_TIMEZONE,
      name: 'Clínica de Agendamentos',
    }).create()

    const receptionist = await UserFactory.merge({
      fullName: 'Usuário de Agendamentos',
      email: 'appointments.receptionist@example.com',
    }).create()

    await createMembership({
      user: receptionist,
      clinic,
      roleCode: 'receptionist',
    })

    const { patientLink } = await createPatientLink({
      clinic,
      fullName: 'Paciente Agendado',
    })

    const { professionalLink } = await createProfessionalLink({
      clinic,
      fullName: 'Dra. Agenda Principal',
      crmNumber: '91001',
    })

    const localStart = futureMondayAt(9, 30)

    const availability = await createAvailability({
      professionalLink,
      weekday: localStart.weekday,
    })

    const token = await createToken(receptionist)

    const createResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        patientClinicId: patientLink.id,
        clinicProfessionalId: professionalLink.id,
        startsAt: toUtcIso(localStart),
        durationMinutes: 60,
        appointmentTypeCode: 'FIRST_VISIT',
        administrativeNote: 'Chegar com antecedência',
      })

    createResponse.assertStatus(201)

    const createdAppointment = createResponse.body().appointment

    assert.equal(createdAppointment.status, 'scheduled')
    assert.equal(createdAppointment.version, 1)
    assert.equal(createdAppointment.patientClinic.id, patientLink.id)
    assert.equal(createdAppointment.clinicProfessional.id, professionalLink.id)
    assert.equal(createdAppointment.administrativeNote, 'Chegar com antecedência')

    const listFrom = localStart.plus({ minutes: 30 })
    const listTo = localStart.plus({ minutes: 45 })

    const listResponse = await client
      .get(
        `/api/v1/clinics/${clinic.id}/appointments?from=${toUtcIso(
          listFrom
        )}&to=${toUtcIso(listTo)}`
      )
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    listResponse.assertStatus(200)
    assert.lengthOf(listResponse.body().data, 1)
    assert.equal(listResponse.body().data[0].id, createdAppointment.id)

    const showResponse = await client
      .get(`/api/v1/clinics/${clinic.id}/appointments/${createdAppointment.id}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    showResponse.assertStatus(200)
    assert.equal(showResponse.body().appointment.id, createdAppointment.id)

    availability.isActive = false
    await availability.save()

    const updateResponse = await client
      .patch(`/api/v1/clinics/${clinic.id}/appointments/${createdAppointment.id}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        administrativeNote: 'Observação administrativa atualizada',
        expectedVersion: 1,
      })

    updateResponse.assertStatus(200)

    assert.equal(
      updateResponse.body().appointment.administrativeNote,
      'Observação administrativa atualizada'
    )
    assert.equal(updateResponse.body().appointment.version, 2)

    const staleVersionResponse = await client
      .patch(`/api/v1/clinics/${clinic.id}/appointments/${createdAppointment.id}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        administrativeNote: 'Atualização desatualizada',
        expectedVersion: 1,
      })

    staleVersionResponse.assertStatus(409)
    staleVersionResponse.assertBodyContains({
      message: 'O agendamento foi alterado por outro usuário; atualize os dados e tente novamente',
    })

    const emptyUpdateResponse = await client
      .patch(`/api/v1/clinics/${clinic.id}/appointments/${createdAppointment.id}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        expectedVersion: 2,
      })

    emptyUpdateResponse.assertStatus(400)
  })

  test('allows a doctor to manage only appointments of the own professional profile', async ({
    client,
    assert,
  }) => {
    const clinic = await ClinicFactory.merge({
      timezone: CLINIC_TIMEZONE,
      name: 'Clínica dos Médicos',
    }).create()

    const firstDoctor = await UserFactory.merge({
      fullName: 'Usuário de Agendamentos',
      email: 'appointments.first.doctor@example.com',
    }).create()

    const secondDoctor = await UserFactory.merge({
      fullName: 'Usuário de Agendamentos',
      email: 'appointments.second.doctor@example.com',
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

    const { patientLink } = await createPatientLink({
      clinic,
      fullName: 'Paciente dos Médicos',
    })

    const { professionalLink: firstProfessionalLink } = await createProfessionalLink({
      clinic,
      fullName: 'Dr. Primeiro Médico',
      crmNumber: '92001',
      userId: firstDoctor.id,
    })

    const { professionalLink: secondProfessionalLink } = await createProfessionalLink({
      clinic,
      fullName: 'Dra. Segunda Médica',
      crmNumber: '92002',
      userId: secondDoctor.id,
    })

    const localStart = futureMondayAt(9)

    await createAvailability({
      professionalLink: firstProfessionalLink,
      weekday: localStart.weekday,
    })

    await createAvailability({
      professionalLink: secondProfessionalLink,
      weekday: localStart.weekday,
    })

    const firstToken = await createToken(firstDoctor)
    const secondToken = await createToken(secondDoctor)

    const ownCreateResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${firstToken}`)
      .json({
        patientClinicId: patientLink.id,
        clinicProfessionalId: firstProfessionalLink.id,
        startsAt: toUtcIso(localStart),
        durationMinutes: 60,
      })

    ownCreateResponse.assertStatus(201)

    const otherCreateResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${firstToken}`)
      .json({
        patientClinicId: patientLink.id,
        clinicProfessionalId: secondProfessionalLink.id,
        startsAt: toUtcIso(localStart),
        durationMinutes: 60,
      })

    otherCreateResponse.assertStatus(403)
    otherCreateResponse.assertBodyContains({
      message: 'Você somente pode administrar os próprios agendamentos',
    })

    const secondCreateResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${secondToken}`)
      .json({
        patientClinicId: patientLink.id,
        clinicProfessionalId: secondProfessionalLink.id,
        startsAt: toUtcIso(localStart.plus({ hours: 1 })),
        durationMinutes: 60,
      })

    secondCreateResponse.assertStatus(201)

    const ownAppointment = ownCreateResponse.body().appointment
    const secondAppointment = secondCreateResponse.body().appointment

    const ownUpdateResponse = await client
      .patch(`/api/v1/clinics/${clinic.id}/appointments/${ownAppointment.id}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${firstToken}`)
      .json({
        administrativeNote: 'Atualizado pelo médico responsável',
        expectedVersion: 1,
      })

    ownUpdateResponse.assertStatus(200)
    assert.equal(ownUpdateResponse.body().appointment.version, 2)

    const otherUpdateResponse = await client
      .patch(`/api/v1/clinics/${clinic.id}/appointments/${secondAppointment.id}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${firstToken}`)
      .json({
        administrativeNote: 'Tentativa indevida',
        expectedVersion: 1,
      })

    otherUpdateResponse.assertStatus(403)
    otherUpdateResponse.assertBodyContains({
      message: 'Você somente pode administrar os próprios agendamentos',
    })
  })

  test('validates patient, professional, availability, blocks and active overlaps', async ({
    client,
  }) => {
    const clinic = await ClinicFactory.merge({
      timezone: CLINIC_TIMEZONE,
      name: 'Clínica de Validações',
    }).create()

    const receptionist = await UserFactory.merge({
      fullName: 'Usuário de Agendamentos',
      email: 'appointments.validation@example.com',
    }).create()

    await createMembership({
      user: receptionist,
      clinic,
      roleCode: 'receptionist',
    })

    const { patientLink } = await createPatientLink({
      clinic,
      fullName: 'Paciente de Validação',
    })

    const { professional, professionalLink } = await createProfessionalLink({
      clinic,
      fullName: 'Dr. Validação',
      crmNumber: '93001',
    })

    const monday = futureMondayAt(9)

    await createAvailability({
      professionalLink,
      weekday: monday.weekday,
    })

    const token = await createToken(receptionist)

    const outsideAvailabilityResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        patientClinicId: patientLink.id,
        clinicProfessionalId: professionalLink.id,
        startsAt: toUtcIso(monday.set({ hour: 7 })),
        durationMinutes: 30,
      })

    outsideAvailabilityResponse.assertStatus(409)

    const pastResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        patientClinicId: patientLink.id,
        clinicProfessionalId: professionalLink.id,
        startsAt: toUtcIso(
          DateTime.now().setZone(CLINIC_TIMEZONE).minus({ days: 1 }).startOf('hour')
        ),
        durationMinutes: 30,
      })

    pastResponse.assertStatus(422)
    pastResponse.assertBodyContains({
      message: 'O agendamento deve começar em uma data futura',
    })

    await ProfessionalScheduleBlock.create({
      clinicProfessionalId: professionalLink.id,
      startsAt: monday.set({ hour: 11 }).toUTC(),
      endsAt: monday.set({ hour: 12 }).toUTC(),
      reason: 'Reunião clínica',
      isActive: true,
    })

    const firstResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        patientClinicId: patientLink.id,
        clinicProfessionalId: professionalLink.id,
        startsAt: toUtcIso(monday.set({ hour: 9 })),
        durationMinutes: 60,
      })

    firstResponse.assertStatus(201)

    const overlapResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        patientClinicId: patientLink.id,
        clinicProfessionalId: professionalLink.id,
        startsAt: toUtcIso(
          monday.set({
            hour: 9,
            minute: 30,
          })
        ),
        durationMinutes: 30,
      })

    overlapResponse.assertStatus(409)

    const adjacentResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        patientClinicId: patientLink.id,
        clinicProfessionalId: professionalLink.id,
        startsAt: toUtcIso(monday.set({ hour: 10 })),
        durationMinutes: 60,
      })

    adjacentResponse.assertStatus(201)

    const blockedResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        patientClinicId: patientLink.id,
        clinicProfessionalId: professionalLink.id,
        startsAt: toUtcIso(
          monday.set({
            hour: 11,
            minute: 30,
          })
        ),
        durationMinutes: 30,
      })

    blockedResponse.assertStatus(409)
    blockedResponse.assertBodyContains({
      message: 'O horário informado conflita com um bloqueio da agenda',
    })

    patientLink.isActive = false
    await patientLink.save()

    const inactivePatientResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        patientClinicId: patientLink.id,
        clinicProfessionalId: professionalLink.id,
        startsAt: toUtcIso(monday.set({ hour: 13 })),
        durationMinutes: 30,
      })

    inactivePatientResponse.assertStatus(409)

    patientLink.isActive = true
    await patientLink.save()

    professionalLink.acceptsAppointments = false
    await professionalLink.save()

    const notAcceptingResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        patientClinicId: patientLink.id,
        clinicProfessionalId: professionalLink.id,
        startsAt: toUtcIso(monday.set({ hour: 14 })),
        durationMinutes: 30,
      })

    notAcceptingResponse.assertStatus(409)

    professionalLink.acceptsAppointments = true
    professionalLink.isActive = false
    await professionalLink.save()

    const inactiveLinkResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        patientClinicId: patientLink.id,
        clinicProfessionalId: professionalLink.id,
        startsAt: toUtcIso(monday.set({ hour: 15 })),
        durationMinutes: 30,
      })

    inactiveLinkResponse.assertStatus(409)

    professionalLink.isActive = true
    await professionalLink.save()

    professional.isActive = false
    await professional.save()

    const inactiveProfessionalResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        patientClinicId: patientLink.id,
        clinicProfessionalId: professionalLink.id,
        startsAt: toUtcIso(monday.set({ hour: 16 })),
        durationMinutes: 30,
      })

    inactiveProfessionalResponse.assertStatus(409)
  })

  test('isolates appointments and references between clinics', async ({ client, assert }) => {
    const firstClinic = await ClinicFactory.merge({
      timezone: CLINIC_TIMEZONE,
      name: 'Primeira Clínica Isolada',
    }).create()
    const secondClinic = await ClinicFactory.merge({
      timezone: CLINIC_TIMEZONE,
      name: 'Segunda Clínica Isolada',
    }).create()

    const receptionist = await UserFactory.merge({
      fullName: 'Usuário de Agendamentos',
      email: 'appointments.multiclinic@example.com',
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

    const { patientLink: firstPatientLink } = await createPatientLink({
      clinic: firstClinic,
      fullName: 'Paciente da Primeira Clínica',
    })

    const { patientLink: secondPatientLink } = await createPatientLink({
      clinic: secondClinic,
      fullName: 'Paciente da Segunda Clínica',
    })

    const { professionalLink: firstProfessionalLink } = await createProfessionalLink({
      clinic: firstClinic,
      fullName: 'Dr. Primeira Clínica',
      crmNumber: '94001',
    })

    const { professionalLink: secondProfessionalLink } = await createProfessionalLink({
      clinic: secondClinic,
      fullName: 'Dra. Segunda Clínica',
      crmNumber: '94002',
    })

    const monday = futureMondayAt(9)

    await createAvailability({
      professionalLink: firstProfessionalLink,
      weekday: monday.weekday,
    })

    await createAvailability({
      professionalLink: secondProfessionalLink,
      weekday: monday.weekday,
    })

    const token = await createToken(receptionist)

    const crossPatientResponse = await client
      .post(`/api/v1/clinics/${firstClinic.id}/appointments`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        patientClinicId: secondPatientLink.id,
        clinicProfessionalId: firstProfessionalLink.id,
        startsAt: toUtcIso(monday),
        durationMinutes: 60,
      })

    crossPatientResponse.assertStatus(404)

    const crossProfessionalResponse = await client
      .post(`/api/v1/clinics/${firstClinic.id}/appointments`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        patientClinicId: firstPatientLink.id,
        clinicProfessionalId: secondProfessionalLink.id,
        startsAt: toUtcIso(monday),
        durationMinutes: 60,
      })

    crossProfessionalResponse.assertStatus(404)

    const secondClinicCreateResponse = await client
      .post(`/api/v1/clinics/${secondClinic.id}/appointments`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        patientClinicId: secondPatientLink.id,
        clinicProfessionalId: secondProfessionalLink.id,
        startsAt: toUtcIso(monday.plus({ hours: 1 })),
        durationMinutes: 60,
      })

    secondClinicCreateResponse.assertStatus(201)

    const secondAppointment = secondClinicCreateResponse.body().appointment

    const crossClinicShowResponse = await client
      .get(`/api/v1/clinics/${firstClinic.id}/appointments/${secondAppointment.id}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    crossClinicShowResponse.assertStatus(404)

    const firstClinicListResponse = await client
      .get(
        `/api/v1/clinics/${firstClinic.id}/appointments?from=${toUtcIso(
          monday.minus({ hours: 1 })
        )}&to=${toUtcIso(monday.plus({ hours: 3 }))}`
      )
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    firstClinicListResponse.assertStatus(200)
    assert.lengthOf(firstClinicListResponse.body().data, 0)
  })

  test('preserves one appointment when concurrent requests target the same slot', async ({
    client,
    assert,
  }) => {
    const clinic = await ClinicFactory.merge({
      timezone: CLINIC_TIMEZONE,
      name: 'Clínica Concorrente',
    }).create()

    const receptionist = await UserFactory.merge({
      fullName: 'Usuário de Agendamentos',
      email: 'appointments.concurrent@example.com',
    }).create()

    await createMembership({
      user: receptionist,
      clinic,
      roleCode: 'receptionist',
    })

    const { patientLink: firstPatientLink } = await createPatientLink({
      clinic,
      fullName: 'Primeiro Paciente Concorrente',
    })

    const { patientLink: secondPatientLink } = await createPatientLink({
      clinic,
      fullName: 'Segundo Paciente Concorrente',
    })

    const { professionalLink } = await createProfessionalLink({
      clinic,
      fullName: 'Dra. Concorrência',
      crmNumber: '95001',
    })

    const monday = futureMondayAt(9)

    await createAvailability({
      professionalLink,
      weekday: monday.weekday,
    })

    const token = await createToken(receptionist)

    const createRequest = (patientClinicId: string) =>
      client
        .post(`/api/v1/clinics/${clinic.id}/appointments`)
        .header('Accept', 'application/json')
        .header('Authorization', `Bearer ${token}`)
        .json({
          patientClinicId,
          clinicProfessionalId: professionalLink.id,
          startsAt: toUtcIso(monday),
          durationMinutes: 60,
        })

    const responses = await Promise.all([
      createRequest(firstPatientLink.id),
      createRequest(secondPatientLink.id),
    ])

    const statuses = responses
      .map((response) => response.status())
      .sort((first, second) => first - second)

    assert.deepEqual(statuses, [201, 409])

    const appointments = await Appointment.query()
      .where('clinic_id', clinic.id)
      .where('clinic_professional_id', professionalLink.id)

    assert.lengthOf(appointments, 1)
  })

  test('confirms idempotently and cancels an active appointment', async ({ client, assert }) => {
    const { clinic, receptionist, patientLink, professionalLink } =
      await createReceptionistAppointmentContext({
        clinicName: 'Clínica de Transições',
        email: 'appointments.transitions@example.com',
        patientName: 'Paciente de Transições',
        professionalName: 'Dra. Transições',
        crmNumber: '96001',
      })

    const localStart = futureMondayAt(9)

    await createAvailability({
      professionalLink,
      weekday: localStart.weekday,
    })

    const token = await createToken(receptionist)

    const createResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        patientClinicId: patientLink.id,
        clinicProfessionalId: professionalLink.id,
        startsAt: toUtcIso(localStart),
        durationMinutes: 60,
      })

    createResponse.assertStatus(201)

    const appointmentId = createResponse.body().appointment.id

    const confirmResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments/${appointmentId}/confirm`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        expectedVersion: 1,
      })

    confirmResponse.assertStatus(200)
    assert.equal(confirmResponse.body().appointment.status, 'confirmed')
    assert.equal(confirmResponse.body().appointment.version, 2)

    const repeatedConfirmResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments/${appointmentId}/confirm`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        expectedVersion: 1,
      })

    repeatedConfirmResponse.assertStatus(200)
    assert.equal(repeatedConfirmResponse.body().appointment.status, 'confirmed')
    assert.equal(repeatedConfirmResponse.body().appointment.version, 2)

    const cancelResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments/${appointmentId}/cancel`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        expectedVersion: 2,
        cancellationReasonCode: 'patient_request',
        cancellationNote: 'Paciente solicitou o cancelamento',
      })

    cancelResponse.assertStatus(200)
    assert.equal(cancelResponse.body().appointment.status, 'cancelled')
    assert.equal(cancelResponse.body().appointment.version, 3)
    assert.equal(cancelResponse.body().appointment.cancellationReasonCode, 'patient_request')
    assert.equal(
      cancelResponse.body().appointment.cancellationNote,
      'Paciente solicitou o cancelamento'
    )

    const invalidConfirmResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments/${appointmentId}/confirm`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        expectedVersion: 3,
      })

    invalidConfirmResponse.assertStatus(409)
  })

  test('enforces temporal rules for completion and no-show', async ({ client, assert }) => {
    const { clinic, receptionist, patientLink, professionalLink } =
      await createReceptionistAppointmentContext({
        clinicName: 'Clínica de Regras Temporais',
        email: 'appointments.temporal@example.com',
        patientName: 'Paciente Temporal',
        professionalName: 'Dr. Regras Temporais',
        crmNumber: '96002',
      })

    const firstStart = futureMondayAt(9)
    const secondStart = futureMondayAt(11)

    await createAvailability({
      professionalLink,
      weekday: firstStart.weekday,
    })

    const token = await createToken(receptionist)

    const firstCreateResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        patientClinicId: patientLink.id,
        clinicProfessionalId: professionalLink.id,
        startsAt: toUtcIso(firstStart),
        durationMinutes: 60,
      })

    firstCreateResponse.assertStatus(201)

    const secondCreateResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        patientClinicId: patientLink.id,
        clinicProfessionalId: professionalLink.id,
        startsAt: toUtcIso(secondStart),
        durationMinutes: 60,
      })

    secondCreateResponse.assertStatus(201)

    const firstAppointmentId = firstCreateResponse.body().appointment.id
    const secondAppointmentId = secondCreateResponse.body().appointment.id

    const earlyCompleteResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments/${firstAppointmentId}/complete`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        expectedVersion: 1,
      })

    earlyCompleteResponse.assertStatus(409)
    earlyCompleteResponse.assertBodyContains({
      message: 'O agendamento não pode ser marcado como realizado antes do horário de início',
    })

    const earlyNoShowResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments/${secondAppointmentId}/no-show`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        expectedVersion: 1,
      })

    earlyNoShowResponse.assertStatus(409)
    earlyNoShowResponse.assertBodyContains({
      message: 'A falta somente pode ser registrada após 15 minutos do horário inicial',
    })

    const firstAppointment = await Appointment.findOrFail(firstAppointmentId)
    const secondAppointment = await Appointment.findOrFail(secondAppointmentId)

    const now = DateTime.utc().startOf('minute')

    firstAppointment.startsAt = now.minus({ hours: 4 })
    firstAppointment.endsAt = now.minus({ hours: 3 })
    await firstAppointment.save()

    secondAppointment.startsAt = now.minus({ hours: 2 })
    secondAppointment.endsAt = now.minus({ hours: 1 })
    await secondAppointment.save()

    const completeResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments/${firstAppointmentId}/complete`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        expectedVersion: 1,
      })

    completeResponse.assertStatus(200)
    assert.equal(completeResponse.body().appointment.status, 'completed')
    assert.equal(completeResponse.body().appointment.version, 2)

    const noShowResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments/${secondAppointmentId}/no-show`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        expectedVersion: 1,
      })

    noShowResponse.assertStatus(200)
    assert.equal(noShowResponse.body().appointment.status, 'no_show')
    assert.equal(noShowResponse.body().appointment.version, 2)
  })

  test('reschedules an appointment and preserves the previous record', async ({
    client,
    assert,
  }) => {
    const { clinic, receptionist, patientLink, professionalLink } =
      await createReceptionistAppointmentContext({
        clinicName: 'Clínica de Reagendamento',
        email: 'appointments.reschedule@example.com',
        patientName: 'Paciente Reagendado',
        professionalName: 'Dra. Reagendamento',
        crmNumber: '96003',
      })

    const originalStart = futureMondayAt(9)
    const newStart = originalStart.plus({ hours: 2 })

    await createAvailability({
      professionalLink,
      weekday: originalStart.weekday,
    })

    const token = await createToken(receptionist)

    const createResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        patientClinicId: patientLink.id,
        clinicProfessionalId: professionalLink.id,
        startsAt: toUtcIso(originalStart),
        durationMinutes: 60,
        appointmentTypeCode: 'RETURN',
        administrativeNote: 'Observação preservada',
      })

    createResponse.assertStatus(201)

    const originalAppointmentId = createResponse.body().appointment.id

    const rescheduleResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments/${originalAppointmentId}/reschedule`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        expectedVersion: 1,
        startsAt: toUtcIso(newStart),
        durationMinutes: 60,
        cancellationNote: 'Paciente solicitou novo horário',
      })

    rescheduleResponse.assertStatus(201)

    const nextAppointment = rescheduleResponse.body().appointment

    assert.notEqual(nextAppointment.id, originalAppointmentId)
    assert.equal(nextAppointment.status, 'scheduled')
    assert.equal(nextAppointment.version, 1)
    assert.equal(nextAppointment.rescheduledFromAppointmentId, originalAppointmentId)
    assert.equal(nextAppointment.appointmentTypeCode, 'RETURN')
    assert.equal(nextAppointment.administrativeNote, 'Observação preservada')

    const previousAppointment = await Appointment.findOrFail(originalAppointmentId)

    assert.equal(previousAppointment.status, 'cancelled')
    assert.equal(previousAppointment.version, 2)
    assert.equal(previousAppointment.cancellationReasonCode, 'rescheduled')
    assert.equal(previousAppointment.cancellationNote, 'Paciente solicitou novo horário')

    const successors = await Appointment.query().where(
      'rescheduled_from_appointment_id',
      originalAppointmentId
    )

    assert.lengthOf(successors, 1)

    const repeatedRescheduleResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments/${originalAppointmentId}/reschedule`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        expectedVersion: 2,
        startsAt: toUtcIso(newStart.plus({ hours: 2 })),
      })

    repeatedRescheduleResponse.assertStatus(409)
  })

  test('rolls back rescheduling when the new slot conflicts', async ({ client, assert }) => {
    const { clinic, receptionist, patientLink, professionalLink } =
      await createReceptionistAppointmentContext({
        clinicName: 'Clínica de Reagendamento Atômico',
        email: 'appointments.atomic@example.com',
        patientName: 'Paciente Atômico',
        professionalName: 'Dr. Reagendamento Atômico',
        crmNumber: '96004',
      })

    const originalStart = futureMondayAt(9)
    const occupiedStart = originalStart.plus({ hours: 2 })

    await createAvailability({
      professionalLink,
      weekday: originalStart.weekday,
    })

    const token = await createToken(receptionist)

    const originalResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        patientClinicId: patientLink.id,
        clinicProfessionalId: professionalLink.id,
        startsAt: toUtcIso(originalStart),
        durationMinutes: 60,
      })

    originalResponse.assertStatus(201)

    const occupiedResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        patientClinicId: patientLink.id,
        clinicProfessionalId: professionalLink.id,
        startsAt: toUtcIso(occupiedStart),
        durationMinutes: 60,
      })

    occupiedResponse.assertStatus(201)

    const originalAppointmentId = originalResponse.body().appointment.id

    const rescheduleResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments/${originalAppointmentId}/reschedule`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        expectedVersion: 1,
        startsAt: toUtcIso(occupiedStart),
        durationMinutes: 60,
      })

    rescheduleResponse.assertStatus(409)

    const originalAppointment = await Appointment.findOrFail(originalAppointmentId)

    assert.equal(originalAppointment.status, 'scheduled')
    assert.equal(originalAppointment.version, 1)
    assert.isNull(originalAppointment.cancelledAt)
    assert.isNull(originalAppointment.cancellationReasonCode)

    const successors = await Appointment.query().where(
      'rescheduled_from_appointment_id',
      originalAppointmentId
    )

    assert.lengthOf(successors, 0)
  })

  test('allows a doctor to change and reschedule only own appointments', async ({
    client,
    assert,
  }) => {
    const clinic = await ClinicFactory.merge({
      timezone: CLINIC_TIMEZONE,
      name: 'Clínica de Status dos Médicos',
    }).create()

    const firstDoctor = await UserFactory.merge({
      fullName: 'Usuário de Agendamentos',
      email: 'appointments.status.first.doctor@example.com',
    }).create()

    const secondDoctor = await UserFactory.merge({
      fullName: 'Usuário de Agendamentos',
      email: 'appointments.status.second.doctor@example.com',
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

    const { patientLink } = await createPatientLink({
      clinic,
      fullName: 'Paciente de Status Médico',
    })

    const { professionalLink: firstProfessionalLink } = await createProfessionalLink({
      clinic,
      fullName: 'Dr. Primeiro Status',
      crmNumber: '96005',
      userId: firstDoctor.id,
    })

    const { professionalLink: secondProfessionalLink } = await createProfessionalLink({
      clinic,
      fullName: 'Dra. Segundo Status',
      crmNumber: '96006',
      userId: secondDoctor.id,
    })

    const firstStart = futureMondayAt(9)
    const secondStart = futureMondayAt(13)

    await createAvailability({
      professionalLink: firstProfessionalLink,
      weekday: firstStart.weekday,
    })

    await createAvailability({
      professionalLink: secondProfessionalLink,
      weekday: secondStart.weekday,
    })

    const firstToken = await createToken(firstDoctor)
    const secondToken = await createToken(secondDoctor)

    const firstCreateResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${firstToken}`)
      .json({
        patientClinicId: patientLink.id,
        clinicProfessionalId: firstProfessionalLink.id,
        startsAt: toUtcIso(firstStart),
        durationMinutes: 60,
      })

    firstCreateResponse.assertStatus(201)

    const secondCreateResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${secondToken}`)
      .json({
        patientClinicId: patientLink.id,
        clinicProfessionalId: secondProfessionalLink.id,
        startsAt: toUtcIso(secondStart),
        durationMinutes: 60,
      })

    secondCreateResponse.assertStatus(201)

    const firstAppointmentId = firstCreateResponse.body().appointment.id

    const secondAppointmentId = secondCreateResponse.body().appointment.id

    const ownConfirmResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments/${firstAppointmentId}/confirm`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${firstToken}`)
      .json({
        expectedVersion: 1,
      })

    ownConfirmResponse.assertStatus(200)
    assert.equal(ownConfirmResponse.body().appointment.version, 2)

    const ownRescheduleResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments/${firstAppointmentId}/reschedule`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${firstToken}`)
      .json({
        expectedVersion: 2,
        startsAt: toUtcIso(firstStart.plus({ hours: 2 })),
        durationMinutes: 60,
      })

    ownRescheduleResponse.assertStatus(201)

    const otherCancelResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments/${secondAppointmentId}/cancel`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${firstToken}`)
      .json({
        expectedVersion: 1,
        cancellationReasonCode: 'other',
      })

    otherCancelResponse.assertStatus(403)

    const otherRescheduleResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments/${secondAppointmentId}/reschedule`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${firstToken}`)
      .json({
        expectedVersion: 1,
        startsAt: toUtcIso(secondStart.plus({ hours: 2 })),
      })

    otherRescheduleResponse.assertStatus(403)
  })

  test('requires the reschedule command for schedule changes', async ({ client, assert }) => {
    const { clinic, receptionist, patientLink, professionalLink } =
      await createReceptionistAppointmentContext({
        clinicName: 'Clínica de Alteração de Agenda',
        email: 'appointments.schedule.change@example.com',
        patientName: 'Paciente de Alteração',
        professionalName: 'Dra. Alteração',
        crmNumber: '96007',
      })

    const originalStart = futureMondayAt(9)

    await createAvailability({
      professionalLink,
      weekday: originalStart.weekday,
    })

    const token = await createToken(receptionist)

    const createResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        patientClinicId: patientLink.id,
        clinicProfessionalId: professionalLink.id,
        startsAt: toUtcIso(originalStart),
        durationMinutes: 60,
      })

    createResponse.assertStatus(201)

    const appointmentId = createResponse.body().appointment.id

    const directUpdateResponse = await client
      .patch(`/api/v1/clinics/${clinic.id}/appointments/${appointmentId}`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        startsAt: toUtcIso(originalStart.plus({ hours: 1 })),
        durationMinutes: 30,
        expectedVersion: 1,
      })

    directUpdateResponse.assertStatus(400)

    let appointment = await Appointment.findOrFail(appointmentId)

    assert.equal(appointment.startsAt.toMillis(), originalStart.toUTC().toMillis())
    assert.equal(appointment.version, 1)

    const noChangeRescheduleResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/appointments/${appointmentId}/reschedule`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        expectedVersion: 1,
        startsAt: toUtcIso(originalStart),
        durationMinutes: 60,
      })

    noChangeRescheduleResponse.assertStatus(422)
    noChangeRescheduleResponse.assertBodyContains({
      message: 'Informe um novo horário, duração ou profissional para o reagendamento',
    })

    appointment = await Appointment.findOrFail(appointmentId)

    assert.equal(appointment.status, 'scheduled')
    assert.equal(appointment.version, 1)
  })
})
