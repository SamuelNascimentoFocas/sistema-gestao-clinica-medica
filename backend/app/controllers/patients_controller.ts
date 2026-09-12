import type { HttpContext } from '@adonisjs/core/http'
import {
  createPatientValidator,
  listPatientsValidator,
  updatePatientValidator,
} from '#validators/patient'
import { loadPatientLink, listPatients, updatePatient } from '#services/patient_service'
import { registerPatient } from '#services/patient_registration_service'
import { respondToDomainError } from '#controllers/helpers/domain_error_response'

export default class PatientsController {
  async index({ clinicAuthorization, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const filters = await listPatientsValidator.validate(request.qs())

    const patientLinks = await listPatients(clinicAuthorization.clinic.id, filters)

    return response.ok({
      data: patientLinks.all().map((patientLink) => patientLink.serialize()),
      meta: patientLinks.getMeta(),
    })
  }

  async store({ clinicAuthorization, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const payload = await request.validateUsing(createPatientValidator)
    const clinicId = clinicAuthorization.clinic.id

    try {
      const patientLink = await registerPatient(clinicId, payload)

      return response.created({
        patientLink: patientLink!.serialize(),
      })
    } catch (error) {
      return respondToDomainError(error, response)
    }
  }

  async show({ clinicAuthorization, params, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const patientLink = await loadPatientLink({
      clinicId: clinicAuthorization.clinic.id,
      patientId: params.patientId,
    })

    if (!patientLink) {
      return response.notFound({
        message: 'Paciente não encontrado neste consultório',
      })
    }

    return response.ok({
      patientLink: patientLink.serialize(),
    })
  }

  async update({ clinicAuthorization, params, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const payload = await request.validateUsing(updatePatientValidator)

    if (Object.keys(payload).length === 0) {
      return response.badRequest({
        message: 'Informe pelo menos um campo para atualização',
      })
    }

    const clinicId = clinicAuthorization.clinic.id
    const patientId = params.patientId

    try {
      const patientLink = await updatePatient(clinicId, patientId, payload)

      return response.ok({
        patientLink: patientLink!.serialize(),
      })
    } catch (error) {
      return respondToDomainError(error, response)
    }
  }
}
