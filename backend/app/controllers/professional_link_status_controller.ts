import type { HttpContext } from '@adonisjs/core/http'
import { updateProfessionalLinkStatusValidator } from '#validators/professional'
import {
  findProfessionalLinkForStatus,
  setProfessionalLinkStatus,
} from '#services/professional_service'
import { respondToDomainError } from '#controllers/helpers/domain_error_response'

export default class ProfessionalLinkStatusController {
  async updateStatus({ clinicAuthorization, params, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const professionalLink = await findProfessionalLinkForStatus(
      clinicAuthorization.clinic.id,
      params.professionalId
    )

    if (!professionalLink) {
      return response.notFound({
        message: 'Profissional não encontrado neste consultório',
      })
    }

    const { isActive } = await request.validateUsing(updateProfessionalLinkStatusValidator)

    try {
      const loadedProfessionalLink = await setProfessionalLinkStatus(
        clinicAuthorization.clinic.id,
        professionalLink,
        isActive
      )

      return response.ok({
        professionalLink: loadedProfessionalLink!.serialize(),
      })
    } catch (error) {
      return respondToDomainError(error, response)
    }
  }
}
