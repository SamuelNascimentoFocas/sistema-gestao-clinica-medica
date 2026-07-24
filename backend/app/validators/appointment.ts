import { DateTime } from 'luxon'
import vine from '@vinejs/vine'

export const listAppointmentsValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).withoutDecimals().optional(),

    perPage: vine.number().min(1).max(100).withoutDecimals().optional(),

    status: vine.enum(['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']).optional(),

    patientClinicId: vine.string().uuid().optional(),

    clinicProfessionalId: vine.string().uuid().optional(),

    from: vine
      .date({
        formats: ['iso8601'],
      })
      .transform((value) => DateTime.fromJSDate(value).toUTC()),

    to: vine
      .date({
        formats: ['iso8601'],
      })
      .transform((value) => DateTime.fromJSDate(value).toUTC()),
  })
)

export const createAppointmentValidator = vine.compile(
  vine.object({
    patientClinicId: vine.string().uuid(),

    clinicProfessionalId: vine.string().uuid(),

    startsAt: vine
      .date({
        formats: ['iso8601'],
      })
      .transform((value) => DateTime.fromJSDate(value).toUTC()),

    durationMinutes: vine.number({ strict: true }).withoutDecimals().min(5).max(480).optional(),

    appointmentTypeCode: vine.string().trim().minLength(1).maxLength(60).nullable().optional(),

    administrativeNote: vine.string().trim().minLength(1).maxLength(500).nullable().optional(),
  })
)

export const updateAppointmentValidator = vine.compile(
  vine.object({
    patientClinicId: vine.string().uuid().optional(),

    appointmentTypeCode: vine.string().trim().minLength(1).maxLength(60).nullable().optional(),

    administrativeNote: vine.string().trim().minLength(1).maxLength(500).nullable().optional(),

    expectedVersion: vine.number({ strict: true }).withoutDecimals().min(1),
  })
)

export const appointmentVersionValidator = vine.compile(
  vine.object({
    expectedVersion: vine.number({ strict: true }).withoutDecimals().min(1),
  })
)

export const cancelAppointmentValidator = vine.compile(
  vine.object({
    expectedVersion: vine.number({ strict: true }).withoutDecimals().min(1),

    cancellationReasonCode: vine.enum([
      'patient_request',
      'professional_unavailable',
      'clinic_request',
      'duplicate',
      'created_by_mistake',
      'other',
    ]),

    cancellationNote: vine.string().trim().minLength(1).maxLength(500).nullable().optional(),
  })
)

export const rescheduleAppointmentValidator = vine.compile(
  vine.object({
    expectedVersion: vine.number({ strict: true }).withoutDecimals().min(1),

    clinicProfessionalId: vine.string().uuid().optional(),

    startsAt: vine
      .date({
        formats: ['iso8601'],
      })
      .transform((value) => DateTime.fromJSDate(value).toUTC()),

    durationMinutes: vine.number({ strict: true }).withoutDecimals().min(5).max(480).optional(),

    cancellationNote: vine.string().trim().minLength(1).maxLength(500).nullable().optional(),
  })
)
