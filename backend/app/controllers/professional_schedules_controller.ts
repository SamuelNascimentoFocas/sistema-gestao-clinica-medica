import type { HttpContext } from '@adonisjs/core/http'
import {
  createScheduleBlockValidator,
  createWeeklyAvailabilityValidator,
  updateScheduleBlockValidator,
  updateScheduleItemStatusValidator,
  updateWeeklyAvailabilityValidator,
} from '#validators/professional_schedule'

import {
  loadSchedule,
  findWeeklyAvailability,
  findScheduleBlock,
  createWeeklyAvailability,
  updateWeeklyAvailability,
  setWeeklyAvailabilityStatus,
  createScheduleBlock,
  updateScheduleBlock,
  setScheduleBlockStatus,
} from '#services/professional_schedule_service'
import { respondToDomainError } from '#controllers/helpers/domain_error_response'

export default class ProfessionalSchedulesController {
  async show({ clinicAuthorization, params, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const schedule = await loadSchedule({
      clinicId: clinicAuthorization.clinic.id,
      professionalId: params.professionalId,
    })

    if (!schedule) {
      return response.notFound({
        message: 'Profissional não encontrado neste consultório',
      })
    }

    return response.ok({
      schedule: schedule.serialize(),
    })
  }

  async storeWeeklyAvailability({ scheduleProfessional, request, response }: HttpContext) {
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

  async updateWeeklyAvailability({ scheduleProfessional, params, request, response }: HttpContext) {
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

  async storeScheduleBlock({ scheduleProfessional, request, response }: HttpContext) {
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

  async updateScheduleBlock({ scheduleProfessional, params, request, response }: HttpContext) {
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
