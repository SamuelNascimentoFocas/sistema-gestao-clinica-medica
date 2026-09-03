import type { HttpContext } from '@adonisjs/core/http'
import { appointmentVersionValidator, cancelAppointmentValidator } from '#validators/appointment'
import {
  confirmAppointment,
  cancelAppointment,
  completeAppointment,
  markAppointmentNoShow,
} from '#services/appointment_status_service'
import { respondToDomainError } from '#controllers/helpers/domain_error_response'

export default class AppointmentStatusController {
  async confirm({
    auth,
    clinicAuthorization,
    appointmentManagementScope,
    params,
    request,
    response,
  }: HttpContext) {
    if (!clinicAuthorization || !appointmentManagementScope) {
      return response.internalServerError({
        message: 'Contexto de autorização de agendamento não inicializado',
      })
    }

    const user = auth.getUserOrFail()
    const { expectedVersion } = await request.validateUsing(appointmentVersionValidator)
    const clinicId = clinicAuthorization.clinic.id

    try {
      const appointment = await confirmAppointment(
        { clinicId, userId: user.id, managementScope: appointmentManagementScope },
        params.appointmentId,
        { expectedVersion }
      )

      return response.ok({
        appointment: appointment!.serialize(),
      })
    } catch (error) {
      return respondToDomainError(error, response)
    }
  }

  async cancel({
    auth,
    clinicAuthorization,
    appointmentManagementScope,
    params,
    request,
    response,
  }: HttpContext) {
    if (!clinicAuthorization || !appointmentManagementScope) {
      return response.internalServerError({
        message: 'Contexto de autorização de agendamento não inicializado',
      })
    }

    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(cancelAppointmentValidator)
    const clinicId = clinicAuthorization.clinic.id

    try {
      const appointment = await cancelAppointment(
        { clinicId, userId: user.id, managementScope: appointmentManagementScope },
        params.appointmentId,
        payload
      )

      return response.ok({
        appointment: appointment!.serialize(),
      })
    } catch (error) {
      return respondToDomainError(error, response)
    }
  }

  async complete({
    auth,
    clinicAuthorization,
    appointmentManagementScope,
    params,
    request,
    response,
  }: HttpContext) {
    if (!clinicAuthorization || !appointmentManagementScope) {
      return response.internalServerError({
        message: 'Contexto de autorização de agendamento não inicializado',
      })
    }

    const user = auth.getUserOrFail()
    const { expectedVersion } = await request.validateUsing(appointmentVersionValidator)
    const clinicId = clinicAuthorization.clinic.id

    try {
      const appointment = await completeAppointment(
        { clinicId, userId: user.id, managementScope: appointmentManagementScope },
        params.appointmentId,
        { expectedVersion }
      )

      return response.ok({
        appointment: appointment!.serialize(),
      })
    } catch (error) {
      return respondToDomainError(error, response)
    }
  }

  async markNoShow({
    auth,
    clinicAuthorization,
    appointmentManagementScope,
    params,
    request,
    response,
  }: HttpContext) {
    if (!clinicAuthorization || !appointmentManagementScope) {
      return response.internalServerError({
        message: 'Contexto de autorização de agendamento não inicializado',
      })
    }

    const user = auth.getUserOrFail()
    const { expectedVersion } = await request.validateUsing(appointmentVersionValidator)
    const clinicId = clinicAuthorization.clinic.id

    try {
      const appointment = await markAppointmentNoShow(
        { clinicId, userId: user.id, managementScope: appointmentManagementScope },
        params.appointmentId,
        { expectedVersion }
      )

      return response.ok({
        appointment: appointment!.serialize(),
      })
    } catch (error) {
      return respondToDomainError(error, response)
    }
  }
}
