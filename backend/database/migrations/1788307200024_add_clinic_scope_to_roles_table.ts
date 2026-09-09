import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    const unscopedCustomRole = await this.db.from('clinic.roles').where('is_system', false).first()

    if (unscopedCustomRole) {
      throw new Error(
        'Cannot add clinic scope: non-system roles already exist and require explicit clinic mapping'
      )
    }

    this.schema.withSchema('clinic').alterTable('roles', (table) => {
      table.uuid('clinic_id').nullable()
      table
        .foreign('clinic_id', 'roles_clinic_id_foreign')
        .references('id')
        .inTable('clinic.clinics')
        .onDelete('RESTRICT')
      table.index(['clinic_id'], 'roles_clinic_idx')
      table.check(
        '(is_system = true AND clinic_id IS NULL) OR (is_system = false AND clinic_id IS NOT NULL)',
        [],
        'roles_system_scope_consistency'
      )
    })

    // PostgreSQL partial functional indexes are not represented by the schema builder.
    this.schema.raw(`
      CREATE UNIQUE INDEX roles_custom_clinic_name_unique
      ON clinic.roles (clinic_id, lower(btrim(name)))
      WHERE is_system = false
    `)
  }

  async down() {
    const customRole = await this.db.from('clinic.roles').where('is_system', false).first()

    if (customRole) {
      throw new Error('Cannot remove clinic scope while custom roles exist')
    }

    this.schema.raw('DROP INDEX clinic.roles_custom_clinic_name_unique')

    this.schema.withSchema('clinic').alterTable('roles', (table) => {
      table.dropChecks('roles_system_scope_consistency')
      table.dropForeign(['clinic_id'], 'roles_clinic_id_foreign')
      table.dropIndex(['clinic_id'], 'roles_clinic_idx')
      table.dropColumn('clinic_id')
    })
  }
}
