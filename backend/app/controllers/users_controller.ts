import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import {
  createUserValidator,
  listUsersValidator,
  updateUserStatusValidator,
  updateUserValidator,
} from '#validators/user'

async function emailAlreadyExists(emailNormalized: string, exceptUserId?: string) {
  const query = User.query().where('email_normalized', emailNormalized)

  if (exceptUserId) {
    query.whereNot('id', exceptUserId)
  }

  return Boolean(await query.first())
}

function passwordExceedsBcryptLimit(password: string) {
  return Buffer.byteLength(password, 'utf8') > 72
}

export default class UsersController {
  async index({ request, response }: HttpContext) {
    const filters = await listUsersValidator.validate(request.qs())

    const page = filters.page ?? 1
    const perPage = filters.perPage ?? 20

    const query = User.query().orderBy('full_name', 'asc')

    if (filters.search) {
      const search = `%${filters.search}%`

      query.where((builder) => {
        builder.whereRaw('full_name ILIKE ?', [search]).orWhereRaw('email ILIKE ?', [search])
      })
    }

    if (filters.isActive !== undefined) {
      query.where('is_active', filters.isActive)
    }

    if (filters.isGlobalAdmin !== undefined) {
      query.where('is_global_admin', filters.isGlobalAdmin)
    }

    const users = await query.paginate(page, perPage)

    return response.ok({
      data: users.all().map((user) => user.serialize()),
      meta: users.getMeta(),
    })
  }

  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createUserValidator)

    if (passwordExceedsBcryptLimit(payload.password)) {
      return response.unprocessableEntity({
        message: 'A senha deve possuir no máximo 72 bytes',
      })
    }

    const emailNormalized = payload.email.toLowerCase()

    if (await emailAlreadyExists(emailNormalized)) {
      return response.conflict({
        message: 'Já existe um usuário cadastrado com este e-mail',
      })
    }

    const user = await User.create({
      fullName: payload.fullName,
      email: payload.email,
      emailNormalized,
      passwordHash: payload.password,
      isGlobalAdmin: false,
      isActive: true,
    })

    return response.created({
      user: user.serialize(),
    })
  }

  async show({ params, response }: HttpContext) {
    const user = await User.find(params.id)

    if (!user) {
      return response.notFound({
        message: 'Usuário não encontrado',
      })
    }

    return response.ok({
      user: user.serialize(),
    })
  }

  async update({ params, request, response }: HttpContext) {
    const user = await User.find(params.id)

    if (!user) {
      return response.notFound({
        message: 'Usuário não encontrado',
      })
    }

    const payload = await request.validateUsing(updateUserValidator)

    if (Object.keys(payload).length === 0) {
      return response.badRequest({
        message: 'Informe pelo menos um campo para atualização',
      })
    }

    if (payload.password && passwordExceedsBcryptLimit(payload.password)) {
      return response.unprocessableEntity({
        message: 'A senha deve possuir no máximo 72 bytes',
      })
    }

    if (payload.email !== undefined) {
      const emailNormalized = payload.email.toLowerCase()

      if (
        emailNormalized !== user.emailNormalized &&
        (await emailAlreadyExists(emailNormalized, user.id))
      ) {
        return response.conflict({
          message: 'Já existe um usuário cadastrado com este e-mail',
        })
      }

      user.email = payload.email
      user.emailNormalized = emailNormalized
    }

    if (payload.fullName !== undefined) {
      user.fullName = payload.fullName
    }

    if (payload.password !== undefined) {
      user.passwordHash = payload.password
    }

    await user.save()

    return response.ok({
      user: user.serialize(),
    })
  }

  async updateStatus({ auth, params, request, response }: HttpContext) {
    const authenticatedUser = auth.getUserOrFail()
    const user = await User.find(params.id)

    if (!user) {
      return response.notFound({
        message: 'Usuário não encontrado',
      })
    }

    const { isActive } = await request.validateUsing(updateUserStatusValidator)

    if (!isActive && authenticatedUser.id === user.id) {
      return response.conflict({
        message: 'Você não pode inativar seu próprio usuário',
      })
    }

    if (!isActive && user.isGlobalAdmin) {
      return response.conflict({
        message: 'Um Administrador Geral não pode ser inativado por esta rota',
      })
    }

    user.isActive = isActive
    await user.save()

    return response.ok({
      user: user.serialize(),
    })
  }
}
