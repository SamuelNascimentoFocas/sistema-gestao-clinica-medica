import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.withSchema('clinic').createTable('users', (table) => {
      table.uuid('id').primary().defaultTo(this.db.getWriteClient().fn.uuid())
      table.string('full_name', 180).notNullable()
      table.string('email', 254).notNullable()
      table.string('email_normalized', 254).notNullable()
      table.text('password_hash').notNullable()
      table.boolean('is_global_admin').notNullable().defaultTo(false)
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('last_login_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['email_normalized'], { indexName: 'users_email_normalized_unique' })
      table.index(['is_active'], 'users_is_active_idx')
      table.check("btrim(full_name) <> ''", [], 'users_full_name_not_blank')
      table.check("btrim(email) <> ''", [], 'users_email_not_blank')
      table.check("btrim(email_normalized) <> ''", [], 'users_email_normalized_not_blank')
      table.check(
        'email_normalized = lower(btrim(email_normalized))',
        [],
        'users_email_normalized_canonical'
      )
    })
  }

  async down() {
    this.schema.withSchema('clinic').dropTable('users')
  }
}
