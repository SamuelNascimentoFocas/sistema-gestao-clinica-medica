import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.withSchema('clinic').createTable('professionals', (table) => {
      table.uuid('id').primary().defaultTo(this.db.getWriteClient().fn.uuid())
      table.uuid('user_id').nullable().references('id').inTable('clinic.users').onDelete('SET NULL')
      table.string('full_name', 180).notNullable()
      table.string('crm_number', 30).notNullable()
      table.string('crm_state', 2).notNullable()
      table.string('specialty', 120).notNullable()
      table.string('phone', 20).nullable()
      table.string('email', 254).nullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['user_id'], { indexName: 'professionals_user_unique' })
      table.unique(['crm_state', 'crm_number'], { indexName: 'professionals_crm_unique' })
      table.index(['full_name'], 'professionals_full_name_idx')
      table.index(['specialty'], 'professionals_specialty_idx')
      table.index(['is_active'], 'professionals_is_active_idx')
      table.check("btrim(full_name) <> ''", [], 'professionals_full_name_not_blank')
      table.check("btrim(crm_number) <> ''", [], 'professionals_crm_number_not_blank')
      table.check("crm_state ~ '^[A-Z]{2}$'", [], 'professionals_crm_state_format')
      table.check("btrim(specialty) <> ''", [], 'professionals_specialty_not_blank')
      table.check("phone IS NULL OR btrim(phone) <> ''", [], 'professionals_phone_not_blank')
      table.check("email IS NULL OR btrim(email) <> ''", [], 'professionals_email_not_blank')
    })
  }

  async down() {
    this.schema.withSchema('clinic').dropTable('professionals')
  }
}
