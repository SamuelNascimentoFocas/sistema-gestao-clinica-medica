import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.withSchema('clinic').createTable('clinic_professionals', (table) => {
      table.uuid('id').primary().defaultTo(this.db.getWriteClient().fn.uuid())
      table
        .uuid('clinic_id')
        .notNullable()
        .references('id')
        .inTable('clinic.clinics')
        .onDelete('RESTRICT')
      table
        .uuid('professional_id')
        .notNullable()
        .references('id')
        .inTable('clinic.professionals')
        .onDelete('RESTRICT')
      table.string('local_code', 60).nullable()
      table.integer('default_appointment_duration_minutes').notNullable().defaultTo(30)
      table.boolean('accepts_appointments').notNullable().defaultTo(true)
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['clinic_id', 'professional_id'], {
        indexName: 'clinic_professionals_clinic_professional_unique',
      })
      table.unique(['clinic_id', 'local_code'], {
        indexName: 'clinic_professionals_local_code_unique',
      })
      table.unique(['clinic_id', 'id'], {
        indexName: 'clinic_professionals_clinic_id_id_unique',
      })
      table.index(['clinic_id', 'is_active'], 'clinic_professionals_clinic_active_idx')
      table.index(['professional_id'], 'clinic_professionals_professional_idx')
      table.check(
        "local_code IS NULL OR btrim(local_code) <> ''",
        [],
        'clinic_professionals_local_code_not_blank'
      )
      table.check(
        'default_appointment_duration_minutes BETWEEN 5 AND 480',
        [],
        'clinic_professionals_duration_range'
      )
    })
  }

  async down() {
    this.schema.withSchema('clinic').dropTable('clinic_professionals')
  }
}
