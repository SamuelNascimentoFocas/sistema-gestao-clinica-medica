import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import ClinicProfessional from '#models/clinic_professional'

export default class Professional extends BaseModel {
  static table = 'clinic.professionals'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'user_id' })
  declare userId: string | null

  @column({ columnName: 'full_name' })
  declare fullName: string

  @column({ columnName: 'crm_number' })
  declare crmNumber: string

  @column({ columnName: 'crm_state' })
  declare crmState: string

  @column()
  declare specialty: string

  @column()
  declare phone: string | null

  @column()
  declare email: string | null

  @column({ columnName: 'is_active' })
  declare isActive: boolean

  @column.dateTime({
    autoCreate: true,
    columnName: 'created_at',
  })
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

  @hasMany(() => ClinicProfessional, {
    foreignKey: 'professionalId',
  })
  declare clinicLinks: HasMany<typeof ClinicProfessional>
}
