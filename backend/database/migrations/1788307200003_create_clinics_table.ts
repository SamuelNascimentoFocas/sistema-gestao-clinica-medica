import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.withSchema('clinic').createTable('clinics', (table) => {
      table.uuid('id').primary().defaultTo(this.db.getWriteClient().fn.uuid())
      table.string('name', 180).notNullable()
      table.string('cnpj', 14).nullable()
      table.string('phone', 20).nullable()
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
      table.string('timezone', 100).notNullable().defaultTo('America/Sao_Paulo')

      table.unique(['cnpj'], { indexName: 'clinics_cnpj_unique' })
      table.check("btrim(name) <> ''", [], 'clinics_name_not_blank')
      table.check("cnpj IS NULL OR cnpj ~ '^[0-9]{14}$'", [], 'clinics_cnpj_digits')
      table.check(
        "address_state IS NULL OR address_state ~ '^[A-Z]{2}$'",
        [],
        'clinics_address_state_format'
      )
      table.check(
        "address_postal_code IS NULL OR address_postal_code ~ '^[0-9]{8}$'",
        [],
        'clinics_postal_code_digits'
      )
      table.check("btrim(timezone) <> ''", [], 'clinics_timezone_not_blank')
    })
  }

  async down() {
    this.schema.withSchema('clinic').dropTable('clinics')
  }
}
