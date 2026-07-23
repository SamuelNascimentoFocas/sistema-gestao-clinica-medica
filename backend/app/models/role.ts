import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import Permission from '#models/permission'
import UserClinicRole from '#models/user_clinic_role'

export default class Role extends BaseModel {
  static table = 'clinic.roles'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare code: string

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column({ columnName: 'is_system' })
  declare isSystem: boolean

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

  @manyToMany(() => Permission, {
    pivotTable: 'clinic.role_permissions',
    pivotForeignKey: 'role_id',
    pivotRelatedForeignKey: 'permission_id',
  })
  declare permissions: ManyToMany<typeof Permission>

  @hasMany(() => UserClinicRole, {
    foreignKey: 'roleId',
  })
  declare userRoles: HasMany<typeof UserClinicRole>
}
