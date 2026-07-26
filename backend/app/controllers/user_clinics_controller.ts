import type { HttpContext } from '@adonisjs/core/http'
import Clinic from '#models/clinic'
import UserClinicRole from '#models/user_clinic_role'

export default class UserClinicsController {
  async index({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()

    if (!user.isActive) {
      return response.forbidden({
        message: 'Usuário inativo',
      })
    }

    if (user.isGlobalAdmin) {
      const clinics = await Clinic.query().where('is_active', true).orderBy('name', 'asc')

      return response.ok({
        data: clinics.map((clinic) => ({
          clinic: clinic.serialize(),
          access: {
            scope: 'global',
            membershipId: null,
            role: null,
          },
        })),
      })
    }

    const memberships = await UserClinicRole.query()
      .where('user_id', user.id)
      .where('is_active', true)
      .whereHas('clinic', (clinicQuery) => {
        clinicQuery.where('is_active', true)
      })
      .whereHas('role', (roleQuery) => {
        roleQuery.where('is_active', true)
      })
      .preload('clinic')
      .preload('role')

    memberships.sort((left, right) => left.clinic.name.localeCompare(right.clinic.name, 'pt-BR'))

    return response.ok({
      data: memberships.map((membership) => ({
        clinic: membership.clinic.serialize(),
        access: {
          scope: 'clinic',
          membershipId: membership.id,
          role: {
            id: membership.role.id,
            code: membership.role.code,
            name: membership.role.name,
          },
        },
      })),
    })
  }
}
