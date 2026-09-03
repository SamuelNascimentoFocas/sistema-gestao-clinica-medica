import { DateTime } from 'luxon'
import Appointment from '#models/appointment'
import PatientClinic from '#models/patient_clinic'
import ClinicProfessional from '#models/clinic_professional'
import ProfessionalScheduleBlock from '#models/professional_schedule_block'
import ProfessionalWeeklyAvailability from '#models/professional_weekly_availability'
import DomainError from '#exceptions/domain_error'

export type AppointmentActor = { clinicId: string; userId: string; managementScope: 'all' | 'own' }
export type BookingContext = AppointmentActor & { clinicTimezone: string }
export const FINAL_STATUSES = ['completed', 'cancelled', 'no_show']

export function hasMutableAppointmentField(payload: {
  patientClinicId?: string
  appointmentTypeCode?: string | null
  administrativeNote?: string | null
}) {
  return (
    payload.patientClinicId !== undefined ||
    payload.appointmentTypeCode !== undefined ||
    payload.administrativeNote !== undefined
  )
}

export async function loadPatientLink({
  clinicId,
  patientClinicId,
}: {
  clinicId: string
  patientClinicId: string
}) {
  const patientLink = await PatientClinic.query()
    .where('clinic_id', clinicId)
    .where('id', patientClinicId)
    .preload('patient')
    .first()

  if (!patientLink) {
    throw new DomainError('not_found', 'Paciente não encontrado neste consultório')
  }

  if (!patientLink.isActive || !patientLink.patient.isActive) {
    throw new DomainError('conflict', 'Não é possível agendar para um paciente com vínculo inativo')
  }

  return patientLink
}

export async function findProfessionalLink({
  clinicId,
  clinicProfessionalId,
}: {
  clinicId: string
  clinicProfessionalId: string
}) {
  const professionalLink = await ClinicProfessional.query()
    .where('clinic_id', clinicId)
    .where('id', clinicProfessionalId)
    .preload('professional')
    .first()

  if (!professionalLink) {
    throw new DomainError('not_found', 'Profissional não encontrado neste consultório')
  }

  return professionalLink
}

export async function loadSchedulableProfessionalLink({
  clinicId,
  clinicProfessionalId,
}: {
  clinicId: string
  clinicProfessionalId: string
}) {
  const professionalLink = await findProfessionalLink({
    clinicId,
    clinicProfessionalId,
  })

  if (!professionalLink.isActive || !professionalLink.professional.isActive) {
    throw new DomainError(
      'conflict',
      'Não é possível agendar para um profissional com vínculo inativo'
    )
  }

  if (!professionalLink.acceptsAppointments) {
    throw new DomainError('conflict', 'Este profissional não está aceitando agendamentos')
  }

  return professionalLink
}

export function assertProfessionalScope({
  managementScope,
  userId,
  professionalLink,
}: {
  managementScope: 'all' | 'own'
  userId: string
  professionalLink: ClinicProfessional
}) {
  if (managementScope === 'all') {
    return
  }

  if (professionalLink.professional.userId !== userId) {
    throw new DomainError('forbidden', 'Você somente pode administrar os próprios agendamentos')
  }
}

export async function validateAppointmentSlot({
  clinicId,
  clinicTimezone,
  clinicProfessionalId,
  startsAt,
  endsAt,
  excludeAppointmentId,
}: {
  clinicId: string
  clinicTimezone: string
  clinicProfessionalId: string
  startsAt: DateTime
  endsAt: DateTime
  excludeAppointmentId?: string
}) {
  if (startsAt.toMillis() >= endsAt.toMillis()) {
    throw new DomainError('invalid', 'O início do agendamento deve ser anterior ao fim')
  }

  if (startsAt.toMillis() <= DateTime.utc().toMillis()) {
    throw new DomainError('invalid', 'O agendamento deve começar em uma data futura')
  }

  const durationMinutes = endsAt.diff(startsAt, 'minutes').minutes

  if (durationMinutes < 5 || durationMinutes > 480) {
    throw new DomainError('invalid', 'A duração do agendamento deve estar entre 5 e 480 minutos')
  }

  const localStartsAt = startsAt.setZone(clinicTimezone)
  const localEndsAt = endsAt.setZone(clinicTimezone)

  if (!localStartsAt.isValid || !localEndsAt.isValid) {
    throw new DomainError('invalid', 'Data ou horário inválido')
  }

  if (localStartsAt.toISODate() !== localEndsAt.toISODate()) {
    throw new DomainError('invalid', 'O agendamento deve começar e terminar no mesmo dia local')
  }

  const localStartTime = localStartsAt.toFormat('HH:mm:ss')
  const localEndTime = localEndsAt.toFormat('HH:mm:ss')

  const weeklyAvailability = await ProfessionalWeeklyAvailability.query()
    .where('clinic_professional_id', clinicProfessionalId)
    .where('weekday', localStartsAt.weekday)
    .where('is_active', true)
    .where('start_time', '<=', localStartTime)
    .where('end_time', '>=', localEndTime)
    .first()

  if (!weeklyAvailability) {
    throw new DomainError(
      'conflict',
      'O horário informado está fora da disponibilidade semanal do profissional'
    )
  }

  const scheduleBlock = await ProfessionalScheduleBlock.query()
    .where('clinic_professional_id', clinicProfessionalId)
    .where('is_active', true)
    .where('starts_at', '<', endsAt.toSQL()!)
    .where('ends_at', '>', startsAt.toSQL()!)
    .first()

  if (scheduleBlock) {
    throw new DomainError('conflict', 'O horário informado conflita com um bloqueio da agenda')
  }

  const overlapQuery = Appointment.query()
    .where('clinic_id', clinicId)
    .where('clinic_professional_id', clinicProfessionalId)
    .whereIn('status', ['scheduled', 'confirmed'])
    .where('starts_at', '<', endsAt.toSQL()!)
    .where('ends_at', '>', startsAt.toSQL()!)

  if (excludeAppointmentId) {
    overlapQuery.whereNot('id', excludeAppointmentId)
  }

  const overlappingAppointment = await overlapQuery.first()

  if (overlappingAppointment) {
    throw new DomainError('conflict', 'O horário informado conflita com outro agendamento ativo')
  }
}
