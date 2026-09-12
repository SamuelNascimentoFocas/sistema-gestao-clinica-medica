import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export default class UserInvitationToken extends BaseModel {
  static table = 'clinic.user_invitation_tokens'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'user_id' })
  declare userId: string

  @column({ columnName: 'token_digest', serializeAs: null })
  declare tokenDigest: string

  @column.dateTime({ columnName: 'expires_at' })
  declare expiresAt: DateTime

  @column.dateTime({ columnName: 'consumed_at' })
  declare consumedAt: DateTime | null

  @column.dateTime({ columnName: 'revoked_at' })
  declare revokedAt: DateTime | null

  @column.dateTime({ columnName: 'sent_at' })
  declare sentAt: DateTime | null

  @column({ columnName: 'created_by_user_id' })
  declare createdByUserId: string

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @belongsTo(() => User, { foreignKey: 'userId' })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'createdByUserId' })
  declare createdBy: BelongsTo<typeof User>
}
