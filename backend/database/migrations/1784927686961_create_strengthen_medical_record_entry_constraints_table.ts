import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      ALTER TABLE clinic.medical_record_entries
      DROP CONSTRAINT medical_record_entries_content_not_blank,
      ADD CONSTRAINT medical_record_entries_content_length
        CHECK (
          char_length(btrim(content))
          BETWEEN 1 AND 20000
        )
    `)

    this.schema.raw(`
      DROP INDEX clinic.medical_record_entries_correction_idx
    `)

    this.schema.raw(`
      ALTER TABLE clinic.medical_record_entries
      ADD CONSTRAINT medical_record_entries_corrects_entry_unique
        UNIQUE (corrects_entry_id)
    `)
  }

  async down() {
    this.schema.raw(`
      ALTER TABLE clinic.medical_record_entries
      DROP CONSTRAINT medical_record_entries_corrects_entry_unique
    `)

    this.schema.raw(`
      CREATE INDEX medical_record_entries_correction_idx
      ON clinic.medical_record_entries (corrects_entry_id)
    `)

    this.schema.raw(`
      ALTER TABLE clinic.medical_record_entries
      DROP CONSTRAINT medical_record_entries_content_length,
      ADD CONSTRAINT medical_record_entries_content_not_blank
        CHECK (btrim(content) <> '')
    `)
  }
}
