import type { HttpContext } from '@adonisjs/core/http'
import {
  appointmentVersionValidator,
  cancelAppointmentValidator,
  createAppointmentValidator,
  listAppointmentsValidator,
  rescheduleAppointmentValidator,
  updateAppointmentValidator,
} from '#validators/appointment'

import { loadAppointment, listAppointments } from '#services/appointment_query_service'
import { hasMutableAppointmentField } from '#services/appointment_policy_service'
import {
  createAppointment,
  updateAppointment,
  rescheduleAppointment,
} from '#services/appointment_booking_service'
import {
  confirmAppointment,
  cancelAppointment,
  completeAppointment,
  markAppointmentNoShow,
} from '#services/appointment_status_service'
import { respondToDomainError } from '#controllers/helpers/domain_error_response'

export default class AppointmentsController {
  async index({ clinicAuthorization, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const filters = await listAppointmentsValidator.validate(request.qs())

    try {
      const appointments = await listAppointments(clinicAuthorization.clinic.id, filters)

      return response.ok({
        data: appointments.all().map((appointment) => appointment.serialize()),
        meta: appointments.getMeta(),
      })
    } catch (error) {
      return respondToDomainError(error, response)
    }
  }

  async show({ clinicAuthorization, params, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const appointment = await loadAppointment({
      clinicId: clinicAuthorization.clinic.id,
      appointmentId: params.appointmentId,
    })

    if (!appointment) {
      return response.notFound({
        message: 'Agendamento não encontrado neste consultório',
      })
    }

    return response.ok({
      appointment: appointment.serialize(),
    })
  }

  async store({
    auth,
    clinicAuthorization,
    appointmentManagementScope,
    request,
    response,
  }: HttpContext) {
    if (!clinicAuthorization || !appointmentManagementScope) {
      return response.internalServerError({
        message: 'Contexto de autorização de agendamento não inicializado',
      })
    }

    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(createAppointmentValidator)
    const clinicId = clinicAuthorization.clinic.id

    try {
      const appointment = await createAppointment(
        {
          clinicId,
          userId: user.id,
          managementScope: appointmentManagementScope,
          clinicTimezone: clinicAuthorization.clinic.timezone,
        },
        payload
      )

      return response.created({
        appointment: appointment!.serialize(),
      })
    } catch (error) {
      return respondToDomainError(error, response)
    }
  }

  async update({
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

    const payload = await request.validateUsing(updateAppointmentValidator)

    if (!hasMutableAppointmentField(payload)) {
      return response.badRequest({
        message: 'Informe pelo menos um campo para atualização',
      })
    }

    const user = auth.getUserOrFail()
    const clinicId = clinicAuthorization.clinic.id
    const appointmentId = params.appointmentId

    try {
      const appointment = await updateAppointment(
        { clinicId, userId: user.id, managementScope: appointmentManagementScope },
        appointmentId,
        payload
      )

      return response.ok({
        appointment: appointment!.serialize(),
      })
    } catch (error) {
      return respondToDomainError(error, response)
    }
  }

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

  async reschedule({
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
    const payload = await request.validateUsing(rescheduleAppointmentValidator)
    const clinicId = clinicAuthorization.clinic.id

    try {
      const appointment = await rescheduleAppointment(
        {
          clinicId,
          userId: user.id,
          managementScope: appointmentManagementScope,
          clinicTimezone: clinicAuthorization.clinic.timezone,
        },
        params.appointmentId,
        payload
      )

      return response.created({
        appointment: appointment!.serialize(),
      })
    } catch (error) {
      return respondToDomainError(error, response)
    }
  }
}
