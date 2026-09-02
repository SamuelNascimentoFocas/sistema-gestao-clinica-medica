import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.withSchema('clinic').createTable('auth_access_tokens', (table) => {
      table.increments('id')
      table
        .uuid('tokenable_id')
        .notNullable()
        .references('id')
        .inTable('clinic.users')
        .onDelete('CASCADE')
      table.string('type').notNullable()
      table.string('name').nullable()
      table.string('hash').notNullable()
      table.text('abilities').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.timestamp('last_used_at', { useTz: true }).nullable()
      table.timestamp('expires_at', { useTz: true }).nullable()

      table.index(['tokenable_id', 'type'], 'auth_access_tokens_user_type_idx')
      table.index(['hash'], 'auth_access_tokens_hash_idx')
      table.index(['expires_at'], 'auth_access_tokens_expires_at_idx')
    })
  }

  async down() {
    this.schema.withSchema('clinic').dropTable('auth_access_tokens')
  }
}
