import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, computed, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import MedicalRecord from '#models/medical_record'
import Patient from '#models/patient'
import Clinic from '#models/clinic'
import PatientClinic from '#models/patient_clinic'
import ClinicProfessional from '#models/clinic_professional'
import Appointment from '#models/appointment'
import User from '#models/user'
import MedicalRecordAttachment from '#models/medical_record_attachment'

export type MedicalRecordEntryType = 'consultation' | 'evolution' | 'correction' | 'other'

export const MEDICAL_RECORD_CONTENT_FORMAT = 'markdown' as const
export const MEDICAL_RECORD_CONTENT_FORMAT_VERSION = 1 as const

export default class MedicalRecordEntry extends BaseModel {
  static table = 'clinic.medical_record_entries'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'medical_record_id' })
  declare medicalRecordId: string

  @column({ columnName: 'patient_id' })
  declare patientId: string

  @column({ columnName: 'clinic_id' })
  declare clinicId: string

  @column({ columnName: 'patient_clinic_id' })
  declare patientClinicId: string

  @column({ columnName: 'clinic_professional_id' })
  declare clinicProfessionalId: string

  @column({ columnName: 'appointment_id' })
  declare appointmentId: string | null

  @column({ columnName: 'author_user_id' })
  declare authorUserId: string

  @column({ columnName: 'entry_type_code' })
  declare entryTypeCode: MedicalRecordEntryType

  @column()
  declare content: string

  @computed()
  get contentFormat() {
    return MEDICAL_RECORD_CONTENT_FORMAT
  }

  @computed()
  get contentFormatVersion() {
    return MEDICAL_RECORD_CONTENT_FORMAT_VERSION
  }

  @column({ columnName: 'corrects_entry_id' })
  declare correctsEntryId: string | null

  @column.dateTime({
    autoCreate: true,
    columnName: 'created_at',
  })
  declare createdAt: DateTime

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

  @belongsTo(() => PatientClinic, {
    foreignKey: 'patientClinicId',
  })
  declare patientClinic: BelongsTo<typeof PatientClinic>

  @belongsTo(() => ClinicProfessional, {
    foreignKey: 'clinicProfessionalId',
  })
  declare clinicProfessional: BelongsTo<typeof ClinicProfessional>

  @belongsTo(() => Appointment, {
    foreignKey: 'appointmentId',
  })
  declare appointment: BelongsTo<typeof Appointment>

  @belongsTo(() => User, {
    foreignKey: 'authorUserId',
  })
  declare authorUser: BelongsTo<typeof User>

  @belongsTo(() => MedicalRecordEntry, {
    foreignKey: 'correctsEntryId',
  })
  declare correctedEntry: BelongsTo<typeof MedicalRecordEntry>

  @hasMany(() => MedicalRecordEntry, {
    foreignKey: 'correctsEntryId',
  })
  declare corrections: HasMany<typeof MedicalRecordEntry>

  @hasMany(() => MedicalRecordAttachment, {
    foreignKey: 'medicalRecordEntryId',
  })
  declare attachments: HasMany<typeof MedicalRecordAttachment>
}
