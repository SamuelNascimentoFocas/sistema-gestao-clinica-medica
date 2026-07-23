import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import User from '#models/user'
import Clinic from '#models/clinic'
import Professional from '#models/professional'
import ClinicProfessional from '#models/clinic_professional'
import ProfessionalWeeklyAvailability from '#models/professional_weekly_availability'
import ProfessionalScheduleBlock from '#models/professional_schedule_block'
import { truncateClinicSchemaTables } from '../../helpers/database.js'

async function createUser(email: string) {
  return User.create({
    fullName: 'Usuário Profissional',
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

async function createProfessional({
  fullName,
  crmNumber,
  crmState = 'MG',
  userId = null,
}: {
  fullName: string
  crmNumber: string
  crmState?: string
  userId?: string | null
}) {
  return Professional.create({
    userId,
    fullName,
    crmNumber,
    crmState,
    specialty: 'Clínica Médica',
    phone: null,
    email: null,
    isActive: true,
  })
}

test.group('Professional models', (group) => {
  group.each.setup(async () => {
    await truncateClinicSchemaTables()

    return async () => {
      await truncateClinicSchemaTables()
    }
  })

  test('relates a professional to user, clinic and schedules', async ({ assert }) => {
    const user = await createUser('doctor.model@example.com')
    const clinic = await createClinic('Clínica Profissional')

    const professional = await createProfessional({
      fullName: 'Dra. Helena Martins',
      crmNumber: '12345',
      userId: user.id,
    })

    const clinicLink = await professional.related('clinicLinks').create({
      clinicId: clinic.id,
      localCode: 'MED-001',
      defaultAppointmentDurationMinutes: 30,
      acceptsAppointments: true,
      isActive: true,
    })

    const availability = await clinicLink.related('weeklyAvailabilities').create({
      weekday: 1,
      startTime: '08:00',
      endTime: '12:00',
      isActive: true,
    })

    const scheduleBlock = await clinicLink.related('scheduleBlocks').create({
      startsAt: DateTime.fromISO('2026-08-10T12:00:00.000Z'),
      endsAt: DateTime.fromISO('2026-08-10T15:00:00.000Z'),
      reason: 'Congresso médico',
      isActive: true,
    })

    const loadedProfessional = await Professional.query()
      .where('id', professional.id)
      .preload('user')
      .preload('clinicLinks', (linkQuery) => {
        linkQuery.preload('clinic').preload('weeklyAvailabilities').preload('scheduleBlocks')
      })
      .firstOrFail()

    assert.equal(loadedProfessional.user.id, user.id)
    assert.lengthOf(loadedProfessional.clinicLinks, 1)

    const loadedLink = loadedProfessional.clinicLinks[0]

    assert.equal(loadedLink.clinic.id, clinic.id)
    assert.equal(loadedLink.localCode, 'MED-001')
    assert.lengthOf(loadedLink.weeklyAvailabilities, 1)
    assert.lengthOf(loadedLink.scheduleBlocks, 1)

    assert.equal(loadedLink.weeklyAvailabilities[0].id, availability.id)

    assert.match(loadedLink.weeklyAvailabilities[0].startTime, /^08:00/)

    assert.equal(loadedLink.scheduleBlocks[0].id, scheduleBlock.id)

    await user.load('professionalProfile')
    await clinic.load('professionalLinks')
    await availability.load('clinicProfessional')
    await scheduleBlock.load('clinicProfessional')

    assert.equal(user.professionalProfile.id, professional.id)
    assert.lengthOf(clinic.professionalLinks, 1)
    assert.equal(availability.clinicProfessional.id, clinicLink.id)
    assert.equal(scheduleBlock.clinicProfessional.id, clinicLink.id)
  })

  test('enforces unique CRM and optional unique user link', async ({ assert }) => {
    const firstUser = await createUser('first.professional@example.com')

    await createProfessional({
      fullName: 'Primeiro Médico',
      crmNumber: '54321',
      crmState: 'MG',
      userId: firstUser.id,
    })

    await assert.rejects(() =>
      createProfessional({
        fullName: 'CRM Duplicado',
        crmNumber: '54321',
        crmState: 'MG',
      })
    )

    await createProfessional({
      fullName: 'Mesmo Número em Outra UF',
      crmNumber: '54321',
      crmState: 'SP',
    })

    await assert.rejects(() =>
      createProfessional({
        fullName: 'Usuário Duplicado',
        crmNumber: '99999',
        crmState: 'MG',
        userId: firstUser.id,
      })
    )

    const withoutUserOne = await createProfessional({
      fullName: 'Profissional sem Usuário 1',
      crmNumber: '10001',
    })

    const withoutUserTwo = await createProfessional({
      fullName: 'Profissional sem Usuário 2',
      crmNumber: '10002',
    })

    assert.isNull(withoutUserOne.userId)
    assert.isNull(withoutUserTwo.userId)
  })

  test('enforces clinic and schedule constraints', async ({ assert }) => {
    const firstClinic = await createClinic('Primeira Clínica')
    const secondClinic = await createClinic('Segunda Clínica')

    const firstProfessional = await createProfessional({
      fullName: 'Primeiro Profissional',
      crmNumber: '20001',
    })

    const secondProfessional = await createProfessional({
      fullName: 'Segundo Profissional',
      crmNumber: '20002',
    })

    const firstLink = await ClinicProfessional.create({
      clinicId: firstClinic.id,
      professionalId: firstProfessional.id,
      localCode: 'LOCAL-001',
      defaultAppointmentDurationMinutes: 30,
      acceptsAppointments: true,
      isActive: true,
    })

    await assert.rejects(() =>
      ClinicProfessional.create({
        clinicId: firstClinic.id,
        professionalId: firstProfessional.id,
        localCode: 'OUTRO-CODIGO',
        defaultAppointmentDurationMinutes: 30,
        acceptsAppointments: true,
        isActive: true,
      })
    )

    await assert.rejects(() =>
      ClinicProfessional.create({
        clinicId: firstClinic.id,
        professionalId: secondProfessional.id,
        localCode: 'LOCAL-001',
        defaultAppointmentDurationMinutes: 30,
        acceptsAppointments: true,
        isActive: true,
      })
    )

    await ClinicProfessional.create({
      clinicId: secondClinic.id,
      professionalId: secondProfessional.id,
      localCode: 'LOCAL-001',
      defaultAppointmentDurationMinutes: 45,
      acceptsAppointments: true,
      isActive: true,
    })

    await assert.rejects(() =>
      ClinicProfessional.create({
        clinicId: secondClinic.id,
        professionalId: firstProfessional.id,
        localCode: 'INVALID-DURATION',
        defaultAppointmentDurationMinutes: 3,
        acceptsAppointments: true,
        isActive: true,
      })
    )

    await assert.rejects(() =>
      ProfessionalWeeklyAvailability.create({
        clinicProfessionalId: firstLink.id,
        weekday: 0,
        startTime: '08:00',
        endTime: '12:00',
        isActive: true,
      })
    )

    await assert.rejects(() =>
      ProfessionalWeeklyAvailability.create({
        clinicProfessionalId: firstLink.id,
        weekday: 2,
        startTime: '18:00',
        endTime: '08:00',
        isActive: true,
      })
    )

    await assert.rejects(() =>
      ProfessionalScheduleBlock.create({
        clinicProfessionalId: firstLink.id,
        startsAt: DateTime.fromISO('2026-08-10T15:00:00.000Z'),
        endsAt: DateTime.fromISO('2026-08-10T12:00:00.000Z'),
        reason: 'Ordem inválida',
        isActive: true,
      })
    )
  })
})
