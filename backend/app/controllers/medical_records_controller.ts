import type { HttpContext } from '@adonisjs/core/http'
import {
  correctMedicalRecordEntryValidator,
  createMedicalRecordEntryValidator,
  readMedicalRecordValidator,
} from '#validators/medical_record'
import {
  listMedicalRecordEntries,
  readMedicalRecordEntry,
} from '#services/medical_record_read_service'
import {
  createMedicalRecordEntry,
  correctMedicalRecordEntry,
} from '#services/medical_record_entry_service'
import { respondToDomainError } from '#controllers/helpers/domain_error_response'

export default class MedicalRecordsController {
  async index({ auth, clinicAuthorization, params, request, response }: HttpContext) {
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

  async showEntry({ auth, clinicAuthorization, params, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const user = auth.getUserOrFail()
    const filters = await readMedicalRecordValidator.validate(request.qs())

    try {
      const entry = await readMedicalRecordEntry(
        { clinicId: clinicAuthorization.clinic.id, patientId: params.patientId, userId: user.id },
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

  async storeEntry({ auth, clinicAuthorization, params, request, response }: HttpContext) {
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
        { clinicId, patientId: params.patientId, userId: user.id },
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

  async correctEntry({ auth, clinicAuthorization, params, request, response }: HttpContext) {
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
