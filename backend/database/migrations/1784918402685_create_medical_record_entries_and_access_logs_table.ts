import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected schemaName = 'clinic'

  async up() {
    /*
     * Chaves auxiliares usadas pelas foreign keys compostas.
     *
     * Elas permitem que o próprio PostgreSQL comprove que prontuário,
     * paciente, consultório, profissional e agendamento pertencem ao
     * mesmo contexto.
     */
    this.schema.raw(`
      ALTER TABLE clinic.medical_records
      ADD CONSTRAINT medical_records_patient_id_id_unique
        UNIQUE (patient_id, id)
    `)

    this.schema.raw(`
      ALTER TABLE clinic.patient_clinics
      ADD CONSTRAINT patient_clinics_clinic_patient_id_unique
        UNIQUE (clinic_id, patient_id, id)
    `)

    this.schema.raw(`
      ALTER TABLE clinic.appointments
      ADD CONSTRAINT appointments_clinical_context_unique
        UNIQUE (
          clinic_id,
          patient_clinic_id,
          clinic_professional_id,
          id
        )
    `)

    this.schema.withSchema(this.schemaName).createTable('medical_record_entries', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))

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

      table
        .timestamp('created_at', {
          useTz: true,
        })
        .notNullable()
        .defaultTo(this.now())

      table.unique(['medical_record_id', 'id'], {
        indexName: 'medical_record_entries_record_id_unique',
      })

      table.index(['medical_record_id', 'created_at'], 'medical_record_entries_timeline_idx')

      table.index(['clinic_id', 'created_at'], 'medical_record_entries_clinic_created_idx')

      table.index(['appointment_id'], 'medical_record_entries_appointment_idx')

      table.index(['corrects_entry_id'], 'medical_record_entries_correction_idx')
    })

    this.schema.raw(`
      ALTER TABLE clinic.medical_record_entries
      ADD CONSTRAINT medical_record_entries_record_scope_foreign
        FOREIGN KEY (patient_id, medical_record_id)
        REFERENCES clinic.medical_records(patient_id, id)
        ON DELETE RESTRICT,

      ADD CONSTRAINT medical_record_entries_patient_clinic_scope_foreign
        FOREIGN KEY (clinic_id, patient_id, patient_clinic_id)
        REFERENCES clinic.patient_clinics(clinic_id, patient_id, id)
        ON DELETE RESTRICT,

      ADD CONSTRAINT medical_record_entries_professional_scope_foreign
        FOREIGN KEY (clinic_id, clinic_professional_id)
        REFERENCES clinic.clinic_professionals(clinic_id, id)
        ON DELETE RESTRICT,

      ADD CONSTRAINT medical_record_entries_appointment_scope_foreign
        FOREIGN KEY (
          clinic_id,
          patient_clinic_id,
          clinic_professional_id,
          appointment_id
        )
        REFERENCES clinic.appointments(
          clinic_id,
          patient_clinic_id,
          clinic_professional_id,
          id
        )
        ON DELETE RESTRICT,

      ADD CONSTRAINT medical_record_entries_correction_scope_foreign
        FOREIGN KEY (medical_record_id, corrects_entry_id)
        REFERENCES clinic.medical_record_entries(medical_record_id, id)
        ON DELETE RESTRICT,

      ADD CONSTRAINT medical_record_entries_type_valid
        CHECK (
          entry_type_code IN (
            'consultation',
            'evolution',
            'correction',
            'other'
          )
        ),

      ADD CONSTRAINT medical_record_entries_content_not_blank
        CHECK (btrim(content) <> ''),

      ADD CONSTRAINT medical_record_entries_correction_consistency
        CHECK (
          (
            entry_type_code = 'correction'
            AND corrects_entry_id IS NOT NULL
          )
          OR
          (
            entry_type_code <> 'correction'
            AND corrects_entry_id IS NULL
          )
        )
    `)

    this.schema.withSchema(this.schemaName).createTable('medical_record_access_logs', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))

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

      table
        .timestamp('accessed_at', {
          useTz: true,
        })
        .notNullable()
        .defaultTo(this.now())

      table.index(
        ['medical_record_id', 'accessed_at'],
        'medical_record_access_logs_record_time_idx'
      )

      table.index(['clinic_id', 'accessed_at'], 'medical_record_access_logs_clinic_time_idx')

      table.index(['user_id', 'accessed_at'], 'medical_record_access_logs_user_time_idx')
    })

    this.schema.raw(`
      ALTER TABLE clinic.medical_record_access_logs
      ADD CONSTRAINT medical_record_access_logs_record_scope_foreign
        FOREIGN KEY (patient_id, medical_record_id)
        REFERENCES clinic.medical_records(patient_id, id)
        ON DELETE RESTRICT,

      ADD CONSTRAINT medical_record_access_logs_patient_clinic_scope_foreign
        FOREIGN KEY (clinic_id, patient_id, patient_clinic_id)
        REFERENCES clinic.patient_clinics(clinic_id, patient_id, id)
        ON DELETE RESTRICT,

      ADD CONSTRAINT medical_record_access_logs_action_valid
        CHECK (
          access_action IN (
            'view_timeline',
            'view_entry'
          )
        ),

      ADD CONSTRAINT medical_record_access_logs_purpose_valid
        CHECK (
          purpose_code IN (
            'patient_care',
            'care_coordination',
            'legal_obligation',
            'other'
          )
        ),

      ADD CONSTRAINT medical_record_access_logs_purpose_note_not_blank
        CHECK (
          purpose_note IS NULL
          OR btrim(purpose_note) <> ''
        ),

      ADD CONSTRAINT medical_record_access_logs_other_purpose_consistency
        CHECK (
          purpose_code <> 'other'
          OR purpose_note IS NOT NULL
        )
    `)

    /*
     * Entradas clínicas e logs de acesso são históricos append-only.
     * Alterações e exclusões são recusadas pelo banco.
     */
    this.schema.raw(`
      CREATE FUNCTION clinic.prevent_medical_record_history_change()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RAISE EXCEPTION
          'Rows in clinic.% are immutable',
          TG_TABLE_NAME
          USING ERRCODE = '55000';
      END;
      $$
    `)

    this.schema.raw(`
      CREATE TRIGGER medical_record_entries_immutable
      BEFORE UPDATE OR DELETE
      ON clinic.medical_record_entries
      FOR EACH ROW
      EXECUTE FUNCTION clinic.prevent_medical_record_history_change()
    `)

    this.schema.raw(`
      CREATE TRIGGER medical_record_access_logs_immutable
      BEFORE UPDATE OR DELETE
      ON clinic.medical_record_access_logs
      FOR EACH ROW
      EXECUTE FUNCTION clinic.prevent_medical_record_history_change()
    `)
  }

  async down() {
    this.schema.raw(`
      DROP TRIGGER IF EXISTS medical_record_access_logs_immutable
      ON clinic.medical_record_access_logs
    `)

    this.schema.raw(`
      DROP TRIGGER IF EXISTS medical_record_entries_immutable
      ON clinic.medical_record_entries
    `)

    this.schema.withSchema(this.schemaName).dropTable('medical_record_access_logs')

    this.schema.withSchema(this.schemaName).dropTable('medical_record_entries')

    this.schema.raw(`
      DROP FUNCTION IF EXISTS clinic.prevent_medical_record_history_change()
    `)

    this.schema.raw(`
      ALTER TABLE clinic.appointments
      DROP CONSTRAINT appointments_clinical_context_unique
    `)

    this.schema.raw(`
      ALTER TABLE clinic.patient_clinics
      DROP CONSTRAINT patient_clinics_clinic_patient_id_unique
    `)

    this.schema.raw(`
      ALTER TABLE clinic.medical_records
      DROP CONSTRAINT medical_records_patient_id_id_unique
    `)
  }
}
