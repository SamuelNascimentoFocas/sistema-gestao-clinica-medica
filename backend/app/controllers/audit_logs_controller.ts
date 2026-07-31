import type { HttpContext } from '@adonisjs/core/http'
import MedicalRecordAccessLog from '#models/medical_record_access_log'
import { listAuditLogsValidator } from '#validators/audit_log'

function serializeAuditLog(log: MedicalRecordAccessLog) {
  const attachment = log.medicalRecordAttachmentId ? log.medicalRecordAttachment : null

  return {
    id: log.id,
    medicalRecordId: log.medicalRecordId,
    patientClinicId: log.patientClinicId,
    accessAction: log.accessAction,
    purposeCode: log.purposeCode,
    purposeNote: log.purposeNote,
    accessedAt: log.accessedAt.toISO(),

    user: {
      id: log.user.id,
      fullName: log.user.fullName,
    },

    patient: {
      id: log.patient.id,
      fullName: log.patient.fullName,
    },

    attachment: attachment
      ? {
          id: attachment.id,
          originalName: attachment.originalName,
          contentType: attachment.contentType,
          sizeInBytes: attachment.sizeInBytes,
        }
      : null,
  }
}

export default class AuditLogsController {
  async index({ clinicAuthorization, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const filters = await listAuditLogsValidator.validate(request.qs())

    if (filters.from && filters.to && filters.from.toMillis() >= filters.to.toMillis()) {
      return response.unprocessableEntity({
        message: 'A data inicial do filtro deve ser anterior à data final',
      })
    }

    const page = filters.page ?? 1
    const perPage = filters.perPage ?? 20

    const query = MedicalRecordAccessLog.query()
      .where('clinic_id', clinicAuthorization.clinic.id)
      .preload('user')
      .preload('patient')
      .preload('medicalRecordAttachment')
      .orderBy('accessed_at', 'desc')
      .orderBy('id', 'desc')

    if (filters.from) {
      query.where('accessed_at', '>=', filters.from.toSQL()!)
    }

    if (filters.to) {
      query.where('accessed_at', '<', filters.to.toSQL()!)
    }

    if (filters.userId) {
      query.where('user_id', filters.userId)
    }

    if (filters.patientId) {
      query.where('patient_id', filters.patientId)
    }

    if (filters.accessAction) {
      query.where('access_action', filters.accessAction)
    }

    if (filters.purposeCode) {
      query.where('purpose_code', filters.purposeCode)
    }

    const logs = await query.paginate(page, perPage)

    return response.ok({
      data: logs.all().map(serializeAuditLog),
      meta: logs.getMeta(),
    })
  }
}
