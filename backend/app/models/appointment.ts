import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasOne } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasOne } from '@adonisjs/lucid/types/relations'
import Clinic from '#models/clinic'
import PatientClinic from '#models/patient_clinic'
import ClinicProfessional from '#models/clinic_professional'
import User from '#models/user'

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'

export type AppointmentCancellationReason =
  | 'patient_request'
  | 'professional_unavailable'
  | 'clinic_request'
  | 'duplicate'
  | 'created_by_mistake'
  | 'rescheduled'
  | 'other'

export default class Appointment extends BaseModel {
  static table = 'clinic.appointments'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'clinic_id' })
  declare clinicId: string

  @column({ columnName: 'patient_clinic_id' })
  declare patientClinicId: string

  @column({ columnName: 'clinic_professional_id' })
  declare clinicProfessionalId: string

  @column.dateTime({ columnName: 'starts_at' })
  declare startsAt: DateTime

  @column.dateTime({ columnName: 'ends_at' })
  declare endsAt: DateTime

  @column()
  declare status: AppointmentStatus

  @column()
  declare version: number

  @column({ columnName: 'appointment_type_code' })
  declare appointmentTypeCode: string | null

  @column({ columnName: 'administrative_note' })
  declare administrativeNote: string | null

  @column({ columnName: 'created_by_user_id' })
  declare createdByUserId: string

  @column.dateTime({ columnName: 'confirmed_at' })
  declare confirmedAt: DateTime | null

  @column({ columnName: 'confirmed_by_user_id' })
  declare confirmedByUserId: string | null

  @column.dateTime({ columnName: 'completed_at' })
  declare completedAt: DateTime | null

  @column({ columnName: 'completed_by_user_id' })
  declare completedByUserId: string | null

  @column.dateTime({ columnName: 'cancelled_at' })
  declare cancelledAt: DateTime | null

  @column({ columnName: 'cancelled_by_user_id' })
  declare cancelledByUserId: string | null

  @column({ columnName: 'cancellation_reason_code' })
  declare cancellationReasonCode: AppointmentCancellationReason | null

  @column({ columnName: 'cancellation_note' })
  declare cancellationNote: string | null

  @column.dateTime({ columnName: 'no_show_at' })
  declare noShowAt: DateTime | null

  @column({ columnName: 'no_show_by_user_id' })
  declare noShowByUserId: string | null

  @column({ columnName: 'rescheduled_from_appointment_id' })
  declare rescheduledFromAppointmentId: string | null

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

  @belongsTo(() => PatientClinic, {
    foreignKey: 'patientClinicId',
  })
  declare patientClinic: BelongsTo<typeof PatientClinic>

  @belongsTo(() => ClinicProfessional, {
    foreignKey: 'clinicProfessionalId',
  })
  declare clinicProfessional: BelongsTo<typeof ClinicProfessional>

  @belongsTo(() => User, {
    foreignKey: 'createdByUserId',
  })
  declare createdByUser: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'confirmedByUserId',
  })
  declare confirmedByUser: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'completedByUserId',
  })
  declare completedByUser: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'cancelledByUserId',
  })
  declare cancelledByUser: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'noShowByUserId',
  })
  declare noShowByUser: BelongsTo<typeof User>

  @belongsTo(() => Appointment, {
    foreignKey: 'rescheduledFromAppointmentId',
  })
  declare rescheduledFrom: BelongsTo<typeof Appointment>

  @hasOne(() => Appointment, {
    foreignKey: 'rescheduledFromAppointmentId',
  })
  declare rescheduledTo: HasOne<typeof Appointment>
}
