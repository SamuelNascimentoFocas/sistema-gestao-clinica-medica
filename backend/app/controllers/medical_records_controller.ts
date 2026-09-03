import type { HttpContext } from '@adonisjs/core/http'
import { readMedicalRecordValidator } from '#validators/medical_record'
import { listMedicalRecordEntries } from '#services/medical_record_read_service'
import { respondToDomainError } from '#controllers/helpers/domain_error_response'

export default class MedicalRecordsController {
  async show({ auth, clinicAuthorization, params, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const user = auth.getUserOrFail()
    const filters = await readMedicalRecordValidator.validate(request.qs())

    try {
      const { patientLink, patient, medicalRecord, entries } = await listMedicalRecordEntries(
        { clinicId: clinicAuthorization.clinic.id, patientId: params.patientId, userId: user.id },
        filters
      )

      response.header('Cache-Control', 'private, no-store')

      return response.ok({
        medicalRecord: medicalRecord.serialize(),

        patient: patient.serialize(),

        patientLink: {
          id: patientLink.id,
          clinicId: patientLink.clinicId,
          localRecordNumber: patientLink.localRecordNumber,
          isActive: patientLink.isActive,
        },

        entries: entries.all().map((entry) => entry.serialize()),

        meta: entries.getMeta(),
      })
    } catch (error) {
      return respondToDomainError(error, response)
    }
  }
}
