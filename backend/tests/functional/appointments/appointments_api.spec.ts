import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import User from '#models/user'
import Clinic from '#models/clinic'
import Role from '#models/role'
import Patient from '#models/patient'
import PatientClinic from '#models/patient_clinic'
import Professional from '#models/professional'
import ClinicProfessional from '#models/clinic_professional'
import ProfessionalWeeklyAvailability from '#models/professional_weekly_availability'
import ProfessionalScheduleBlock from '#models/professional_schedule_block'
import Appointment from '#models/appointment'
import UserClinicRole from '#models/user_clinic_role'
import { truncateClinicSchemaTables } from '../../helpers/database.js'
import { seedAuthorizationCatalog } from '../../../database/seeders/authorization_catalog_seeder.js'

const CLINIC_TIMEZONE = 'America/Sao_Paulo'

type RoleCode = 'clinic_admin' | 'receptionist' | 'doctor'

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

async function createUser(email: string) {
  return User.create({
    fullName: 'Usuário de Agendamentos',
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
    timezone: CLINIC_TIMEZONE,
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
  roleCode: RoleCode
}) {
  const role = await Role.findByOrFail('code', roleCode)

  return UserClinicRole.create({
    userId: user.id,
    clinicId: clinic.id,
    roleId: role.id,
    isActive: true,
  })
}

async function createToken(user: User) {
  const token = await User.accessTokens.create(user)
  return token.value!.release()
}

async function createPatientLink({ clinic, fullName }: { clinic: Clinic; fullName: string }) {
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

  const patientLink = await PatientClinic.create({
    patientId: patient.id,
    clinicId: clinic.id,
    localRecordNumber: null,
    isActive: true,
  })

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
  const professional = await Professional.create({
    userId,
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
    acceptsAppointments,
    isActive,
  })

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
  return ProfessionalWeeklyAvailability.create({
    clinicProfessionalId: professionalLink.id,
    weekday,
    startTime,
    endTime,
    isActive: true,
  })
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
    const clinic = await createClinic('Clínica de Leitura')

    const from = futureMondayAt(0)
    const to = from.plus({ days: 7 })

    const unauthenticatedResponse = await client
      .get(`/api/v1/clinics/${clinic.id}/appointments?from=${toUtcIso(from)}&to=${toUtcIso(to)}`)
      .header('Accept', 'application/json')

    unauthenticatedResponse.assertStatus(401)

    const receptionist = await createUser('appointments.read.receptionist@example.com')

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
    const clinic = await createClinic('Clínica de Agendamentos')

    const receptionist = await createUser('appointments.receptionist@example.com')

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
    const clinic = await createClinic('Clínica dos Médicos')

    const firstDoctor = await createUser('appointments.first.doctor@example.com')

    const secondDoctor = await createUser('appointments.second.doctor@example.com')

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
    const clinic = await createClinic('Clínica de Validações')

    const receptionist = await createUser('appointments.validation@example.com')

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
    const firstClinic = await createClinic('Primeira Clínica Isolada')
    const secondClinic = await createClinic('Segunda Clínica Isolada')

    const receptionist = await createUser('appointments.multiclinic@example.com')

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
    const clinic = await createClinic('Clínica Concorrente')

    const receptionist = await createUser('appointments.concurrent@example.com')

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
})
