import { DateTime } from 'luxon'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import env from '#start/env'
import User from '#models/user'
import Clinic from '#models/clinic'
import Role from '#models/role'
import UserClinicRole from '#models/user_clinic_role'
import Patient from '#models/patient'
import PatientClinic from '#models/patient_clinic'
import MedicalRecord from '#models/medical_record'
import Professional from '#models/professional'
import ClinicProfessional from '#models/clinic_professional'
import ProfessionalWeeklyAvailability from '#models/professional_weekly_availability'
import Appointment from '#models/appointment'
import { seedAuthorizationCatalog } from './authorization_catalog_seeder.js'

const DEMO_TIMEZONE = 'America/Sao_Paulo'
const DEMO_PASSWORD = 'DemoClinic!123'
const DEMO_APPOINTMENT_DURATION_MINUTES = 30

const DEMO_APPOINTMENT_IDS = {
  primary: '7e7a03d4-5d62-4d0d-9e01-000000000001',
  secondary: '7e7a03d4-5d62-4d0d-9e01-000000000002',
} as const

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

async function upsertUser({ fullName, email }: { fullName: string; email: string }) {
  const emailNormalized = normalizeEmail(email)

  return User.updateOrCreate(
    {
      emailNormalized,
    },
    {
      fullName,
      email,
      emailNormalized,
      passwordHash: DEMO_PASSWORD,
      isGlobalAdmin: false,
      isActive: true,
      lastLoginAt: null,
    }
  )
}

async function upsertMembership({
  user,
  clinic,
  role,
}: {
  user: User
  clinic: Clinic
  role: Role
}) {
  return UserClinicRole.updateOrCreate(
    {
      userId: user.id,
      clinicId: clinic.id,
    },
    {
      userId: user.id,
      clinicId: clinic.id,
      roleId: role.id,
      isActive: true,
    }
  )
}

async function upsertWeekdayAvailabilities(clinicProfessional: ClinicProfessional) {
  for (let weekday = 1; weekday <= 5; weekday += 1) {
    await ProfessionalWeeklyAvailability.updateOrCreate(
      {
        clinicProfessionalId: clinicProfessional.id,
        weekday,
        startTime: '08:00:00',
        endTime: '17:00:00',
      },
      {
        clinicProfessionalId: clinicProfessional.id,
        weekday,
        startTime: '08:00:00',
        endTime: '17:00:00',
        isActive: true,
      }
    )
  }
}

async function findAvailableAppointmentStart({
  clinic,
  clinicProfessional,
  appointmentId,
  hour,
}: {
  clinic: Clinic
  clinicProfessional: ClinicProfessional
  appointmentId: string
  hour: number
}) {
  const today = DateTime.now().setZone(clinic.timezone).startOf('day')

  for (let dayOffset = 1; dayOffset <= 90; dayOffset += 1) {
    const candidateDay = today.plus({
      days: dayOffset,
    })

    if (candidateDay.weekday > 5) {
      continue
    }

    const startsAt = candidateDay
      .set({
        hour,
        minute: 0,
        second: 0,
        millisecond: 0,
      })
      .toUTC()

    const endsAt = startsAt.plus({
      minutes: DEMO_APPOINTMENT_DURATION_MINUTES,
    })

    const conflictingAppointment = await Appointment.query()
      .where('clinic_id', clinic.id)
      .where('clinic_professional_id', clinicProfessional.id)
      .whereIn('status', ['scheduled', 'confirmed'])
      .whereNot('id', appointmentId)
      .where('starts_at', '<', endsAt.toSQL()!)
      .where('ends_at', '>', startsAt.toSQL()!)
      .first()

    if (!conflictingAppointment) {
      return startsAt
    }
  }

  throw new Error(
    `Nenhum horário demonstrativo disponível nos próximos 90 dias para ${clinic.name}`
  )
}

