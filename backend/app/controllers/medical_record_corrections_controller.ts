import type { HttpContext } from '@adonisjs/core/http'
import { correctMedicalRecordEntryValidator } from '#validators/medical_record'
import { correctMedicalRecordEntry } from '#services/medical_record_entry_service'
import { respondToDomainError } from '#controllers/helpers/domain_error_response'

export default class MedicalRecordCorrectionsController {
  async correct({ auth, clinicAuthorization, params, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(correctMedicalRecordEntryValidator)

    const clinicId = clinicAuthorization.clinic.id

    try {
      const entry = await correctMedicalRecordEntry(
        { clinicId, patientId: params.patientId, userId: user.id },
        params.entryId,
        payload
      )

      response.header('Cache-Control', 'private, no-store')

      return response.created({
        entry: entry!.serialize(),
      })
    } catch (error) {
      return respondToDomainError(error, response)
    }
  }
}
