import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'medical_record_access_logs'

  async up() {
    this.schema.withSchema('clinic').createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.getWriteClient().fn.uuid())
      table.uuid('medical_record_id').notNullable()
      table.uuid('patient_id').notNullable()
      table.uuid('clinic_id').notNullable()
      table.uuid('patient_clinic_id').notNullable()
      table
        .uuid('user_id')
        .notNullable()
        .references('id')
        .inTable('clinic.users')
        .onDelete('RESTRICT')
      table.string('access_action', 30).notNullable()
      table.string('purpose_code', 30).notNullable()
      table.string('purpose_note', 500).nullable()
      table.timestamp('accessed_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.uuid('medical_record_attachment_id').nullable()

      table.index(
        ['medical_record_id', 'accessed_at'],
        'medical_record_access_logs_record_time_idx'
      )
      table.index(['clinic_id', 'accessed_at'], 'medical_record_access_logs_clinic_time_idx')
      table.index(['user_id', 'accessed_at'], 'medical_record_access_logs_user_time_idx')
      table.index(['medical_record_attachment_id'], 'medical_record_access_logs_attachment_idx')

      table
        .foreign(
          ['patient_id', 'medical_record_id'],
          'medical_record_access_logs_record_scope_foreign'
        )
        .references(['patient_id', 'id'])
        .inTable('clinic.medical_records')
        .onDelete('RESTRICT')
      table
        .foreign(
          ['clinic_id', 'patient_id', 'patient_clinic_id'],
          'medical_record_access_logs_patient_clinic_scope_foreign'
        )
        .references(['clinic_id', 'patient_id', 'id'])
        .inTable('clinic.patient_clinics')
        .onDelete('RESTRICT')
      table
        .foreign(
          ['clinic_id', 'patient_id', 'medical_record_id', 'medical_record_attachment_id'],
          'medical_record_access_logs_attachment_scope_foreign'
        )
        .references(['clinic_id', 'patient_id', 'medical_record_id', 'id'])
        .inTable('clinic.medical_record_attachments')
        .onDelete('RESTRICT')

      table.check(
        "access_action IN ('view_timeline', 'view_entry', 'list_attachments', 'download_attachment')",
        [],
        'medical_record_access_logs_action_valid'
      )
      table.check(
        "purpose_code IN ('patient_care', 'care_coordination', 'legal_obligation', 'other')",
        [],
        'medical_record_access_logs_purpose_valid'
      )
      table.check(
        "purpose_note IS NULL OR btrim(purpose_note) <> ''",
        [],
        'medical_record_access_logs_purpose_note_not_blank'
      )
      table.check(
        "purpose_code <> 'other' OR purpose_note IS NOT NULL",
        [],
        'medical_record_access_logs_other_purpose_consistency'
      )
      table.check(
        "(access_action = 'download_attachment' AND medical_record_attachment_id IS NOT NULL) OR (access_action <> 'download_attachment' AND medical_record_attachment_id IS NULL)",
        [],
        'medical_record_access_logs_attachment_consistency'
      )
    })
  }

  async down() {
    this.schema.withSchema('clinic').dropTable(this.tableName)
  }
}
