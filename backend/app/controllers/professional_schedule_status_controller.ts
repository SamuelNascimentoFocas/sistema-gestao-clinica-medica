import type { HttpContext } from '@adonisjs/core/http'
import { updateScheduleItemStatusValidator } from '#validators/professional_schedule'
import {
  findWeeklyAvailability,
  findScheduleBlock,
  setWeeklyAvailabilityStatus,
  setScheduleBlockStatus,
} from '#services/professional_schedule_service'
import { respondToDomainError } from '#controllers/helpers/domain_error_response'

export default class ProfessionalScheduleStatusController {
  async updateWeeklyAvailabilityStatus({
    scheduleProfessional,
    params,
    request,
    response,
  }: HttpContext) {
    if (!scheduleProfessional) {
      return response.internalServerError({
        message: 'Contexto da agenda não inicializado',
      })
    }

    const availability = await findWeeklyAvailability(
      scheduleProfessional.id,
      params.availabilityId
    )

    if (!availability) {
      return response.notFound({
        message: 'Horário semanal não encontrado',
      })
    }

    const { isActive } = await request.validateUsing(updateScheduleItemStatusValidator)

    try {
      const updatedItem = await setWeeklyAvailabilityStatus(
        scheduleProfessional.id,
        availability,
        isActive
      )

      return response.ok({
        availability: updatedItem.serialize(),
      })
    } catch (error) {
      return respondToDomainError(error, response)
    }
  }

  async updateScheduleBlockStatus({
    scheduleProfessional,
    params,
    request,
    response,
  }: HttpContext) {
    if (!scheduleProfessional) {
      return response.internalServerError({
        message: 'Contexto da agenda não inicializado',
      })
    }

    const scheduleBlock = await findScheduleBlock(scheduleProfessional.id, params.blockId)

    if (!scheduleBlock) {
      return response.notFound({
        message: 'Bloqueio de agenda não encontrado',
      })
    }

    const { isActive } = await request.validateUsing(updateScheduleItemStatusValidator)

    try {
      const updatedItem = await setScheduleBlockStatus(
        scheduleProfessional.id,
        scheduleBlock,
        isActive
      )

      return response.ok({
        scheduleBlock: updatedItem.serialize(),
      })
    } catch (error) {
      return respondToDomainError(error, response)
    }
  }
}
