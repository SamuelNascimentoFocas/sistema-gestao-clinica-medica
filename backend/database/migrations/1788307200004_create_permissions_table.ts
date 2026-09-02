import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.withSchema('clinic').createTable('permissions', (table) => {
      table.uuid('id').primary().defaultTo(this.db.getWriteClient().fn.uuid())
      table.string('code', 100).notNullable()
      table.string('description', 255).notNullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['code'], { indexName: 'permissions_code_unique' })
      table.check("code ~ '^[a-z][a-z0-9_]*([.][a-z][a-z0-9_]*)+$'", [], 'permissions_code_format')
      table.check("btrim(description) <> ''", [], 'permissions_description_not_blank')
    })
  }

  async down() {
    this.schema.withSchema('clinic').dropTable('permissions')
  }
}
