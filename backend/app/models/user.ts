import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { DbAccessTokensProvider, type AccessToken } from '@adonisjs/auth/access_tokens'

const AuthFinder = withAuthFinder(() => hash.use('bcrypt'), {
  uids: ['emailNormalized'],
  passwordColumnName: 'passwordHash',
})

export default class User extends compose(BaseModel, AuthFinder) {
  static table = 'clinic.users'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'full_name' })
  declare fullName: string

  @column()
  declare email: string

  @column({ columnName: 'email_normalized', serializeAs: null })
  declare emailNormalized: string

  @column({ columnName: 'password_hash', serializeAs: null })
  declare passwordHash: string

  @column({ columnName: 'is_global_admin' })
  declare isGlobalAdmin: boolean

  @column({ columnName: 'is_active' })
  declare isActive: boolean

  @column.dateTime({ columnName: 'last_login_at' })
  declare lastLoginAt: DateTime | null

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime

  declare currentAccessToken?: AccessToken

  static accessTokens = DbAccessTokensProvider.forModel(User, {
    table: 'clinic.auth_access_tokens',
    type: 'web_session',
    prefix: 'oat_',
    expiresIn: '8 hours',
    tokenSecretLength: 40,
  })
}
