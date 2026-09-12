import type { HttpContext } from '@adonisjs/core/http'
import {
  createMedicalRecordEntryValidator,
  readMedicalRecordValidator,
} from '#validators/medical_record'
import { readMedicalRecordEntry } from '#services/medical_record_read_service'
import { createMedicalRecordEntry } from '#services/medical_record_entry_service'
import { respondToDomainError } from '#controllers/helpers/domain_error_response'

export default class MedicalRecordEntriesController {
  async show({ auth, clinicAuthorization, params, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const user = auth.getUserOrFail()
    const filters = await readMedicalRecordValidator.validate(request.qs())

    try {
      const entry = await readMedicalRecordEntry(
        {
          clinicId: clinicAuthorization.clinic.id,
          patientId: params.patientId,
          userId: user.id,
          permissionCodes: clinicAuthorization.permissionCodes,
        },
        params.entryId,
        filters
      )

      response.header('Cache-Control', 'private, no-store')

      return response.ok({
        entry: entry.serialize(),
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
    const payload = await request.validateUsing(createMedicalRecordEntryValidator)

    const clinicId = clinicAuthorization.clinic.id

    try {
      const entry = await createMedicalRecordEntry(
        {
          clinicId,
          patientId: params.patientId,
          userId: user.id,
          permissionCodes: clinicAuthorization.permissionCodes,
        },
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
