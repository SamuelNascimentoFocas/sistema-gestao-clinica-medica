import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'medical_record_entries'

  async up() {
    this.schema.withSchema('clinic').createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.getWriteClient().fn.uuid())
      table.uuid('medical_record_id').notNullable()
      table.uuid('patient_id').notNullable()
      table.uuid('clinic_id').notNullable()
      table.uuid('patient_clinic_id').notNullable()
      table.uuid('clinic_professional_id').notNullable()
      table.uuid('appointment_id').nullable()
      table
        .uuid('author_user_id')
        .notNullable()
        .references('id')
        .inTable('clinic.users')
        .onDelete('RESTRICT')
      table.string('entry_type_code', 30).notNullable()
      table.text('content').notNullable()
      table.uuid('corrects_entry_id').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['medical_record_id', 'id'], {
        indexName: 'medical_record_entries_record_id_unique',
      })
      table.unique(['corrects_entry_id'], {
        indexName: 'medical_record_entries_corrects_entry_unique',
      })
      table.unique(['clinic_id', 'medical_record_id', 'patient_id', 'id'], {
        indexName: 'medical_record_entries_attachment_scope_unique',
      })
      table.index(['medical_record_id', 'created_at'], 'medical_record_entries_timeline_idx')
      table.index(['clinic_id', 'created_at'], 'medical_record_entries_clinic_created_idx')
      table.index(['appointment_id'], 'medical_record_entries_appointment_idx')

      table
        .foreign(['patient_id', 'medical_record_id'], 'medical_record_entries_record_scope_foreign')
        .references(['patient_id', 'id'])
        .inTable('clinic.medical_records')
        .onDelete('RESTRICT')
      table
        .foreign(
          ['clinic_id', 'patient_id', 'patient_clinic_id'],
          'medical_record_entries_patient_clinic_scope_foreign'
        )
        .references(['clinic_id', 'patient_id', 'id'])
        .inTable('clinic.patient_clinics')
        .onDelete('RESTRICT')
      table
        .foreign(
          ['clinic_id', 'clinic_professional_id'],
          'medical_record_entries_professional_scope_foreign'
        )
        .references(['clinic_id', 'id'])
        .inTable('clinic.clinic_professionals')
        .onDelete('RESTRICT')
      table
        .foreign(
          ['clinic_id', 'patient_clinic_id', 'clinic_professional_id', 'appointment_id'],
          'medical_record_entries_appointment_scope_foreign'
        )
        .references(['clinic_id', 'patient_clinic_id', 'clinic_professional_id', 'id'])
        .inTable('clinic.appointments')
        .onDelete('RESTRICT')
      table
        .foreign(
          ['medical_record_id', 'corrects_entry_id'],
          'medical_record_entries_correction_scope_foreign'
        )
        .references(['medical_record_id', 'id'])
        .inTable('clinic.medical_record_entries')
        .onDelete('RESTRICT')

      table.check(
        "entry_type_code IN ('consultation', 'evolution', 'correction', 'other')",
        [],
        'medical_record_entries_type_valid'
      )
      table.check(
        'char_length(btrim(content)) BETWEEN 1 AND 20000',
        [],
        'medical_record_entries_content_length'
      )
      table.check(
        "(entry_type_code = 'correction' AND corrects_entry_id IS NOT NULL) OR (entry_type_code <> 'correction' AND corrects_entry_id IS NULL)",
        [],
        'medical_record_entries_correction_consistency'
      )
    })
  }

  async down() {
    this.schema.withSchema('clinic').dropTable(this.tableName)
  }
}
