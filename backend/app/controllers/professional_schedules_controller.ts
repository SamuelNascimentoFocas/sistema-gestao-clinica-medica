import type { HttpContext } from '@adonisjs/core/http'
import type { DateTime } from 'luxon'
import ClinicProfessional from '#models/clinic_professional'
import ProfessionalScheduleBlock from '#models/professional_schedule_block'
import ProfessionalWeeklyAvailability from '#models/professional_weekly_availability'
import {
  createScheduleBlockValidator,
  createWeeklyAvailabilityValidator,
  updateScheduleBlockValidator,
  updateScheduleItemStatusValidator,
  updateWeeklyAvailabilityValidator,
} from '#validators/professional_schedule'

async function loadSchedule({
  clinicId,
  professionalId,
}: {
  clinicId: string
  professionalId: string
}) {
  return ClinicProfessional.query()
    .where('clinic_id', clinicId)
    .where('professional_id', professionalId)
    .preload('clinic')
    .preload('professional')
    .preload('weeklyAvailabilities', (query) => {
      query.orderBy('weekday', 'asc').orderBy('start_time', 'asc')
    })
    .preload('scheduleBlocks', (query) => {
      query.orderBy('starts_at', 'asc')
    })
    .first()
}

async function findAvailabilityOverlap({
  clinicProfessionalId,
  weekday,
  startTime,
  endTime,
  excludeId,
}: {
  clinicProfessionalId: string
  weekday: number
  startTime: string
  endTime: string
  excludeId?: string
}) {
  const query = ProfessionalWeeklyAvailability.query()
    .where('clinic_professional_id', clinicProfessionalId)
    .where('weekday', weekday)
    .where('is_active', true)
    .where('start_time', '<', endTime)
    .where('end_time', '>', startTime)

  if (excludeId) {
    query.whereNot('id', excludeId)
  }

  return query.first()
}

async function findBlockOverlap({
  clinicProfessionalId,
  startsAt,
  endsAt,
  excludeId,
}: {
  clinicProfessionalId: string
  startsAt: DateTime
  endsAt: DateTime
  excludeId?: string
}) {
  const query = ProfessionalScheduleBlock.query()
    .where('clinic_professional_id', clinicProfessionalId)
    .where('is_active', true)
    .where('starts_at', '<', endsAt.toSQL()!)
    .where('ends_at', '>', startsAt.toSQL()!)

  if (excludeId) {
    query.whereNot('id', excludeId)
  }

  return query.first()
}

function hasValidTimeOrder(startTime: string, endTime: string) {
  return startTime < endTime
}

