import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import MedicalRecordEntry from '#models/medical_record_entry'
import MedicalRecord from '#models/medical_record'
import Patient from '#models/patient'
import Clinic from '#models/clinic'
import User from '#models/user'
import MedicalRecordAccessLog from '#models/medical_record_access_log'

export type MedicalRecordAttachmentStatus = 'pending' | 'available' | 'rejected'

export default class MedicalRecordAttachment extends BaseModel {
  static table = 'clinic.medical_record_attachments'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'medical_record_entry_id' })
  declare medicalRecordEntryId: string

  @column({ columnName: 'medical_record_id' })
  declare medicalRecordId: string

  @column({ columnName: 'patient_id' })
  declare patientId: string

  @column({ columnName: 'clinic_id' })
  declare clinicId: string

  @column({ columnName: 'uploaded_by_user_id' })
  declare uploadedByUserId: string

  @column({ columnName: 'original_name' })
  declare originalName: string

  @column({ columnName: 'storage_disk' })
  declare storageDisk: string

  @column({ columnName: 'storage_key' })
  declare storageKey: string

  @column({ columnName: 'content_type' })
  declare contentType: string

  @column({ columnName: 'size_in_bytes' })
  declare sizeInBytes: number

  @column({ columnName: 'sha256' })
  declare sha256: string

  @column()
  declare status: MedicalRecordAttachmentStatus

  @column({ columnName: 'status_reason' })
  declare statusReason: string | null

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

  @belongsTo(() => MedicalRecordEntry, {
    foreignKey: 'medicalRecordEntryId',
  })
  declare medicalRecordEntry: BelongsTo<typeof MedicalRecordEntry>

  @belongsTo(() => MedicalRecord, {
    foreignKey: 'medicalRecordId',
  })
  declare medicalRecord: BelongsTo<typeof MedicalRecord>

  @belongsTo(() => Patient, {
    foreignKey: 'patientId',
  })
  declare patient: BelongsTo<typeof Patient>

  @belongsTo(() => Clinic, {
    foreignKey: 'clinicId',
  })
  declare clinic: BelongsTo<typeof Clinic>

  @belongsTo(() => User, {
    foreignKey: 'uploadedByUserId',
  })
  declare uploadedByUser: BelongsTo<typeof User>

  @hasMany(() => MedicalRecordAccessLog, {
    foreignKey: 'medicalRecordAttachmentId',
  })
  declare accessLogs: HasMany<typeof MedicalRecordAccessLog>
}
