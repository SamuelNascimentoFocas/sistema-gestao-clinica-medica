import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.withSchema('clinic').createTable('role_permissions', (table) => {
      table
        .uuid('role_id')
        .notNullable()
        .references('id')
        .inTable('clinic.roles')
        .onDelete('CASCADE')
      table
        .uuid('permission_id')
        .notNullable()
        .references('id')
        .inTable('clinic.permissions')
        .onDelete('CASCADE')
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.primary(['role_id', 'permission_id'])
      table.index(['permission_id'], 'role_permissions_permission_idx')
    })
  }

  async down() {
    this.schema.withSchema('clinic').dropTable('role_permissions')
  }
}
