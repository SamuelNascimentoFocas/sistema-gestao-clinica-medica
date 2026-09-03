import type { HttpContext } from '@adonisjs/core/http'
import type MedicalRecordAttachment from '#models/medical_record_attachment'
import {
  readMedicalRecordAttachmentsValidator,
  uploadMedicalRecordAttachmentsValidator,
} from '#validators/medical_record_attachment'
import { listAttachments, uploadAttachments } from '#services/medical_record_attachment_service'
import { respondToDomainError } from '#controllers/helpers/domain_error_response'

function serializePublicAttachment(attachment: MedicalRecordAttachment) {
  return {
    id: attachment.id,
    medicalRecordEntryId: attachment.medicalRecordEntryId,
    medicalRecordId: attachment.medicalRecordId,
    patientId: attachment.patientId,
    clinicId: attachment.clinicId,
    uploadedByUserId: attachment.uploadedByUserId,
    originalName: attachment.originalName,
    contentType: attachment.contentType,
    sizeInBytes: attachment.sizeInBytes,
    status: attachment.status,
    statusReason: attachment.statusReason,
    createdAt: attachment.createdAt,
    updatedAt: attachment.updatedAt,
  }
}

export default class MedicalRecordAttachmentsController {
  async index({ auth, clinicAuthorization, params, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const user = auth.getUserOrFail()

    const filters = await readMedicalRecordAttachmentsValidator.validate(request.qs())

    const clinicId = clinicAuthorization.clinic.id

    try {
      const attachments = await listAttachments(
        { clinicId, patientId: params.patientId, entryId: params.entryId, userId: user.id },
        filters
      )

      response.header('Cache-Control', 'private, no-store')

      return response.ok({
        attachments: attachments.all().map((attachment) => serializePublicAttachment(attachment)),

        meta: attachments.getMeta(),
      })
    } catch (error) {
      return respondToDomainError(error, response)
    }
  }

  async store({ auth, clinicAuthorization, params, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const user = auth.getUserOrFail()

    const payload = await request.validateUsing(uploadMedicalRecordAttachmentsValidator)

    const clinicId = clinicAuthorization.clinic.id

    let upload: Awaited<ReturnType<typeof uploadAttachments>> | undefined

    try {
      upload = await uploadAttachments(
        { clinicId, patientId: params.patientId, entryId: params.entryId, userId: user.id },
        payload
      )

      response.header('Cache-Control', 'private, no-store')

      return response.created({
        attachments: upload.attachments.map((attachment) => serializePublicAttachment(attachment)),
      })
    } catch (error) {
      await upload?.compensate()
      return respondToDomainError(error, response)
    }
  }
}
