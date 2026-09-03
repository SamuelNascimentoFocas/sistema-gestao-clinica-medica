import type { HttpContext } from '@adonisjs/core/http'
import { loadSchedule } from '#services/professional_schedule_service'

export default class ProfessionalSchedulesController {
  async show({ clinicAuthorization, params, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const schedule = await loadSchedule({
      clinicId: clinicAuthorization.clinic.id,
      professionalId: params.professionalId,
    })

    if (!schedule) {
      return response.notFound({
        message: 'Profissional não encontrado neste consultório',
      })
    }

    return response.ok({
      schedule: schedule.serialize(),
    })
  }
}
