import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import ClinicProfessional from '#models/clinic_professional'

export default class ScheduleManagementMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.getUserOrFail()
    const clinicAuthorization = ctx.clinicAuthorization

    if (!clinicAuthorization) {
      return ctx.response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const professionalId = ctx.params.professionalId

    if (typeof professionalId !== 'string') {
      return ctx.response.badRequest({
        message: 'Profissional não informado',
      })
    }

    const clinicProfessional = await ClinicProfessional.query()
      .where('clinic_id', clinicAuthorization.clinic.id)
      .where('professional_id', professionalId)
      .preload('professional')
      .first()

    if (!clinicProfessional) {
      return ctx.response.notFound({
        message: 'Profissional não encontrado neste consultório',
      })
    }

    const permissionCodes = clinicAuthorization.permissionCodes

    const canManageAllSchedules =
      user.isGlobalAdmin ||
      permissionCodes.includes('*') ||
      permissionCodes.includes('schedules.manage')

    if (!canManageAllSchedules) {
      if (!permissionCodes.includes('schedules.manage_own')) {
        return ctx.response.forbidden({
          message: 'Permissão insuficiente para administrar agendas',
        })
      }

      if (!clinicProfessional.isActive || !clinicProfessional.professional.isActive) {
        return ctx.response.forbidden({
          message: 'O vínculo profissional está inativo',
        })
      }

      if (clinicProfessional.professional.userId !== user.id) {
        return ctx.response.forbidden({
          message: 'Você somente pode administrar a própria agenda',
        })
      }
    }

    ctx.scheduleProfessional = clinicProfessional

    return next()
  }
}