async function upsertAppointment({
  id,
  clinic,
  patientLink,
  professionalLink,
  createdByUser,
  hour,
  administrativeNote,
}: {
  id: string
  clinic: Clinic
  patientLink: PatientClinic
  professionalLink: ClinicProfessional
  createdByUser: User
  hour: number
  administrativeNote: string
}) {
  const startsAt = await findAvailableAppointmentStart({
    clinic,
    clinicProfessional: professionalLink,
    appointmentId: id,
    hour,
  })

  const endsAt = startsAt.plus({
    minutes: DEMO_APPOINTMENT_DURATION_MINUTES,
  })

  return Appointment.updateOrCreate(
    {
      id,
    },
    {
      id,
      clinicId: clinic.id,
      patientClinicId: patientLink.id,
      clinicProfessionalId: professionalLink.id,
      startsAt,
      endsAt,
      status: 'scheduled',
      version: 1,
      appointmentTypeCode: 'consulta_demo',
      administrativeNote,
      createdByUserId: createdByUser.id,
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
  )
}

export default class DemoScenarioSeeder extends BaseSeeder {
  async run() {
    if (env.get('NODE_ENV') === 'production') {
      throw new Error('O seeder de cenário demonstrativo não pode ser executado em produção')
    }

    await seedAuthorizationCatalog()

    const clinicAdminRole = await Role.findByOrFail('code', 'clinic_admin')
    const receptionistRole = await Role.findByOrFail('code', 'receptionist')
    const doctorRole = await Role.findByOrFail('code', 'doctor')

    const primaryClinic = await Clinic.updateOrCreate(
      {
        cnpj: '00000000000191',
      },
      {
        name: 'Clínica Horizonte — Demonstração',
        cnpj: '00000000000191',
        phone: '(38) 3000-1000',
        addressStreet: 'Avenida Central',
        addressNumber: '100',
        addressComplement: 'Sala 1',
        addressNeighborhood: 'Centro',
        addressCity: 'Montes Claros',
        addressState: 'MG',
        addressPostalCode: '39400000',
        timezone: DEMO_TIMEZONE,
        isActive: true,
      }
    )

    const secondaryClinic = await Clinic.updateOrCreate(
      {
        cnpj: '00000000000272',
      },
      {
        name: 'Clínica Vale — Demonstração',
        cnpj: '00000000000272',
        phone: '(38) 3000-2000',
        addressStreet: 'Rua das Flores',
        addressNumber: '200',
        addressComplement: 'Sala 2',
        addressNeighborhood: 'Jardim',
        addressCity: 'Montes Claros',
        addressState: 'MG',
        addressPostalCode: '39401000',
        timezone: DEMO_TIMEZONE,
        isActive: true,
      }
    )

    const clinicAdmin = await upsertUser({
      fullName: 'Administrador Demonstrativo',
      email: 'admin.demo@clinica.local',
    })

    const receptionist = await upsertUser({
      fullName: 'Recepcionista Demonstrativa',
      email: 'recepcao.demo@clinica.local',
    })

    const doctor = await upsertUser({
      fullName: 'Dra. Helena Demonstrativa',
      email: 'medico.demo@clinica.local',
    })

    await upsertMembership({
      user: clinicAdmin,
      clinic: primaryClinic,
      role: clinicAdminRole,
    })

    await upsertMembership({
      user: clinicAdmin,
      clinic: secondaryClinic,
      role: clinicAdminRole,
    })

    await upsertMembership({
      user: receptionist,
      clinic: primaryClinic,
      role: receptionistRole,
    })

    await upsertMembership({
      user: doctor,
      clinic: primaryClinic,
      role: doctorRole,
    })

    await upsertMembership({
      user: doctor,
      clinic: secondaryClinic,
      role: doctorRole,
    })

    const patient = await Patient.updateOrCreate(
      {
        cpf: '00000000191',
      },
      {
        fullName: 'Paciente Demonstrativo',
        birthDate: DateTime.fromISO('1990-05-10'),
        cpf: '00000000191',
        phone: '(38) 99999-0000',
        email: 'paciente.demo@example.com',
        addressStreet: 'Rua do Paciente',
        addressNumber: '50',
        addressComplement: null,
        addressNeighborhood: 'Centro',
        addressCity: 'Montes Claros',
        addressState: 'MG',
        addressPostalCode: '39400010',
        isActive: true,
      }
    )

    await MedicalRecord.updateOrCreate(
      {
        patientId: patient.id,
      },
      {
        patientId: patient.id,
      }
    )

    const primaryPatientLink = await PatientClinic.updateOrCreate(
      {
        patientId: patient.id,
        clinicId: primaryClinic.id,
      },
      {
        patientId: patient.id,
        clinicId: primaryClinic.id,
        localRecordNumber: 'DEMO-HORIZONTE-001',
        isActive: true,
      }
    )

    const secondaryPatientLink = await PatientClinic.updateOrCreate(
      {
        patientId: patient.id,
        clinicId: secondaryClinic.id,
      },
      {
        patientId: patient.id,
        clinicId: secondaryClinic.id,
        localRecordNumber: 'DEMO-VALE-001',
        isActive: true,
      }
    )

    const professional = await Professional.updateOrCreate(
      {
        crmState: 'MG',
        crmNumber: 'DEMO0001',
      },
      {
        userId: doctor.id,
        fullName: 'Dra. Helena Demonstrativa',
        crmNumber: 'DEMO0001',
        crmState: 'MG',
        specialty: 'Clínica Médica',
        phone: '(38) 98888-0000',
        email: 'medico.demo@clinica.local',
        isActive: true,
      }
    )

    const primaryProfessionalLink = await ClinicProfessional.updateOrCreate(
      {
        clinicId: primaryClinic.id,
        professionalId: professional.id,
      },
      {
        clinicId: primaryClinic.id,
        professionalId: professional.id,
        localCode: 'MED-DEMO-01',
        defaultAppointmentDurationMinutes: DEMO_APPOINTMENT_DURATION_MINUTES,
        acceptsAppointments: true,
        isActive: true,
      }
    )

    const secondaryProfessionalLink = await ClinicProfessional.updateOrCreate(
      {
        clinicId: secondaryClinic.id,
        professionalId: professional.id,
      },
      {
        clinicId: secondaryClinic.id,
        professionalId: professional.id,
        localCode: 'MED-DEMO-01',
        defaultAppointmentDurationMinutes: DEMO_APPOINTMENT_DURATION_MINUTES,
        acceptsAppointments: true,
        isActive: true,
      }
    )

    await upsertWeekdayAvailabilities(primaryProfessionalLink)
    await upsertWeekdayAvailabilities(secondaryProfessionalLink)

    await upsertAppointment({
      id: DEMO_APPOINTMENT_IDS.primary,
      clinic: primaryClinic,
      patientLink: primaryPatientLink,
      professionalLink: primaryProfessionalLink,
      createdByUser: receptionist,
      hour: 10,
      administrativeNote: 'Agendamento criado pelo cenário demonstrativo.',
    })

    await upsertAppointment({
      id: DEMO_APPOINTMENT_IDS.secondary,
      clinic: secondaryClinic,
      patientLink: secondaryPatientLink,
      professionalLink: secondaryProfessionalLink,
      createdByUser: clinicAdmin,
      hour: 14,
      administrativeNote: 'Agendamento demonstrativo do segundo consultório.',
    })
  }
}
