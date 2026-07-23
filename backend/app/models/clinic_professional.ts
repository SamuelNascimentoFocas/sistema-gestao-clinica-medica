import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Clinic from '#models/clinic'
import Professional from '#models/professional'
import ProfessionalWeeklyAvailability from '#models/professional_weekly_availability'
import ProfessionalScheduleBlock from '#models/professional_schedule_block'

export default class ClinicProfessional extends BaseModel {
  static table = 'clinic.clinic_professionals'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'clinic_id' })
  declare clinicId: string

  @column({ columnName: 'professional_id' })
  declare professionalId: string

  @column({ columnName: 'local_code' })
  declare localCode: string | null

  @column({
    columnName: 'default_appointment_duration_minutes',
  })
  declare defaultAppointmentDurationMinutes: number

  @column({ columnName: 'accepts_appointments' })
  declare acceptsAppointments: boolean

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

  @belongsTo(() => Clinic, {
    foreignKey: 'clinicId',
  })
  declare clinic: BelongsTo<typeof Clinic>

  @belongsTo(() => Professional, {
    foreignKey: 'professionalId',
  })
  declare professional: BelongsTo<typeof Professional>

  @hasMany(() => ProfessionalWeeklyAvailability, {
    foreignKey: 'clinicProfessionalId',
  })
  declare weeklyAvailabilities: HasMany<typeof ProfessionalWeeklyAvailability>

  @hasMany(() => ProfessionalScheduleBlock, {
    foreignKey: 'clinicProfessionalId',
  })
  declare scheduleBlocks: HasMany<typeof ProfessionalScheduleBlock>
}
