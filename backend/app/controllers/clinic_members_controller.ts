import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import Role from '#models/role'
import UserClinicRole from '#models/user_clinic_role'
import {
  createClinicMemberValidator,
  updateClinicMemberRoleValidator,
  updateClinicMemberStatusValidator,
} from '#validators/clinic_member'
import { isLastActiveClinicAdmin } from '#services/clinic_membership_rules'

function passwordExceedsBcryptLimit(password: string) {
  return Buffer.byteLength(password, 'utf8') > 72
}

async function emailAlreadyExists(emailNormalized: string) {
  return Boolean(await User.query().where('email_normalized', emailNormalized).first())
}

async function loadScopedMembership({
  clinicId,
  membershipId,
}: {
  clinicId: string
  membershipId: string
}) {
  return UserClinicRole.query()
    .where('id', membershipId)
    .where('clinic_id', clinicId)
    .preload('user')
    .preload('clinic')
    .preload('role')
    .first()
}

async function loadMembershipRelations(membershipId: string) {
  return UserClinicRole.query()
    .where('id', membershipId)
    .preload('user')
    .preload('clinic')
    .preload('role')
    .firstOrFail()
}

export default class ClinicMembersController {
  async store({ clinicAuthorization, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const payload = await request.validateUsing(createClinicMemberValidator)

    if (passwordExceedsBcryptLimit(payload.password)) {
      return response.unprocessableEntity({
        message: 'A senha deve possuir no máximo 72 bytes',
      })
    }

    const emailNormalized = payload.email.toLowerCase()

    if (await emailAlreadyExists(emailNormalized)) {
      return response.conflict({
        message:
          'Já existe um usuário cadastrado com este e-mail. O vínculo de um usuário existente deve ser realizado pelo Administrador Geral.',
      })
    }

    const role = await Role.query().where('code', payload.roleCode).where('is_active', true).first()

    if (!role) {
      return response.notFound({
        message: 'Perfil ativo não encontrado',
      })
    }

    const membershipId = await db.transaction(async (trx) => {
      const user = new User()

      user.fullName = payload.fullName
      user.email = payload.email
      user.emailNormalized = emailNormalized
      user.passwordHash = payload.password
      user.isGlobalAdmin = false
      user.isActive = true
      user.useTransaction(trx)

      await user.save()

      const membership = new UserClinicRole()

      membership.userId = user.id
      membership.clinicId = clinicAuthorization.clinic.id
      membership.roleId = role.id
      membership.isActive = true
      membership.useTransaction(trx)

      await membership.save()

      return membership.id
    })

    const membership = await loadMembershipRelations(membershipId)

    return response.created({
      membership: membership.serialize(),
    })
  }

  async updateRole({ clinicAuthorization, params, request, response }: HttpContext) {
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

    const { roleCode } = await request.validateUsing(updateClinicMemberRoleValidator)

    const role = await Role.query().where('code', roleCode).where('is_active', true).first()

    if (!role) {
      return response.notFound({
        message: 'Perfil ativo não encontrado',
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
