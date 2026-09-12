import type { DateTime } from 'luxon'
import type { Infer } from '@vinejs/vine/types'
import ClinicProfessional from '#models/clinic_professional'
import ProfessionalScheduleBlock from '#models/professional_schedule_block'
import ProfessionalWeeklyAvailability from '#models/professional_weekly_availability'
import DomainError from '#exceptions/domain_error'
import type {
  createWeeklyAvailabilityValidator,
  updateWeeklyAvailabilityValidator,
  createScheduleBlockValidator,
  updateScheduleBlockValidator,
} from '#validators/professional_schedule'

export async function loadSchedule({
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

export async function findWeeklyAvailability(clinicProfessionalId: string, availabilityId: string) {
  return ProfessionalWeeklyAvailability.query()
    .where('id', availabilityId)
    .where('clinic_professional_id', clinicProfessionalId)
    .first()
}

export async function findScheduleBlock(clinicProfessionalId: string, blockId: string) {
  return ProfessionalScheduleBlock.query()
    .where('id', blockId)
    .where('clinic_professional_id', clinicProfessionalId)
    .first()
}

export async function createWeeklyAvailability(
  clinicProfessionalId: string,
  payload: Infer<typeof createWeeklyAvailabilityValidator>
) {
  if (!hasValidTimeOrder(payload.startTime, payload.endTime)) {
    throw new DomainError('invalid', 'O horário inicial deve ser anterior ao horário final')
  }

  const overlap = await findAvailabilityOverlap({
    clinicProfessionalId,
    weekday: payload.weekday,
    startTime: payload.startTime,
    endTime: payload.endTime,
  })

  if (overlap) {
    throw new DomainError('conflict', 'O período informado conflita com outro horário ativo')
  }

  const availability = await ProfessionalWeeklyAvailability.create({
    clinicProfessionalId,
    weekday: payload.weekday,
    startTime: payload.startTime,
    endTime: payload.endTime,
    isActive: true,
  })

  return availability
}

export async function updateWeeklyAvailability(
  clinicProfessionalId: string,
  availabilityId: string,
  payload: Infer<typeof updateWeeklyAvailabilityValidator>
) {
  const availability = await ProfessionalWeeklyAvailability.query()
    .where('id', availabilityId)
    .where('clinic_professional_id', clinicProfessionalId)
    .first()

  if (!availability) {
    throw new DomainError('not_found', 'Horário semanal não encontrado')
  }

  const weekday = payload.weekday ?? availability.weekday
  const startTime = payload.startTime ?? availability.startTime
  const endTime = payload.endTime ?? availability.endTime

  if (!hasValidTimeOrder(startTime, endTime)) {
    throw new DomainError('invalid', 'O horário inicial deve ser anterior ao horário final')
  }

  if (availability.isActive) {
    const overlap = await findAvailabilityOverlap({
      clinicProfessionalId,
      weekday,
      startTime,
      endTime,
      excludeId: availability.id,
    })

    if (overlap) {
      throw new DomainError('conflict', 'O período informado conflita com outro horário ativo')
    }
  }

  availability.merge({
    weekday,
    startTime,
    endTime,
  })

  await availability.save()

  return availability
}

export async function setWeeklyAvailabilityStatus(
  clinicProfessionalId: string,
  availability: ProfessionalWeeklyAvailability,
  isActive: boolean
) {
  if (isActive) {
    const overlap = await findAvailabilityOverlap({
      clinicProfessionalId,
      weekday: availability.weekday,
      startTime: availability.startTime,
      endTime: availability.endTime,
      excludeId: availability.id,
    })

    if (overlap) {
      throw new DomainError('conflict', 'O período informado conflita com outro horário ativo')
    }
  }

  availability.isActive = isActive
  await availability.save()

  return availability
}

export async function createScheduleBlock(
  clinicProfessionalId: string,
  payload: Infer<typeof createScheduleBlockValidator>
) {
  if (!hasValidDateOrder(payload.startsAt, payload.endsAt)) {
    throw new DomainError('invalid', 'O início do bloqueio deve ser anterior ao fim')
  }

  const overlap = await findBlockOverlap({
    clinicProfessionalId,
    startsAt: payload.startsAt,
    endsAt: payload.endsAt,
  })

  if (overlap) {
    throw new DomainError('conflict', 'O período informado conflita com outro bloqueio ativo')
  }

  const scheduleBlock = await ProfessionalScheduleBlock.create({
    clinicProfessionalId,
    startsAt: payload.startsAt,
    endsAt: payload.endsAt,
    reason: payload.reason ?? null,
    isActive: true,
  })

  return scheduleBlock
}

export async function updateScheduleBlock(
  clinicProfessionalId: string,
  blockId: string,
  payload: Infer<typeof updateScheduleBlockValidator>
) {
  const scheduleBlock = await ProfessionalScheduleBlock.query()
    .where('id', blockId)
    .where('clinic_professional_id', clinicProfessionalId)
    .first()

  if (!scheduleBlock) {
    throw new DomainError('not_found', 'Bloqueio de agenda não encontrado')
  }

  const startsAt = payload.startsAt ?? scheduleBlock.startsAt
  const endsAt = payload.endsAt ?? scheduleBlock.endsAt

  if (!hasValidDateOrder(startsAt, endsAt)) {
    throw new DomainError('invalid', 'O início do bloqueio deve ser anterior ao fim')
  }

  if (scheduleBlock.isActive) {
    const overlap = await findBlockOverlap({
      clinicProfessionalId,
      startsAt,
      endsAt,
      excludeId: scheduleBlock.id,
    })

    if (overlap) {
      throw new DomainError('conflict', 'O período informado conflita com outro bloqueio ativo')
    }
  }

  scheduleBlock.merge({
    startsAt,
    endsAt,
    reason: payload.reason !== undefined ? payload.reason : scheduleBlock.reason,
  })

  await scheduleBlock.save()

  return scheduleBlock
}

export async function setScheduleBlockStatus(
  clinicProfessionalId: string,
  scheduleBlock: ProfessionalScheduleBlock,
  isActive: boolean
) {
  if (isActive) {
    const overlap = await findBlockOverlap({
      clinicProfessionalId,
      startsAt: scheduleBlock.startsAt,
      endsAt: scheduleBlock.endsAt,
      excludeId: scheduleBlock.id,
    })

    if (overlap) {
      throw new DomainError('conflict', 'O período informado conflita com outro bloqueio ativo')
    }
  }

  scheduleBlock.isActive = isActive
  await scheduleBlock.save()

  return scheduleBlock
}
