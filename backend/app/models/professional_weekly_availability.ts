import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ClinicProfessional from '#models/clinic_professional'

export default class ProfessionalWeeklyAvailability extends BaseModel {
  static table = 'clinic.professional_weekly_availabilities'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'clinic_professional_id' })
  declare clinicProfessionalId: string

  @column()
  declare weekday: number

  @column({ columnName: 'start_time' })
  declare startTime: string

  @column({ columnName: 'end_time' })
  declare endTime: string

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

  @belongsTo(() => ClinicProfessional, {
    foreignKey: 'clinicProfessionalId',
  })
  declare clinicProfessional: BelongsTo<typeof ClinicProfessional>
}
