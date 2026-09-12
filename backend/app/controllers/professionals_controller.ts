import type { HttpContext } from '@adonisjs/core/http'
import {
  createProfessionalValidator,
  listProfessionalsValidator,
  updateProfessionalLinkValidator,
} from '#validators/professional'
import {
  loadProfessionalLink,
  listProfessionals,
  findProfessionalLink,
  updateProfessional,
} from '#services/professional_service'
import { registerProfessional } from '#services/professional_registration_service'
import { respondToDomainError } from '#controllers/helpers/domain_error_response'

export default class ProfessionalsController {
  async index({ clinicAuthorization, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const filters = await listProfessionalsValidator.validate(request.qs())

    const professionalLinks = await listProfessionals(clinicAuthorization.clinic.id, filters)

    return response.ok({
      data: professionalLinks.all().map((professionalLink) => professionalLink.serialize()),
      meta: professionalLinks.getMeta(),
    })
  }

  async store({ clinicAuthorization, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const payload = await request.validateUsing(createProfessionalValidator)

    const clinicId = clinicAuthorization.clinic.id

    try {
      const professionalLink = await registerProfessional(clinicId, payload)

      return response.created({
        professionalLink: professionalLink!.serialize(),
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

    const professionalLink = await loadProfessionalLink({
      clinicId: clinicAuthorization.clinic.id,
      professionalId: params.professionalId,
    })

    if (!professionalLink) {
      return response.notFound({
        message: 'Profissional não encontrado neste consultório',
      })
    }

    return response.ok({
      professionalLink: professionalLink.serialize(),
    })
  }

  async update({ clinicAuthorization, params, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const payload = await request.validateUsing(updateProfessionalLinkValidator)

    if (Object.keys(payload).length === 0) {
      return response.badRequest({
        message: 'Informe pelo menos um campo para atualização',
      })
    }

    const clinicId = clinicAuthorization.clinic.id

    const professionalLink = await findProfessionalLink(clinicId, params.professionalId)

    if (!professionalLink) {
      return response.notFound({
        message: 'Profissional não encontrado neste consultório',
      })
    }

    try {
      const loadedProfessionalLink = await updateProfessional(clinicId, professionalLink, payload)

      return response.ok({
        professionalLink: loadedProfessionalLink!.serialize(),
      })
    } catch (error) {
      return respondToDomainError(error, response)
    }
  }
}
