import factory from '@adonisjs/lucid/factories'
import Appointment from '#models/appointment'

// Contexto, autor, início e fim ficam explícitos; não gerar horários aleatórios.
// Transições exigem metadados coerentes, fornecidos pelo próprio teste.
export const AppointmentFactory = factory
  .define(Appointment, () => ({
    status: 'scheduled' as const,
    version: 1,
    appointmentTypeCode: null,
    administrativeNote: null,
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
  }))
  .build()
