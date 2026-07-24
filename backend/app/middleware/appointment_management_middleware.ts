import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

type AppointmentManagementAction = 'create' | 'update' | 'changeStatus' | 'reschedule'

type AppointmentManagementOptions = {
  action: AppointmentManagementAction
}

const ACTION_PERMISSIONS = {
  create: {
    all: ['appointments.create'],
    own: ['appointments.create_own'],
  },
  update: {
    all: ['appointments.update'],
    own: ['appointments.update_own'],
  },
  changeStatus: {
    all: ['appointments.change_status'],
    own: ['appointments.change_status_own'],
  },
  reschedule: {
    all: ['appointments.create', 'appointments.update', 'appointments.change_status'],
    own: ['appointments.create_own', 'appointments.update_own', 'appointments.change_status_own'],
  },
} as const

export default class AppointmentManagementMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: AppointmentManagementOptions) {
    const user = ctx.auth.getUserOrFail()
    const clinicAuthorization = ctx.clinicAuthorization

    if (!clinicAuthorization) {
      return ctx.response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const permissions = ACTION_PERMISSIONS[options.action]
    const permissionCodes = clinicAuthorization.permissionCodes

    const canManageAll =
      user.isGlobalAdmin ||
      permissionCodes.includes('*') ||
      permissions.all.every((permission) => permissionCodes.includes(permission))

    const canManageOwn = permissions.own.every((permission) => permissionCodes.includes(permission))

    if (!canManageAll && !canManageOwn) {
      return ctx.response.forbidden({
        message: 'Permissão insuficiente para administrar agendamentos',
      })
    }

    ctx.appointmentManagementScope = canManageAll ? 'all' : 'own'

    return next()
  }
}
