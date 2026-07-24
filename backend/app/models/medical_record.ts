import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Patient from '#models/patient'
import MedicalRecordEntry from '#models/medical_record_entry'
import MedicalRecordAccessLog from '#models/medical_record_access_log'

export default class MedicalRecord extends BaseModel {
  static table = 'clinic.medical_records'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'patient_id' })
  declare patientId: string

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

  @hasMany(() => MedicalRecordEntry, {
    foreignKey: 'medicalRecordId',
  })
  declare entries: HasMany<typeof MedicalRecordEntry>

  @hasMany(() => MedicalRecordAccessLog, {
    foreignKey: 'medicalRecordId',
  })
  declare accessLogs: HasMany<typeof MedicalRecordAccessLog>
}
