import { test } from '@japa/runner'
import User from '#models/user'
import Clinic from '#models/clinic'
import Role from '#models/role'
import Professional from '#models/professional'
import ClinicProfessional from '#models/clinic_professional'
import UserClinicRole from '#models/user_clinic_role'
import { truncateClinicSchemaTables } from '../../helpers/database.js'
import { seedAuthorizationCatalog } from '../../../database/seeders/authorization_catalog_seeder.js'

type RoleCode = 'clinic_admin' | 'receptionist' | 'doctor'

async function createUser(email: string) {
  return User.create({
    fullName: 'Usuário da Agenda',
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

async function createProfessional({
  fullName,
  crmNumber,
  userId = null,
}: {
  fullName: string
  crmNumber: string
  userId?: string | null
}) {
  return Professional.create({
    userId,
    fullName,
    crmNumber,
    crmState: 'MG',
    specialty: 'Clínica Médica',
    phone: null,
    email: null,
    isActive: true,
  })
}

async function createClinicProfessional({
  clinic,
  professional,
  isActive = true,
}: {
  clinic: Clinic
  professional: Professional
  isActive?: boolean
}) {
  return ClinicProfessional.create({
    clinicId: clinic.id,
    professionalId: professional.id,
    localCode: null,
    defaultAppointmentDurationMinutes: 30,
    acceptsAppointments: true,
    isActive,
  })
}

async function createToken(user: User) {
  const token = await User.accessTokens.create(user)
  return token.value!.release()
}

test.group('Professional schedules API', (group) => {
  group.each.setup(async () => {
    await truncateClinicSchemaTables()
    await seedAuthorizationCatalog()

    return async () => {
      await truncateClinicSchemaTables()
    }
  })

  test('requires authentication and allows schedule reading', async ({ client, assert }) => {
    const clinic = await createClinic('Clínica de Leitura')

    const professional = await createProfessional({
      fullName: 'Dr. Agenda Pública',
      crmNumber: '70001',
    })

    await createClinicProfessional({
      clinic,
      professional,
    })

    const unauthenticatedResponse = await client
      .get(`/api/v1/clinics/${clinic.id}/professionals/${professional.id}/schedule`)
      .header('Accept', 'application/json')

    unauthenticatedResponse.assertStatus(401)

    const receptionist = await createUser('schedule.receptionist@example.com')

    await createMembership({
      user: receptionist,
      clinic,
      roleCode: 'receptionist',
    })

    const token = await createToken(receptionist)

    const readResponse = await client
      .get(`/api/v1/clinics/${clinic.id}/professionals/${professional.id}/schedule`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    readResponse.assertStatus(200)

    assert.equal(readResponse.body().schedule.professional.id, professional.id)
    assert.lengthOf(readResponse.body().schedule.weeklyAvailabilities, 0)
    assert.lengthOf(readResponse.body().schedule.scheduleBlocks, 0)

    const writeResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/professionals/${professional.id}/weekly-availabilities`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        weekday: 1,
        startTime: '08:00',
        endTime: '12:00',
      })

    writeResponse.assertStatus(403)
    writeResponse.assertBodyContains({
      message: 'Permissão insuficiente para administrar agendas',
    })
  })

  test('allows a clinic administrator to manage schedules and rejects overlaps', async ({
    client,
    assert,
  }) => {
    const clinic = await createClinic('Clínica Administrada')

    const professional = await createProfessional({
      fullName: 'Dra. Agenda Administrada',
      crmNumber: '70002',
    })

    await createClinicProfessional({
      clinic,
      professional,
    })

    const clinicAdmin = await createUser('schedule.admin@example.com')

    await createMembership({
      user: clinicAdmin,
      clinic,
      roleCode: 'clinic_admin',
    })

    const token = await createToken(clinicAdmin)

    const firstAvailabilityResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/professionals/${professional.id}/weekly-availabilities`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        weekday: 1,
        startTime: '08:00',
        endTime: '12:00',
      })

    firstAvailabilityResponse.assertStatus(201)

    const firstAvailability = firstAvailabilityResponse.body().availability

    assert.equal(firstAvailability.weekday, 1)
    assert.match(firstAvailability.startTime, /^08:00/)
    assert.match(firstAvailability.endTime, /^12:00/)

    const overlapResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/professionals/${professional.id}/weekly-availabilities`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        weekday: 1,
        startTime: '10:00',
        endTime: '13:00',
      })

    overlapResponse.assertStatus(409)

    const adjacentAvailabilityResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/professionals/${professional.id}/weekly-availabilities`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        weekday: 1,
        startTime: '12:00',
        endTime: '14:00',
      })

    adjacentAvailabilityResponse.assertStatus(201)

    const updateAvailabilityResponse = await client
      .patch(
        `/api/v1/clinics/${clinic.id}/professionals/${professional.id}/weekly-availabilities/${firstAvailability.id}`
      )
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        startTime: '07:00',
        endTime: '10:00',
      })

    updateAvailabilityResponse.assertStatus(200)
    assert.match(updateAvailabilityResponse.body().availability.startTime, /^07:00/)

    const availabilityStatusResponse = await client
      .patch(
        `/api/v1/clinics/${clinic.id}/professionals/${professional.id}/weekly-availabilities/${firstAvailability.id}/status`
      )
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        isActive: false,
      })

    availabilityStatusResponse.assertStatus(200)
    assert.isFalse(availabilityStatusResponse.body().availability.isActive)

    const firstBlockResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/professionals/${professional.id}/schedule-blocks`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        startsAt: '2026-08-10T12:00:00.000Z',
        endsAt: '2026-08-10T15:00:00.000Z',
        reason: 'Congresso médico',
      })

    firstBlockResponse.assertStatus(201)

    const firstBlock = firstBlockResponse.body().scheduleBlock

    const blockOverlapResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/professionals/${professional.id}/schedule-blocks`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        startsAt: '2026-08-10T14:00:00.000Z',
        endsAt: '2026-08-10T16:00:00.000Z',
      })

    blockOverlapResponse.assertStatus(409)

    const updateBlockResponse = await client
      .patch(
        `/api/v1/clinics/${clinic.id}/professionals/${professional.id}/schedule-blocks/${firstBlock.id}`
      )
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        startsAt: '2026-08-10T11:00:00.000Z',
        endsAt: '2026-08-10T14:00:00.000Z',
        reason: 'Congresso atualizado',
      })

    updateBlockResponse.assertStatus(200)
    assert.equal(updateBlockResponse.body().scheduleBlock.reason, 'Congresso atualizado')

    const blockStatusResponse = await client
      .patch(
        `/api/v1/clinics/${clinic.id}/professionals/${professional.id}/schedule-blocks/${firstBlock.id}/status`
      )
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        isActive: false,
      })

    blockStatusResponse.assertStatus(200)
    assert.isFalse(blockStatusResponse.body().scheduleBlock.isActive)

    const scheduleResponse = await client
      .get(`/api/v1/clinics/${clinic.id}/professionals/${professional.id}/schedule`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)

    scheduleResponse.assertStatus(200)
    assert.lengthOf(scheduleResponse.body().schedule.weeklyAvailabilities, 2)
    assert.lengthOf(scheduleResponse.body().schedule.scheduleBlocks, 1)
  })

  test('allows a doctor to manage only the own professional schedule', async ({
    client,
    assert,
  }) => {
    const clinic = await createClinic('Clínica Médica')

    const firstDoctorUser = await createUser('first.schedule.doctor@example.com')

    const secondDoctorUser = await createUser('second.schedule.doctor@example.com')

    await createMembership({
      user: firstDoctorUser,
      clinic,
      roleCode: 'doctor',
    })

    await createMembership({
      user: secondDoctorUser,
      clinic,
      roleCode: 'doctor',
    })

    const firstProfessional = await createProfessional({
      fullName: 'Dr. Primeiro Médico',
      crmNumber: '70003',
      userId: firstDoctorUser.id,
    })

    const secondProfessional = await createProfessional({
      fullName: 'Dra. Segunda Médica',
      crmNumber: '70004',
      userId: secondDoctorUser.id,
    })

    await createClinicProfessional({
      clinic,
      professional: firstProfessional,
    })

    await createClinicProfessional({
      clinic,
      professional: secondProfessional,
    })

    const token = await createToken(firstDoctorUser)

    const ownScheduleResponse = await client
      .post(
        `/api/v1/clinics/${clinic.id}/professionals/${firstProfessional.id}/weekly-availabilities`
      )
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        weekday: 2,
        startTime: '08:00',
        endTime: '12:00',
      })

    ownScheduleResponse.assertStatus(201)

    const otherScheduleResponse = await client
      .post(
        `/api/v1/clinics/${clinic.id}/professionals/${secondProfessional.id}/weekly-availabilities`
      )
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        weekday: 2,
        startTime: '13:00',
        endTime: '17:00',
      })

    otherScheduleResponse.assertStatus(403)
    otherScheduleResponse.assertBodyContains({
      message: 'Você somente pode administrar a própria agenda',
    })

    assert.equal(ownScheduleResponse.body().availability.weekday, 2)
  })

  test('validates time order and scopes schedule items to their professional', async ({
    client,
  }) => {
    const clinic = await createClinic('Clínica de Validação')

    const firstProfessional = await createProfessional({
      fullName: 'Dr. Primeiro Horário',
      crmNumber: '70005',
    })

    const secondProfessional = await createProfessional({
      fullName: 'Dra. Segundo Horário',
      crmNumber: '70006',
    })

    await createClinicProfessional({
      clinic,
      professional: firstProfessional,
    })

    await createClinicProfessional({
      clinic,
      professional: secondProfessional,
    })

    const clinicAdmin = await createUser('schedule.validation.admin@example.com')

    await createMembership({
      user: clinicAdmin,
      clinic,
      roleCode: 'clinic_admin',
    })

    const token = await createToken(clinicAdmin)

    const invalidAvailabilityResponse = await client
      .post(
        `/api/v1/clinics/${clinic.id}/professionals/${firstProfessional.id}/weekly-availabilities`
      )
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        weekday: 1,
        startTime: '18:00',
        endTime: '08:00',
      })

    invalidAvailabilityResponse.assertStatus(422)
    invalidAvailabilityResponse.assertBodyContains({
      message: 'O horário inicial deve ser anterior ao horário final',
    })

    const invalidBlockResponse = await client
      .post(`/api/v1/clinics/${clinic.id}/professionals/${firstProfessional.id}/schedule-blocks`)
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        startsAt: '2026-08-10T15:00:00.000Z',
        endsAt: '2026-08-10T12:00:00.000Z',
      })

    invalidBlockResponse.assertStatus(422)
    invalidBlockResponse.assertBodyContains({
      message: 'O início do bloqueio deve ser anterior ao fim',
    })

    const createAvailabilityResponse = await client
      .post(
        `/api/v1/clinics/${clinic.id}/professionals/${firstProfessional.id}/weekly-availabilities`
      )
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        weekday: 3,
        startTime: '08:00',
        endTime: '12:00',
      })

    createAvailabilityResponse.assertStatus(201)

    const availabilityId = createAvailabilityResponse.body().availability.id

    const crossProfessionalUpdateResponse = await client
      .patch(
        `/api/v1/clinics/${clinic.id}/professionals/${secondProfessional.id}/weekly-availabilities/${availabilityId}`
      )
      .header('Accept', 'application/json')
      .header('Authorization', `Bearer ${token}`)
      .json({
        startTime: '09:00',
      })

    crossProfessionalUpdateResponse.assertStatus(404)
    crossProfessionalUpdateResponse.assertBodyContains({
      message: 'Horário semanal não encontrado',
    })
  })
})
