import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import User from '#models/user'

export default class CreateAdmin extends BaseCommand {
  static commandName = 'admin:create'
  static description = 'Create a global administrator user'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const fullName = await this.prompt.ask('Nome completo', {
      validate(value) {
        const normalizedName = value.trim()

        if (normalizedName.length < 3) {
          return 'O nome deve possuir pelo menos 3 caracteres'
        }

        if (normalizedName.length > 180) {
          return 'O nome deve possuir no máximo 180 caracteres'
        }

        return true
      },
      result(value) {
        return value.trim()
      },
    })

    const email = await this.prompt.ask('E-mail', {
      validate(value) {
        const normalizedEmail = value.trim().toLowerCase()

        if (normalizedEmail.length === 0) {
          return 'O e-mail é obrigatório'
        }

        if (normalizedEmail.length > 254) {
          return 'O e-mail deve possuir no máximo 254 caracteres'
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
          return 'Informe um e-mail válido'
        }

        return true
      },
      result(value) {
        return value.trim()
      },
    })

    const emailNormalized = email.toLowerCase()

    const existingUser = await User.query().where('email_normalized', emailNormalized).first()

    if (existingUser) {
      this.logger.error('Já existe um usuário cadastrado com este e-mail')
      this.exitCode = 1
      return
    }

    const password = await this.prompt.secure('Senha', {
      validate(value) {
        if (value.length < 12) {
          return 'A senha deve possuir pelo menos 12 caracteres'
        }

        if (Buffer.byteLength(value, 'utf8') > 72) {
          return 'A senha deve possuir no máximo 72 bytes'
        }

        return true
      },
    })

    const passwordConfirmation = await this.prompt.secure('Confirme a senha')

    if (password !== passwordConfirmation) {
      this.logger.error('As senhas informadas não são iguais')
      this.exitCode = 1
      return
    }

    const confirmed = await this.prompt.confirm(`Criar administrador geral ${fullName} (${email})?`)

    if (!confirmed) {
      this.logger.info('Operação cancelada')
      return
    }

    const user = await User.create({
      fullName,
      email,
      emailNormalized,
      passwordHash: password,
      isGlobalAdmin: true,
      isActive: true,
    })

    this.logger.info(`Administrador geral criado com sucesso: ${user.email}`)
  }
}
