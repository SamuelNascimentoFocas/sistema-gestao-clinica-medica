import type { HttpContext } from '@adonisjs/core/http'
import {
  updateClinicMemberRoleValidator,
  updateClinicMemberStatusValidator,
} from '#validators/clinic_member'
import { isLastActiveClinicAdmin } from '#services/clinic_membership_rules'
import {
  loadScopedMembership,
  loadMembershipRelations,
} from '#services/clinic_member_query_service'
import { resolveRoleForAssignment, roleSelectorFromInput } from '#services/role_grant_service'

export default class ClinicMemberAccessController {
  async updateRole({ auth, clinicAuthorization, params, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const membership = await loadScopedMembership({
      clinicId: clinicAuthorization.clinic.id,
      membershipId: params.membershipId,
    })

    if (!membership) {
      return response.notFound({
        message: 'Vínculo não encontrado neste consultório',
      })
    }

    const payload = await request.validateUsing(updateClinicMemberRoleValidator)
    const role = await resolveRoleForAssignment({
      clinicId: clinicAuthorization.clinic.id,
      selector: roleSelectorFromInput(payload),
      actor: {
        isGlobalAdmin: auth.getUserOrFail().isGlobalAdmin,
        permissionCodes: clinicAuthorization.permissionCodes,
      },
    })

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

    const updatedMembership = await loadMembershipRelations(membership.id)

    return response.ok({
      membership: updatedMembership.serialize(),
    })
  }

  async updateStatus({ clinicAuthorization, params, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const membership = await loadScopedMembership({
      clinicId: clinicAuthorization.clinic.id,
      membershipId: params.membershipId,
    })

    if (!membership) {
      return response.notFound({
        message: 'Vínculo não encontrado neste consultório',
      })
    }

    const { isActive } = await request.validateUsing(updateClinicMemberStatusValidator)

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

      if (!membership.role.isActive) {
        return response.conflict({
          message: 'Não é possível ativar um vínculo com perfil inativo',
        })
      }
    }

    membership.isActive = isActive
    await membership.save()

    const updatedMembership = await loadMembershipRelations(membership.id)

    return response.ok({
      membership: updatedMembership.serialize(),
    })
  }
}
