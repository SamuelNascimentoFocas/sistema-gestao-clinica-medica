import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.withSchema('clinic').createTable('patient_clinics', (table) => {
      table.uuid('id').primary().defaultTo(this.db.getWriteClient().fn.uuid())
      table
        .uuid('patient_id')
        .notNullable()
        .references('id')
        .inTable('clinic.patients')
        .onDelete('RESTRICT')
      table
        .uuid('clinic_id')
        .notNullable()
        .references('id')
        .inTable('clinic.clinics')
        .onDelete('RESTRICT')
      table.string('local_record_number', 60).nullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['patient_id', 'clinic_id'], {
        indexName: 'patient_clinics_patient_clinic_unique',
      })
      table.unique(['clinic_id', 'local_record_number'], {
        indexName: 'patient_clinics_local_record_unique',
      })
      // Referenced by the composite foreign keys for the clinical context.
      table.unique(['clinic_id', 'id'], { indexName: 'patient_clinics_clinic_id_id_unique' })
      table.unique(['clinic_id', 'patient_id', 'id'], {
        indexName: 'patient_clinics_clinic_patient_id_unique',
      })
      table.index(['clinic_id', 'is_active'], 'patient_clinics_clinic_active_idx')
      table.index(['patient_id'], 'patient_clinics_patient_idx')
      table.check(
        "local_record_number IS NULL OR btrim(local_record_number) <> ''",
        [],
        'patient_clinics_local_record_not_blank'
      )
    })
  }

  async down() {
    this.schema.withSchema('clinic').dropTable('patient_clinics')
  }
}
