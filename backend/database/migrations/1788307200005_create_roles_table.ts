import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.withSchema('clinic').createTable('roles', (table) => {
      table.uuid('id').primary().defaultTo(this.db.getWriteClient().fn.uuid())
      table.string('code', 60).notNullable()
      table.string('name', 120).notNullable()
      table.string('description', 255).nullable()
      table.boolean('is_system').notNullable().defaultTo(false)
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['code'], { indexName: 'roles_code_unique' })
      table.check("code ~ '^[a-z][a-z0-9_]*$'", [], 'roles_code_format')
      table.check("btrim(name) <> ''", [], 'roles_name_not_blank')
    })
  }

  async down() {
    this.schema.withSchema('clinic').dropTable('roles')
  }
}
