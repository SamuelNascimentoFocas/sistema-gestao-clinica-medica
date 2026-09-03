import type { HttpContext } from '@adonisjs/core/http'
import { readMedicalRecordAttachmentsValidator } from '#validators/medical_record_attachment'
import { downloadAttachment } from '#services/medical_record_attachment_service'
import { respondToDomainError } from '#controllers/helpers/domain_error_response'

function buildContentDisposition(originalName: string) {
  const fallbackName =
    Array.from(originalName, (character) => {
      const characterCode = character.charCodeAt(0)

      if (characterCode < 32 || characterCode > 126 || character === '"' || character === '\\') {
        return '_'
      }

      return character
    })
      .join('')
      .trim() || 'attachment'

  const encodedName = encodeURIComponent(originalName).replace(/[!'()*]/g, (character) => {
    return `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  })

  return `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`
}

export default class MedicalRecordAttachmentDownloadsController {
  async download({ auth, clinicAuthorization, params, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const user = auth.getUserOrFail()

    const filters = await readMedicalRecordAttachmentsValidator.validate(request.qs())

    const clinicId = clinicAuthorization.clinic.id

    try {
      const { attachment, fileContents } = await downloadAttachment(
        { clinicId, patientId: params.patientId, entryId: params.entryId, userId: user.id },
        params.attachmentId,
        filters
      )

      response.header('Cache-Control', 'private, no-store')
      response.header('Content-Type', attachment.contentType)
      response.header('Content-Length', fileContents.byteLength)
      response.header('X-Content-Type-Options', 'nosniff')
      response.header('Content-Disposition', buildContentDisposition(attachment.originalName))

      return response.send(Buffer.from(fileContents))
    } catch (error) {
      return respondToDomainError(error, response)
    }
  }
}
