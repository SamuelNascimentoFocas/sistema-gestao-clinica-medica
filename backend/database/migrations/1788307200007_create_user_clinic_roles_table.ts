import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.withSchema('clinic').createTable('user_clinic_roles', (table) => {
      table.uuid('id').primary().defaultTo(this.db.getWriteClient().fn.uuid())
      table
        .uuid('user_id')
        .notNullable()
        .references('id')
        .inTable('clinic.users')
        .onDelete('CASCADE')
      table
        .uuid('clinic_id')
        .notNullable()
        .references('id')
        .inTable('clinic.clinics')
        .onDelete('CASCADE')
      table
        .uuid('role_id')
        .notNullable()
        .references('id')
        .inTable('clinic.roles')
        .onDelete('RESTRICT')
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['user_id', 'clinic_id'], {
        indexName: 'user_clinic_roles_user_clinic_unique',
      })
      table.index(['clinic_id'], 'user_clinic_roles_clinic_idx')
      table.index(['role_id'], 'user_clinic_roles_role_idx')
    })
  }

  async down() {
    this.schema.withSchema('clinic').dropTable('user_clinic_roles')
  }
}
