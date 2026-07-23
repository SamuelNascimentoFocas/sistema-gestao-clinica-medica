import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Clinic from '#models/clinic'
import Role from '#models/role'

export default class UserClinicRole extends BaseModel {
  static table = 'clinic.user_clinic_roles'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'user_id' })
  declare userId: string

  @column({ columnName: 'clinic_id' })
  declare clinicId: string

  @column({ columnName: 'role_id' })
  declare roleId: string

  @column({ columnName: 'is_active' })
  declare isActive: boolean

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({
    autoCreate: true,
    autoUpdate: true,
    columnName: 'updated_at',
  })
  declare updatedAt: DateTime

  @belongsTo(() => User, {
    foreignKey: 'userId',
  })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Clinic, {
    foreignKey: 'clinicId',
  })
  declare clinic: BelongsTo<typeof Clinic>

  @belongsTo(() => Role, {
    foreignKey: 'roleId',
  })
  declare role: BelongsTo<typeof Role>
}
