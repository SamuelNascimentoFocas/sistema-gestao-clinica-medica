import { DateTime } from 'luxon'
import type { Infer } from '@vinejs/vine/types'
import db from '@adonisjs/lucid/services/db'
import Appointment from '#models/appointment'
import DomainError from '#exceptions/domain_error'
import { getPostgreSqlError } from '#services/postgres_error'
import { loadAppointment } from '#services/appointment_query_service'
import {
  loadPatientLink,
  findProfessionalLink,
  loadSchedulableProfessionalLink,
  assertProfessionalScope,
  validateAppointmentSlot,
  FINAL_STATUSES,
  type AppointmentActor,
  type BookingContext,
} from '#services/appointment_policy_service'
import type {
  createAppointmentValidator,
  updateAppointmentValidator,
  rescheduleAppointmentValidator,
} from '#validators/appointment'

export async function createAppointment(
  { clinicId, userId, managementScope, clinicTimezone }: BookingContext,
  payload: Infer<typeof createAppointmentValidator>
) {
  try {
    await loadPatientLink({
      clinicId,
      patientClinicId: payload.patientClinicId,
    })

    const professionalLink = await loadSchedulableProfessionalLink({
      clinicId,
      clinicProfessionalId: payload.clinicProfessionalId,
    })

    assertProfessionalScope({
      managementScope,
      userId,
      professionalLink,
    })

    const durationMinutes =
      payload.durationMinutes ?? professionalLink.defaultAppointmentDurationMinutes

    const endsAt = payload.startsAt.plus({
      minutes: durationMinutes,
    })

    await validateAppointmentSlot({
      clinicId,
      clinicTimezone,
      clinicProfessionalId: professionalLink.id,
      startsAt: payload.startsAt,
      endsAt,
    })

    const appointmentId = await db.transaction(async (trx) => {
      const appointment = new Appointment()
      appointment.useTransaction(trx)

      appointment.merge({
        clinicId,
        patientClinicId: payload.patientClinicId,
        clinicProfessionalId: professionalLink.id,
        startsAt: payload.startsAt,
        endsAt,
        status: 'scheduled',
        version: 1,
        appointmentTypeCode: payload.appointmentTypeCode ?? null,
        administrativeNote: payload.administrativeNote ?? null,
        createdByUserId: userId,
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

      await appointment.save()

      return appointment.id
    })

    const appointment = await loadAppointment({
      clinicId,
      appointmentId,
    })

    return appointment!
  } catch (error) {
    if (getPostgreSqlError(error)?.code === '23P01') {
      throw new DomainError('conflict', 'O horário informado conflita com outro agendamento ativo')
    }
    throw error
  }
}

export async function updateAppointment(
  { clinicId, userId, managementScope }: AppointmentActor,
  targetAppointmentId: string,
  payload: Infer<typeof updateAppointmentValidator>
) {
  const appointmentId = targetAppointmentId
  try {
    await db.transaction(async (trx) => {
      const appointment = await Appointment.query({
        client: trx,
      })
        .where('clinic_id', clinicId)
        .where('id', appointmentId)
        .forUpdate()
        .first()

      if (!appointment) {
        throw new DomainError('not_found', 'Agendamento não encontrado neste consultório')
      }

      if (FINAL_STATUSES.includes(appointment.status)) {
        throw new DomainError(
          'conflict',
          'Não é possível editar um agendamento que já possui status final'
        )
      }

      if (appointment.version !== payload.expectedVersion) {
        throw new DomainError(
          'conflict',
          'O agendamento foi alterado por outro usuário; atualize os dados e tente novamente'
        )
      }

      const currentProfessionalLink = await findProfessionalLink({
        clinicId,
        clinicProfessionalId: appointment.clinicProfessionalId,
      })

      assertProfessionalScope({
        managementScope,
        userId,
        professionalLink: currentProfessionalLink,
      })

      const patientClinicId = payload.patientClinicId ?? appointment.patientClinicId

      if (payload.patientClinicId !== undefined) {
        await loadPatientLink({
          clinicId,
          patientClinicId,
        })
      }

      appointment.useTransaction(trx)

      appointment.merge({
        patientClinicId,
        appointmentTypeCode:
          payload.appointmentTypeCode !== undefined
            ? payload.appointmentTypeCode
            : appointment.appointmentTypeCode,
        administrativeNote:
          payload.administrativeNote !== undefined
            ? payload.administrativeNote
            : appointment.administrativeNote,
        version: appointment.version + 1,
      })

      await appointment.save()
    })

    const appointment = await loadAppointment({
      clinicId,
      appointmentId,
    })

    return appointment!
  } catch (error) {
    if (getPostgreSqlError(error)?.code === '23P01') {
      throw new DomainError('conflict', 'O horário informado conflita com outro agendamento ativo')
    }
    throw error
  }
}

export async function rescheduleAppointment(
  { clinicId, userId, managementScope, clinicTimezone }: BookingContext,
  targetAppointmentId: string,
  payload: Infer<typeof rescheduleAppointmentValidator>
) {
  try {
    const newAppointmentId = await db.transaction(async (trx) => {
      const previousAppointment = await Appointment.query({
        client: trx,
      })
        .where('clinic_id', clinicId)
        .where('id', targetAppointmentId)
        .forUpdate()
        .first()

      if (!previousAppointment) {
        throw new DomainError('not_found', 'Agendamento não encontrado neste consultório')
      }

      if (previousAppointment.version !== payload.expectedVersion) {
        throw new DomainError(
          'conflict',
          'O agendamento foi alterado por outro usuário; atualize os dados e tente novamente'
        )
      }

      if (
        previousAppointment.status !== 'scheduled' &&
        previousAppointment.status !== 'confirmed'
      ) {
        throw new DomainError('conflict', 'Somente agendamentos ativos podem ser reagendados')
      }

      const currentProfessionalLink = await findProfessionalLink({
        clinicId,
        clinicProfessionalId: previousAppointment.clinicProfessionalId,
      })

      assertProfessionalScope({
        managementScope,
        userId,
        professionalLink: currentProfessionalLink,
      })

      await loadPatientLink({
        clinicId,
        patientClinicId: previousAppointment.patientClinicId,
      })

      const clinicProfessionalId =
        payload.clinicProfessionalId ?? previousAppointment.clinicProfessionalId

      const targetProfessionalLink = await loadSchedulableProfessionalLink({
        clinicId,
        clinicProfessionalId,
      })

      assertProfessionalScope({
        managementScope,
        userId,
        professionalLink: targetProfessionalLink,
      })

      const currentDurationMinutes = Math.round(
        previousAppointment.endsAt.diff(previousAppointment.startsAt, 'minutes').minutes
      )

      const durationMinutes = payload.durationMinutes ?? currentDurationMinutes

      const scheduleChanged =
        clinicProfessionalId !== previousAppointment.clinicProfessionalId ||
        payload.startsAt.toMillis() !== previousAppointment.startsAt.toMillis() ||
        durationMinutes !== currentDurationMinutes

      if (!scheduleChanged) {
        throw new DomainError(
          'invalid',
          'Informe um novo horário, duração ou profissional para o reagendamento'
        )
      }

      const endsAt = payload.startsAt.plus({
        minutes: durationMinutes,
      })

      await validateAppointmentSlot({
        clinicId,
        clinicTimezone,
        clinicProfessionalId,
        startsAt: payload.startsAt,
        endsAt,
        excludeAppointmentId: previousAppointment.id,
      })

      previousAppointment.useTransaction(trx)
      previousAppointment.status = 'cancelled'
      previousAppointment.cancelledAt = DateTime.utc()
      previousAppointment.cancelledByUserId = userId
      previousAppointment.cancellationReasonCode = 'rescheduled'
      previousAppointment.cancellationNote = payload.cancellationNote ?? null
      previousAppointment.version += 1

      await previousAppointment.save()

      const nextAppointment = new Appointment()
      nextAppointment.useTransaction(trx)

      nextAppointment.merge({
        clinicId,
        patientClinicId: previousAppointment.patientClinicId,
        clinicProfessionalId,
        startsAt: payload.startsAt,
        endsAt,
        status: 'scheduled',
        version: 1,
        appointmentTypeCode: previousAppointment.appointmentTypeCode,
        administrativeNote: previousAppointment.administrativeNote,
        createdByUserId: userId,
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
        rescheduledFromAppointmentId: previousAppointment.id,
      })

      await nextAppointment.save()

      return nextAppointment.id
    })

    const appointment = await loadAppointment({
      clinicId,
      appointmentId: newAppointmentId,
    })

    return appointment!
  } catch (error) {
    if (getPostgreSqlError(error)?.code === '23P01') {
      throw new DomainError('conflict', 'O horário informado conflita com outro agendamento ativo')
    }
    throw error
  }
}
