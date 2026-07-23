import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, hasOne } from '@adonisjs/lucid/orm'
import type { HasMany, HasOne } from '@adonisjs/lucid/types/relations'
import PatientClinic from '#models/patient_clinic'
import MedicalRecord from '#models/medical_record'

export default class Patient extends BaseModel {
  static table = 'clinic.patients'

  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'full_name' })
  declare fullName: string

  @column.date({ columnName: 'birth_date' })
  declare birthDate: DateTime

  @column()
  declare cpf: string | null

  @column()
  declare phone: string | null

  @column()
  declare email: string | null

  @column({ columnName: 'address_street' })
  declare addressStreet: string | null

  @column({ columnName: 'address_number' })
  declare addressNumber: string | null

  @column({ columnName: 'address_complement' })
  declare addressComplement: string | null

  @column({ columnName: 'address_neighborhood' })
  declare addressNeighborhood: string | null

  @column({ columnName: 'address_city' })
  declare addressCity: string | null

  @column({ columnName: 'address_state' })
  declare addressState: string | null

  @column({ columnName: 'address_postal_code' })
  declare addressPostalCode: string | null

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

  @hasMany(() => PatientClinic, {
    foreignKey: 'patientId',
  })
  declare clinicLinks: HasMany<typeof PatientClinic>

  @hasOne(() => MedicalRecord, {
    foreignKey: 'patientId',
  })
  declare medicalRecord: HasOne<typeof MedicalRecord>
}
