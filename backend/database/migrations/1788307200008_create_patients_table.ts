import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.withSchema('clinic').createTable('patients', (table) => {
      table.uuid('id').primary().defaultTo(this.db.getWriteClient().fn.uuid())
      table.string('full_name', 180).notNullable()
      table.date('birth_date').notNullable()
      table.string('cpf', 11).nullable()
      table.string('phone', 20).nullable()
      table.string('email', 254).nullable()
      table.string('address_street', 180).nullable()
      table.string('address_number', 30).nullable()
      table.string('address_complement', 120).nullable()
      table.string('address_neighborhood', 120).nullable()
      table.string('address_city', 120).nullable()
      table.string('address_state', 2).nullable()
      table.string('address_postal_code', 8).nullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['cpf'], { indexName: 'patients_cpf_unique' })
      table.index(['full_name'], 'patients_full_name_idx')
      table.index(['birth_date'], 'patients_birth_date_idx')
      table.index(['is_active'], 'patients_is_active_idx')
      table.check("btrim(full_name) <> ''", [], 'patients_full_name_not_blank')
      table.check("cpf IS NULL OR cpf ~ '^[0-9]{11}$'", [], 'patients_cpf_digits')
      table.check("phone IS NULL OR btrim(phone) <> ''", [], 'patients_phone_not_blank')
      table.check("email IS NULL OR btrim(email) <> ''", [], 'patients_email_not_blank')
      table.check(
        "address_state IS NULL OR address_state ~ '^[A-Z]{2}$'",
        [],
        'patients_address_state_format'
      )
      table.check(
        "address_postal_code IS NULL OR address_postal_code ~ '^[0-9]{8}$'",
        [],
        'patients_postal_code_digits'
      )
    })
  }

  async down() {
    this.schema.withSchema('clinic').dropTable('patients')
  }
}
