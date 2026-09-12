import type { HttpContext } from '@adonisjs/core/http'
import { updatePatientLinkStatusValidator } from '#validators/patient'
import { findPatientLinkForStatus, setPatientLinkStatus } from '#services/patient_service'
import { respondToDomainError } from '#controllers/helpers/domain_error_response'

export default class PatientLinkStatusController {
  async updateStatus({ clinicAuthorization, params, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const patientLink = await findPatientLinkForStatus(
      clinicAuthorization.clinic.id,
      params.patientId
    )

    if (!patientLink) {
      return response.notFound({
        message: 'Paciente não encontrado neste consultório',
      })
    }

    const { isActive } = await request.validateUsing(updatePatientLinkStatusValidator)

    try {
      const loadedPatientLink = await setPatientLinkStatus(
        clinicAuthorization.clinic.id,
        patientLink,
        isActive
      )

      return response.ok({
        patientLink: loadedPatientLink!.serialize(),
      })
    } catch (error) {
      return respondToDomainError(error, response)
    }
  }
}
