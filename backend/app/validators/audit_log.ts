import { DateTime } from 'luxon'
import vine from '@vinejs/vine'

export const listAuditLogsValidator = vine.compile(
  vine.object({
    page: vine.number().min(1).withoutDecimals().optional(),

    perPage: vine.number().min(1).max(100).withoutDecimals().optional(),

    from: vine
      .date({
        formats: ['iso8601'],
      })
      .transform((value) => DateTime.fromJSDate(value).toUTC())
      .optional(),

    to: vine
      .date({
        formats: ['iso8601'],
      })
      .transform((value) => DateTime.fromJSDate(value).toUTC())
      .optional(),

    userId: vine.string().uuid().optional(),

    patientId: vine.string().uuid().optional(),

    accessAction: vine
      .enum(['view_timeline', 'view_entry', 'list_attachments', 'download_attachment'])
      .optional(),

    purposeCode: vine
      .enum(['patient_care', 'care_coordination', 'legal_obligation', 'other'])
      .optional(),
  })
)
