import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'medical_record_attachments'

  async up() {
    this.schema.withSchema('clinic').createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.getWriteClient().fn.uuid())
      table.uuid('medical_record_entry_id').notNullable()
      table.uuid('medical_record_id').notNullable()
      table.uuid('patient_id').notNullable()
      table.uuid('clinic_id').notNullable()
      table.uuid('uploaded_by_user_id').notNullable()
      table.string('original_name', 255).notNullable()
      table.string('storage_disk', 50).notNullable()
      table.string('storage_key', 500).notNullable()
      table.string('content_type', 255).notNullable()
      table.integer('size_in_bytes').notNullable()
      table.string('sha256', 64).notNullable()
      table.string('status', 30).notNullable().defaultTo('pending')
      table.string('status_reason', 500).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['storage_disk', 'storage_key'], {
        indexName: 'medical_record_attachments_storage_unique',
      })
      table.unique(['clinic_id', 'patient_id', 'medical_record_id', 'id'], {
        indexName: 'medical_record_attachments_access_scope_unique',
      })
      table
        .foreign(
          ['clinic_id', 'medical_record_id', 'patient_id', 'medical_record_entry_id'],
          'medical_record_attachments_entry_scope_foreign'
        )
        .references(['clinic_id', 'medical_record_id', 'patient_id', 'id'])
        .inTable('clinic.medical_record_entries')
        .onDelete('RESTRICT')
      table
        .foreign('uploaded_by_user_id', 'medical_record_attachments_uploaded_by_user_foreign')
        .references('id')
        .inTable('clinic.users')
        .onDelete('RESTRICT')

      table.check(
        "btrim(original_name) <> ''",
        [],
        'medical_record_attachments_original_name_not_blank'
      )
      table.check(
        "btrim(storage_disk) <> ''",
        [],
        'medical_record_attachments_storage_disk_not_blank'
      )
      table.check(
        "btrim(storage_key) <> ''",
        [],
        'medical_record_attachments_storage_key_not_blank'
      )
      table.check(
        "btrim(content_type) <> ''",
        [],
        'medical_record_attachments_content_type_not_blank'
      )
      table.check(
        'size_in_bytes BETWEEN 1 AND 10485760',
        [],
        'medical_record_attachments_size_valid'
      )
      table.check("sha256 ~ '^[0-9a-f]{64}$'", [], 'medical_record_attachments_sha256_format')
      table.check(
        "status IN ('pending', 'available', 'rejected')",
        [],
        'medical_record_attachments_status_valid'
      )
      table.check(
        "status_reason IS NULL OR btrim(status_reason) <> ''",
        [],
        'medical_record_attachments_status_reason_not_blank'
      )
      table.check(
        "(status = 'rejected' AND status_reason IS NOT NULL) OR (status <> 'rejected' AND status_reason IS NULL)",
        [],
        'medical_record_attachments_rejection_consistency'
      )

      table.index(
        ['medical_record_entry_id', 'created_at'],
        'medical_record_attachments_entry_created_idx'
      )
      table.index(
        ['medical_record_id', 'created_at'],
        'medical_record_attachments_record_created_idx'
      )
      table.index(['clinic_id', 'created_at'], 'medical_record_attachments_clinic_created_idx')
      table.index(['status'], 'medical_record_attachments_status_idx')
    })
  }

  async down() {
    this.schema.withSchema('clinic').dropTable(this.tableName)
  }
}
