import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Patient from '#models/patient'
import Clinic from '#models/clinic'

export default class PatientClinic extends BaseModel {
  static table = 'clinic.patient_clinics'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'patient_id' })
  declare patientId: string

  @column({ columnName: 'clinic_id' })
  declare clinicId: string

  @column({ columnName: 'local_record_number' })
  declare localRecordNumber: string | null

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

  @belongsTo(() => Patient, {
    foreignKey: 'patientId',
  })
  declare patient: BelongsTo<typeof Patient>

  @belongsTo(() => Clinic, {
    foreignKey: 'clinicId',
  })
  declare clinic: BelongsTo<typeof Clinic>
}
