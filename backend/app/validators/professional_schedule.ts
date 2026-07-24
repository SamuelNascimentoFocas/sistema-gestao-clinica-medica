import { DateTime } from 'luxon'
import vine from '@vinejs/vine'

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/

export const createWeeklyAvailabilityValidator = vine.compile(
  vine.object({
    weekday: vine.number({ strict: true }).withoutDecimals().min(1).max(7),

    startTime: vine.string().trim().regex(timePattern),

    endTime: vine.string().trim().regex(timePattern),
  })
)

export const updateWeeklyAvailabilityValidator = vine.compile(
  vine.object({
    weekday: vine.number({ strict: true }).withoutDecimals().min(1).max(7).optional(),

    startTime: vine.string().trim().regex(timePattern).optional(),

    endTime: vine.string().trim().regex(timePattern).optional(),
  })
)

export const createScheduleBlockValidator = vine.compile(
  vine.object({
    startsAt: vine
      .date({
        formats: ['iso8601'],
      })
      .transform((value) => DateTime.fromJSDate(value).toUTC()),

    endsAt: vine
      .date({
        formats: ['iso8601'],
      })
      .transform((value) => DateTime.fromJSDate(value).toUTC()),

    reason: vine.string().trim().minLength(1).maxLength(240).nullable().optional(),
  })
)

export const updateScheduleBlockValidator = vine.compile(
  vine.object({
    startsAt: vine
      .date({
        formats: ['iso8601'],
      })
      .transform((value) => DateTime.fromJSDate(value).toUTC())
      .optional(),

    endsAt: vine
      .date({
        formats: ['iso8601'],
      })
      .transform((value) => DateTime.fromJSDate(value).toUTC())
      .optional(),

    reason: vine.string().trim().minLength(1).maxLength(240).nullable().optional(),
  })
)

export const updateScheduleItemStatusValidator = vine.compile(
  vine.object({
    isActive: vine.boolean({ strict: true }),
  })
)
