import { DateTime } from 'luxon'
import type { Infer } from '@vinejs/vine/types'
import db from '@adonisjs/lucid/services/db'
import Appointment from '#models/appointment'
import DomainError from '#exceptions/domain_error'
import { loadAppointment } from '#services/appointment_query_service'
import {
  findProfessionalLink,
  assertProfessionalScope,
  type AppointmentActor,
} from '#services/appointment_policy_service'
import type {
  appointmentVersionValidator,
  cancelAppointmentValidator,
} from '#validators/appointment'

export async function confirmAppointment(
  { clinicId, userId, managementScope }: AppointmentActor,
  targetAppointmentId: string,
  payload: Infer<typeof appointmentVersionValidator>
) {
  const { expectedVersion } = payload
  const appointmentId = await db.transaction(async (trx) => {
    const appointment = await Appointment.query({ client: trx })
      .where('clinic_id', clinicId)
      .where('id', targetAppointmentId)
      .forUpdate()
      .first()

    if (!appointment) {
      throw new DomainError('not_found', 'Agendamento não encontrado neste consultório')
    }

    const professionalLink = await findProfessionalLink({
      clinicId,
      clinicProfessionalId: appointment.clinicProfessionalId,
    })

    assertProfessionalScope({
      managementScope,
      userId,
      professionalLink,
    })

    if (appointment.status === 'confirmed') {
      return appointment.id
    }

    if (appointment.version !== expectedVersion) {
      throw new DomainError(
        'conflict',
        'O agendamento foi alterado por outro usuário; atualize os dados e tente novamente'
      )
    }

    if (appointment.status !== 'scheduled') {
      throw new DomainError('conflict', 'Somente um agendamento marcado pode ser confirmado')
    }

    appointment.useTransaction(trx)
    appointment.status = 'confirmed'
    appointment.confirmedAt = DateTime.utc()
    appointment.confirmedByUserId = userId
    appointment.version += 1

    await appointment.save()

    return appointment.id
  })

  const appointment = await loadAppointment({
    clinicId,
    appointmentId,
  })

  return appointment!
}

export async function cancelAppointment(
  { clinicId, userId, managementScope }: AppointmentActor,
  targetAppointmentId: string,
  payload: Infer<typeof cancelAppointmentValidator>
) {
  const appointmentId = await db.transaction(async (trx) => {
    const appointment = await Appointment.query({ client: trx })
      .where('clinic_id', clinicId)
      .where('id', targetAppointmentId)
      .forUpdate()
      .first()

    if (!appointment) {
      throw new DomainError('not_found', 'Agendamento não encontrado neste consultório')
    }

    const professionalLink = await findProfessionalLink({
      clinicId,
      clinicProfessionalId: appointment.clinicProfessionalId,
    })

    assertProfessionalScope({
      managementScope,
      userId,
      professionalLink,
    })

    if (appointment.version !== payload.expectedVersion) {
      throw new DomainError(
        'conflict',
        'O agendamento foi alterado por outro usuário; atualize os dados e tente novamente'
      )
    }

    if (appointment.status !== 'scheduled' && appointment.status !== 'confirmed') {
      throw new DomainError('conflict', 'Somente agendamentos ativos podem ser cancelados')
    }

    appointment.useTransaction(trx)
    appointment.status = 'cancelled'
    appointment.cancelledAt = DateTime.utc()
    appointment.cancelledByUserId = userId
    appointment.cancellationReasonCode = payload.cancellationReasonCode
    appointment.cancellationNote = payload.cancellationNote ?? null
    appointment.version += 1

    await appointment.save()

    return appointment.id
  })

  const appointment = await loadAppointment({
    clinicId,
    appointmentId,
  })

  return appointment!
}

export async function completeAppointment(
  { clinicId, userId, managementScope }: AppointmentActor,
  targetAppointmentId: string,
  payload: Infer<typeof appointmentVersionValidator>
) {
  const { expectedVersion } = payload
  const appointmentId = await db.transaction(async (trx) => {
    const appointment = await Appointment.query({ client: trx })
      .where('clinic_id', clinicId)
      .where('id', targetAppointmentId)
      .forUpdate()
      .first()

    if (!appointment) {
      throw new DomainError('not_found', 'Agendamento não encontrado neste consultório')
    }

    const professionalLink = await findProfessionalLink({
      clinicId,
      clinicProfessionalId: appointment.clinicProfessionalId,
    })

    assertProfessionalScope({
      managementScope,
      userId,
      professionalLink,
    })

    if (appointment.version !== expectedVersion) {
      throw new DomainError(
        'conflict',
        'O agendamento foi alterado por outro usuário; atualize os dados e tente novamente'
      )
    }

    if (appointment.status !== 'scheduled' && appointment.status !== 'confirmed') {
      throw new DomainError(
        'conflict',
        'Somente agendamentos ativos podem ser marcados como realizados'
      )
    }

    if (DateTime.utc().toMillis() < appointment.startsAt.toMillis()) {
      throw new DomainError(
        'conflict',
        'O agendamento não pode ser marcado como realizado antes do horário de início'
      )
    }

    appointment.useTransaction(trx)
    appointment.status = 'completed'
    appointment.completedAt = DateTime.utc()
    appointment.completedByUserId = userId
    appointment.version += 1

    await appointment.save()

    return appointment.id
  })

  const appointment = await loadAppointment({
    clinicId,
    appointmentId,
  })

  return appointment!
}

export async function markAppointmentNoShow(
  { clinicId, userId, managementScope }: AppointmentActor,
  targetAppointmentId: string,
  payload: Infer<typeof appointmentVersionValidator>
) {
  const { expectedVersion } = payload
  const appointmentId = await db.transaction(async (trx) => {
    const appointment = await Appointment.query({ client: trx })
      .where('clinic_id', clinicId)
      .where('id', targetAppointmentId)
      .forUpdate()
      .first()

    if (!appointment) {
      throw new DomainError('not_found', 'Agendamento não encontrado neste consultório')
    }

    const professionalLink = await findProfessionalLink({
      clinicId,
      clinicProfessionalId: appointment.clinicProfessionalId,
    })

    assertProfessionalScope({
      managementScope,
      userId,
      professionalLink,
    })

    if (appointment.version !== expectedVersion) {
      throw new DomainError(
        'conflict',
        'O agendamento foi alterado por outro usuário; atualize os dados e tente novamente'
      )
    }

    if (appointment.status !== 'scheduled' && appointment.status !== 'confirmed') {
      throw new DomainError('conflict', 'Somente agendamentos ativos podem ser marcados como falta')
    }

    const noShowAllowedAt = appointment.startsAt.plus({
      minutes: 15,
    })

    if (DateTime.utc().toMillis() < noShowAllowedAt.toMillis()) {
      throw new DomainError(
        'conflict',
        'A falta somente pode ser registrada após 15 minutos do horário inicial'
      )
    }

    appointment.useTransaction(trx)
    appointment.status = 'no_show'
    appointment.noShowAt = DateTime.utc()
    appointment.noShowByUserId = userId
    appointment.version += 1

    await appointment.save()

    return appointment.id
  })

  const appointment = await loadAppointment({
    clinicId,
    appointmentId,
  })

  return appointment!
}
