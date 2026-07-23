import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import UserClinicRole from '#models/user_clinic_role'
import PatientClinic from '#models/patient_clinic'
import ClinicProfessional from '#models/clinic_professional'

export default class Clinic extends BaseModel {
  static table = 'clinic.clinics'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column()
  declare cnpj: string | null

  @column()
  declare phone: string | null

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

  @column()
  declare timezone: string

  @hasMany(() => UserClinicRole, {
    foreignKey: 'clinicId',
  })
  declare userRoles: HasMany<typeof UserClinicRole>

  @hasMany(() => PatientClinic, {
    foreignKey: 'clinicId',
  })
  declare patientLinks: HasMany<typeof PatientClinic>

  @hasMany(() => ClinicProfessional, {
    foreignKey: 'clinicId',
  })
  declare professionalLinks: HasMany<typeof ClinicProfessional>
}
