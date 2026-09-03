import type { HttpContext } from '@adonisjs/core/http'
import { rescheduleAppointmentValidator } from '#validators/appointment'
import { rescheduleAppointment } from '#services/appointment_booking_service'
import { respondToDomainError } from '#controllers/helpers/domain_error_response'

export default class AppointmentReschedulingController {
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
