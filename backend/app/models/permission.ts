import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import Role from '#models/role'

export default class Permission extends BaseModel {
  static table = 'clinic.permissions'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare code: string

  @column()
  declare description: string

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

  @manyToMany(() => Role, {
    pivotTable: 'clinic.role_permissions',
    pivotForeignKey: 'permission_id',
    pivotRelatedForeignKey: 'role_id',
  })
  declare roles: ManyToMany<typeof Role>
}
