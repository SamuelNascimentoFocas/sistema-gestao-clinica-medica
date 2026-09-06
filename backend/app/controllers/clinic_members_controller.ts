import type { HttpContext } from '@adonisjs/core/http'
import UserClinicRole from '#models/user_clinic_role'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import Role from '#models/role'
import { createClinicMemberValidator, listClinicMembersValidator } from '#validators/clinic_member'
import { listClinicMembers, loadMembershipRelations } from '#services/clinic_member_query_service'

function passwordExceedsBcryptLimit(password: string) {
  return Buffer.byteLength(password, 'utf8') > 72
}

async function emailAlreadyExists(emailNormalized: string) {
  return Boolean(await User.query().where('email_normalized', emailNormalized).first())
}

export default class ClinicMembersController {
  async index({ clinicAuthorization, request, response }: HttpContext) {
    if (!clinicAuthorization) {
      return response.internalServerError({
        message: 'Contexto de autorização não inicializado',
      })
    }

    const filters = await listClinicMembersValidator.validate(request.qs())
    const memberships = await listClinicMembers(clinicAuthorization.clinic.id, filters)

    return response.ok({
      data: memberships.all().map((membership) => membership.serialize()),
      meta: memberships.getMeta(),
    })
  }

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
}