function hasValidDateOrder(startsAt: DateTime, endsAt: DateTime) {
  return startsAt.toMillis() < endsAt.toMillis()
}

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

    if (!hasValidTimeOrder(payload.startTime, payload.endTime)) {
      return response.unprocessableEntity({
        message: 'O horário inicial deve ser anterior ao horário final',
      })
    }

    const overlap = await findAvailabilityOverlap({
      clinicProfessionalId: scheduleProfessional.id,
      weekday: payload.weekday,
      startTime: payload.startTime,
      endTime: payload.endTime,
    })

    if (overlap) {
      return response.conflict({
        message: 'O período informado conflita com outro horário ativo',
      })
    }

    const availability = await ProfessionalWeeklyAvailability.create({
      clinicProfessionalId: scheduleProfessional.id,
      weekday: payload.weekday,
      startTime: payload.startTime,
      endTime: payload.endTime,
      isActive: true,
    })

    return response.created({
      availability: availability.serialize(),
    })
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

    const availability = await ProfessionalWeeklyAvailability.query()
      .where('id', params.availabilityId)
      .where('clinic_professional_id', scheduleProfessional.id)
      .first()

    if (!availability) {
      return response.notFound({
        message: 'Horário semanal não encontrado',
      })
    }

    const weekday = payload.weekday ?? availability.weekday
    const startTime = payload.startTime ?? availability.startTime
    const endTime = payload.endTime ?? availability.endTime

    if (!hasValidTimeOrder(startTime, endTime)) {
      return response.unprocessableEntity({
        message: 'O horário inicial deve ser anterior ao horário final',
      })
    }

    if (availability.isActive) {
      const overlap = await findAvailabilityOverlap({
        clinicProfessionalId: scheduleProfessional.id,
        weekday,
        startTime,
        endTime,
        excludeId: availability.id,
      })

      if (overlap) {
        return response.conflict({
          message: 'O período informado conflita com outro horário ativo',
        })
      }
    }

    availability.merge({
      weekday,
      startTime,
      endTime,
    })

    await availability.save()

    return response.ok({
      availability: availability.serialize(),
    })
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

    const availability = await ProfessionalWeeklyAvailability.query()
      .where('id', params.availabilityId)
      .where('clinic_professional_id', scheduleProfessional.id)
      .first()

    if (!availability) {
      return response.notFound({
        message: 'Horário semanal não encontrado',
      })
    }

    const { isActive } = await request.validateUsing(updateScheduleItemStatusValidator)

    if (isActive) {
      const overlap = await findAvailabilityOverlap({
        clinicProfessionalId: scheduleProfessional.id,
        weekday: availability.weekday,
        startTime: availability.startTime,
        endTime: availability.endTime,
        excludeId: availability.id,
      })

      if (overlap) {
        return response.conflict({
          message: 'O período informado conflita com outro horário ativo',
        })
      }
    }

    availability.isActive = isActive
    await availability.save()

    return response.ok({
      availability: availability.serialize(),
    })
  }

  async storeScheduleBlock({ scheduleProfessional, request, response }: HttpContext) {
    if (!scheduleProfessional) {
      return response.internalServerError({
        message: 'Contexto da agenda não inicializado',
      })
    }

    const payload = await request.validateUsing(createScheduleBlockValidator)

    if (!hasValidDateOrder(payload.startsAt, payload.endsAt)) {
      return response.unprocessableEntity({
        message: 'O início do bloqueio deve ser anterior ao fim',
      })
    }

    const overlap = await findBlockOverlap({
      clinicProfessionalId: scheduleProfessional.id,
      startsAt: payload.startsAt,
      endsAt: payload.endsAt,
    })

    if (overlap) {
      return response.conflict({
        message: 'O período informado conflita com outro bloqueio ativo',
      })
    }

    const scheduleBlock = await ProfessionalScheduleBlock.create({
      clinicProfessionalId: scheduleProfessional.id,
      startsAt: payload.startsAt,
      endsAt: payload.endsAt,
      reason: payload.reason ?? null,
      isActive: true,
    })

    return response.created({
      scheduleBlock: scheduleBlock.serialize(),
    })
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

    const scheduleBlock = await ProfessionalScheduleBlock.query()
      .where('id', params.blockId)
      .where('clinic_professional_id', scheduleProfessional.id)
      .first()

    if (!scheduleBlock) {
      return response.notFound({
        message: 'Bloqueio de agenda não encontrado',
      })
    }

    const startsAt = payload.startsAt ?? scheduleBlock.startsAt
    const endsAt = payload.endsAt ?? scheduleBlock.endsAt

    if (!hasValidDateOrder(startsAt, endsAt)) {
      return response.unprocessableEntity({
        message: 'O início do bloqueio deve ser anterior ao fim',
      })
    }

    if (scheduleBlock.isActive) {
      const overlap = await findBlockOverlap({
        clinicProfessionalId: scheduleProfessional.id,
        startsAt,
        endsAt,
        excludeId: scheduleBlock.id,
      })

      if (overlap) {
        return response.conflict({
          message: 'O período informado conflita com outro bloqueio ativo',
        })
      }
    }

    scheduleBlock.merge({
      startsAt,
      endsAt,
      reason: payload.reason !== undefined ? payload.reason : scheduleBlock.reason,
    })

    await scheduleBlock.save()

    return response.ok({
      scheduleBlock: scheduleBlock.serialize(),
    })
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

    const scheduleBlock = await ProfessionalScheduleBlock.query()
      .where('id', params.blockId)
      .where('clinic_professional_id', scheduleProfessional.id)
      .first()

    if (!scheduleBlock) {
      return response.notFound({
        message: 'Bloqueio de agenda não encontrado',
      })
    }

    const { isActive } = await request.validateUsing(updateScheduleItemStatusValidator)

    if (isActive) {
      const overlap = await findBlockOverlap({
        clinicProfessionalId: scheduleProfessional.id,
        startsAt: scheduleBlock.startsAt,
        endsAt: scheduleBlock.endsAt,
        excludeId: scheduleBlock.id,
      })

      if (overlap) {
        return response.conflict({
          message: 'O período informado conflita com outro bloqueio ativo',
        })
      }
    }

    scheduleBlock.isActive = isActive
    await scheduleBlock.save()

    return response.ok({
      scheduleBlock: scheduleBlock.serialize(),
    })
  }
}
