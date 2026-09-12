import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.withSchema('clinic').createTable('medical_records', (table) => {
      table.uuid('id').primary().defaultTo(this.db.getWriteClient().fn.uuid())
      table
        .uuid('patient_id')
        .notNullable()
        .references('id')
        .inTable('clinic.patients')
        .onDelete('RESTRICT')
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['patient_id'], { indexName: 'medical_records_patient_unique' })
      table.unique(['patient_id', 'id'], {
        indexName: 'medical_records_patient_id_id_unique',
      })
    })
  }

  async down() {
    this.schema.withSchema('clinic').dropTable('medical_records')
  }
}
