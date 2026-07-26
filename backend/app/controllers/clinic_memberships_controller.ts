import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Clinic from '#models/clinic'
import Role from '#models/role'
import UserClinicRole from '#models/user_clinic_role'
import {
  createClinicMembershipValidator,
  listClinicMembershipsValidator,
  updateClinicMembershipStatusValidator,
  updateClinicMembershipValidator,
} from '#validators/clinic_membership'
import { isLastActiveClinicAdmin } from '#services/clinic_membership_rules'

async function loadRelations(membership: UserClinicRole) {
  await membership.load('user')
  await membership.load('clinic')
  await membership.load('role')
}

export default class ClinicMembershipsController {
  async index({ request, response }: HttpContext) {
    const filters = await listClinicMembershipsValidator.validate(request.qs())

    const page = filters.page ?? 1
    const perPage = filters.perPage ?? 20

    const query = UserClinicRole.query()
      .preload('user')
      .preload('clinic')
      .preload('role')
      .orderBy('created_at', 'desc')

    if (filters.userId) {
      query.where('user_id', filters.userId)
    }

    if (filters.clinicId) {
      query.where('clinic_id', filters.clinicId)
    }

    if (filters.isActive !== undefined) {
      query.where('is_active', filters.isActive)
    }

    const roleCode = filters.roleCode

    if (roleCode) {
      query.whereHas('role', (roleQuery) => {
        roleQuery.where('code', roleCode)
      })
    }

    const memberships = await query.paginate(page, perPage)

    return response.ok({
      data: memberships.all().map((membership) => membership.serialize()),
      meta: memberships.getMeta(),
    })
  }

  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createClinicMembershipValidator)

    const user = await User.find(payload.userId)

    if (!user) {
      return response.notFound({
        message: 'Usuário não encontrado',
      })
    }

    if (user.isGlobalAdmin) {
      return response.conflict({
        message: 'O Administrador Geral não necessita de vínculo com consultório',
      })
    }

    if (!user.isActive) {
      return response.conflict({
        message: 'Não é possível vincular um usuário inativo',
      })
    }

    const clinic = await Clinic.find(payload.clinicId)

    if (!clinic) {
      return response.notFound({
        message: 'Consultório não encontrado',
      })
    }

    if (!clinic.isActive) {
      return response.conflict({
        message: 'Não é possível vincular um consultório inativo',
      })
    }

    const role = await Role.findBy('code', payload.roleCode)

    if (!role) {
      return response.notFound({
        message: 'Perfil não encontrado',
      })
    }

    if (!role.isActive) {
      return response.conflict({
        message: 'Não é possível atribuir um perfil inativo',
      })
    }

    const existingMembership = await UserClinicRole.query()
      .where('user_id', user.id)
      .where('clinic_id', clinic.id)
      .first()

    if (existingMembership) {
      return response.conflict({
        message: 'Este usuário já possui um vínculo com este consultório',
      })
    }

    const membership = await UserClinicRole.create({
      userId: user.id,
      clinicId: clinic.id,
      roleId: role.id,
      isActive: true,
    })

    await loadRelations(membership)

    return response.created({
      membership: membership.serialize(),
    })
  }

  async show({ params, response }: HttpContext) {
    const membership = await UserClinicRole.query()
      .where('id', params.id)
      .preload('user')
      .preload('clinic')
      .preload('role')
      .first()

    if (!membership) {
      return response.notFound({
        message: 'Vínculo não encontrado',
      })
    }

    return response.ok({
      membership: membership.serialize(),
    })
  }

  async update({ params, request, response }: HttpContext) {
    const membership = await UserClinicRole.query().where('id', params.id).preload('role').first()

    if (!membership) {
      return response.notFound({
        message: 'Vínculo não encontrado',
      })
    }

    const { roleCode } = await request.validateUsing(updateClinicMembershipValidator)

    const role = await Role.findBy('code', roleCode)

    if (!role) {
      return response.notFound({
        message: 'Perfil não encontrado',
      })
    }

    if (!role.isActive) {
      return response.conflict({
        message: 'Não é possível atribuir um perfil inativo',
      })
    }

    if (
      role.code !== 'clinic_admin' &&
      membership.role.code === 'clinic_admin' &&
      (await isLastActiveClinicAdmin(membership))
    ) {
      return response.conflict({
        message: 'O último Administrador de Consultório ativo não pode ter seu perfil alterado',
      })
    }

    membership.roleId = role.id
    await membership.save()
    await loadRelations(membership)

    return response.ok({
      membership: membership.serialize(),
    })
  }

  async updateStatus({ params, request, response }: HttpContext) {
    const membership = await UserClinicRole.query()
      .where('id', params.id)
      .preload('user')
      .preload('clinic')
      .preload('role')
      .first()

    if (!membership) {
      return response.notFound({
        message: 'Vínculo não encontrado',
      })
    }

    const { isActive } = await request.validateUsing(updateClinicMembershipStatusValidator)

    if (
      !isActive &&
      membership.isActive &&
      membership.role.code === 'clinic_admin' &&
      (await isLastActiveClinicAdmin(membership))
    ) {
      return response.conflict({
        message: 'O último Administrador de Consultório ativo não pode ser inativado',
      })
    }

    if (isActive) {
      if (membership.user.isGlobalAdmin) {
        return response.conflict({
          message: 'O Administrador Geral não necessita de vínculo com consultório',
        })
      }

      if (!membership.user.isActive) {
        return response.conflict({
          message: 'Não é possível ativar o vínculo de um usuário inativo',
        })
      }

      if (!membership.clinic.isActive) {
        return response.conflict({
          message: 'Não é possível ativar o vínculo com um consultório inativo',
        })
      }

      if (!membership.role.isActive) {
        return response.conflict({
          message: 'Não é possível ativar um vínculo com perfil inativo',
        })
      }
    }

    membership.isActive = isActive
    await membership.save()

    return response.ok({
      membership: membership.serialize(),
    })
  }
}
