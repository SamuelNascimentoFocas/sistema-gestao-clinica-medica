import type { HttpContext } from '@adonisjs/core/http'
import {
  createWeeklyAvailabilityValidator,
  updateWeeklyAvailabilityValidator,
} from '#validators/professional_schedule'
import {
  createWeeklyAvailability,
  updateWeeklyAvailability,
} from '#services/professional_schedule_service'
import { respondToDomainError } from '#controllers/helpers/domain_error_response'

export default class ProfessionalWeeklyAvailabilitiesController {
  async store({ scheduleProfessional, request, response }: HttpContext) {
    if (!scheduleProfessional) {
      return response.internalServerError({
        message: 'Contexto da agenda não inicializado',
      })
    }

    const payload = await request.validateUsing(createWeeklyAvailabilityValidator)

    try {
      const availability = await createWeeklyAvailability(scheduleProfessional.id, payload)

      return response.created({
        availability: availability.serialize(),
      })
    } catch (error) {
      return respondToDomainError(error, response)
    }
  }

  async update({ scheduleProfessional, params, request, response }: HttpContext) {
    if (!scheduleProfessional) {
      return response.internalServerError({
        message: 'Contexto da agenda não inicializado',
      })
    }

    const payload = await request.validateUsing(updateWeeklyAvailabilityValidator)

    if (Object.keys(payload).length === 0) {
      return response.badRequest({
        message: 'Informe pelo menos um campo para atualização',
      })
    }

    try {
      const availability = await updateWeeklyAvailability(
        scheduleProfessional.id,
        params.availabilityId,
        payload
      )

      return response.ok({
        availability: availability.serialize(),
      })
    } catch (error) {
      return respondToDomainError(error, response)
    }
  }
}
