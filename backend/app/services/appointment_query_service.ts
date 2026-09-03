import type { Infer } from '@vinejs/vine/types'
import Appointment from '#models/appointment'
import DomainError from '#exceptions/domain_error'
import type { listAppointmentsValidator } from '#validators/appointment'

export async function loadAppointment({
  clinicId,
  appointmentId,
}: {
  clinicId: string
  appointmentId: string
}) {
  return Appointment.query()
    .where('clinic_id', clinicId)
    .where('id', appointmentId)
    .preload('clinic')
    .preload('patientClinic', (patientLinkQuery) => {
      patientLinkQuery.preload('patient')
    })
    .preload('clinicProfessional', (professionalLinkQuery) => {
      professionalLinkQuery.preload('professional')
    })
    .preload('createdByUser')
    .preload('confirmedByUser')
    .preload('completedByUser')
    .preload('cancelledByUser')
    .preload('noShowByUser')
    .preload('rescheduledFrom')
    .preload('rescheduledTo')
    .first()
}

export async function listAppointments(
  clinicId: string,
  filters: Infer<typeof listAppointmentsValidator>
) {
  if (filters.from.toMillis() >= filters.to.toMillis()) {
    throw new DomainError('invalid', 'A data inicial do filtro deve ser anterior à data final')
  }

  const intervalInDays = filters.to.diff(filters.from, 'days').days

  if (intervalInDays > 31) {
    throw new DomainError('invalid', 'O intervalo da agenda não pode ultrapassar 31 dias')
  }

  const page = filters.page ?? 1
  const perPage = filters.perPage ?? 20

  const query = Appointment.query()
    .where('clinic_id', clinicId)
    .preload('patientClinic', (patientLinkQuery) => {
      patientLinkQuery.preload('patient')
    })
    .preload('clinicProfessional', (professionalLinkQuery) => {
      professionalLinkQuery.preload('professional')
    })
    .preload('createdByUser')
    .orderBy('starts_at', 'asc')

  if (filters.status) {
    query.where('status', filters.status)
  }

  if (filters.patientClinicId) {
    query.where('patient_clinic_id', filters.patientClinicId)
  }

  if (filters.clinicProfessionalId) {
    query.where('clinic_professional_id', filters.clinicProfessionalId)
  }

  query.where('starts_at', '<', filters.to.toSQL()!).where('ends_at', '>', filters.from.toSQL()!)

  const appointments = await query.paginate(page, perPage)

  return appointments
}
