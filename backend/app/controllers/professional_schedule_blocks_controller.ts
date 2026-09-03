import type { HttpContext } from '@adonisjs/core/http'
import {
  createScheduleBlockValidator,
  updateScheduleBlockValidator,
} from '#validators/professional_schedule'
import { createScheduleBlock, updateScheduleBlock } from '#services/professional_schedule_service'
import { respondToDomainError } from '#controllers/helpers/domain_error_response'

export default class ProfessionalScheduleBlocksController {
  async store({ scheduleProfessional, request, response }: HttpContext) {
    if (!scheduleProfessional) {
      return response.internalServerError({
        message: 'Contexto da agenda não inicializado',
      })
    }

    const payload = await request.validateUsing(createScheduleBlockValidator)

    try {
      const scheduleBlock = await createScheduleBlock(scheduleProfessional.id, payload)

      return response.created({
        scheduleBlock: scheduleBlock.serialize(),
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

    const payload = await request.validateUsing(updateScheduleBlockValidator)

    if (Object.keys(payload).length === 0) {
      return response.badRequest({
        message: 'Informe pelo menos um campo para atualização',
      })
    }

    try {
      const scheduleBlock = await updateScheduleBlock(
        scheduleProfessional.id,
        params.blockId,
        payload
      )

      return response.ok({
        scheduleBlock: scheduleBlock.serialize(),
      })
    } catch (error) {
      return respondToDomainError(error, response)
    }
  }
}
