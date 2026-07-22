import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected schemaName = 'clinic'
  protected tableName = 'users'

  async up() {
    this.schema.withSchema(this.schemaName).createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('full_name', 180).notNullable()
      table.string('email', 254).notNullable()
      table.string('email_normalized', 254).notNullable()
      table.text('password_hash').notNullable()
      table.boolean('is_global_admin').notNullable().defaultTo(false)
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('last_login_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['email_normalized'], {
        indexName: 'users_email_normalized_unique',
      })

      table.index(['is_active'], 'users_is_active_idx')
    })

    this.schema.raw(`
      ALTER TABLE clinic.users
      ADD CONSTRAINT users_full_name_not_blank
        CHECK (btrim(full_name) <> ''),
      ADD CONSTRAINT users_email_not_blank
        CHECK (btrim(email) <> ''),
      ADD CONSTRAINT users_email_normalized_not_blank
        CHECK (btrim(email_normalized) <> ''),
      ADD CONSTRAINT users_email_normalized_canonical
        CHECK (email_normalized = lower(btrim(email_normalized)))
    `)
  }

  async down() {
    this.schema.withSchema(this.schemaName).dropTable(this.tableName)
  }
}
