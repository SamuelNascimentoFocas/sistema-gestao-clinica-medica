import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import MedicalRecord from '#models/medical_record'
import Patient from '#models/patient'
import Clinic from '#models/clinic'
import PatientClinic from '#models/patient_clinic'
import User from '#models/user'
import MedicalRecordAttachment from '#models/medical_record_attachment'

export type MedicalRecordAccessAction =
  'view_timeline' | 'view_entry' | 'list_attachments' | 'download_attachment'

export type MedicalRecordAccessPurpose =
  'patient_care' | 'care_coordination' | 'legal_obligation' | 'other'

export default class MedicalRecordAccessLog extends BaseModel {
  static table = 'clinic.medical_record_access_logs'

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

  @column({ columnName: 'user_id' })
  declare userId: string

  @column({ columnName: 'medical_record_attachment_id' })
  declare medicalRecordAttachmentId: string | null

  @column({ columnName: 'access_action' })
  declare accessAction: MedicalRecordAccessAction

  @column({ columnName: 'purpose_code' })
  declare purposeCode: MedicalRecordAccessPurpose

  @column({ columnName: 'purpose_note' })
  declare purposeNote: string | null

  @column.dateTime({
    autoCreate: true,
    columnName: 'accessed_at',
  })
  declare accessedAt: DateTime

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

  @belongsTo(() => User, {
    foreignKey: 'userId',
  })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => MedicalRecordAttachment, {
    foreignKey: 'medicalRecordAttachmentId',
  })
  declare medicalRecordAttachment: BelongsTo<typeof MedicalRecordAttachment>
}
