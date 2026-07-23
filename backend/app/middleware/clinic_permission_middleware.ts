import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { authorizeClinicAccess } from '#services/clinic_authorization_service'

type ClinicPermissionOptions = {
  permissions: string[]
}

export default class ClinicPermissionMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: ClinicPermissionOptions) {
    const user = ctx.auth.getUserOrFail()
    const clinicId = ctx.params.clinicId

    if (typeof clinicId !== 'string') {
      return ctx.response.badRequest({
        message: 'Consultório não informado',
      })
    }

    const result = await authorizeClinicAccess({
      user,
      clinicId,
      requiredPermissions: options.permissions,
    })

    if (!result.allowed) {
      if (result.status === 404) {
        return ctx.response.notFound({
          message: result.message,
        })
      }

      return ctx.response.forbidden({
        message: result.message,
      })
    }

    ctx.clinicAuthorization = result.context

    return next()
  }
}
