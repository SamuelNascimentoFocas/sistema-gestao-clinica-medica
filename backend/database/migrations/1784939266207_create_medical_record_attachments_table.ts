import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    /**
     * Permite que o banco valide, em uma única FK composta, que o anexo
     * pertence à entrada, ao prontuário, ao paciente e ao consultório
     * informados.
     */
    this.schema.raw(`
      ALTER TABLE clinic.medical_record_entries
      ADD CONSTRAINT medical_record_entries_attachment_scope_unique
        UNIQUE (
          clinic_id,
          medical_record_id,
          patient_id,
          id
        )
    `)

    this.schema.raw(`
      CREATE TABLE clinic.medical_record_attachments (
        id uuid
          PRIMARY KEY
          DEFAULT gen_random_uuid(),

        medical_record_entry_id uuid NOT NULL,
        medical_record_id uuid NOT NULL,
        patient_id uuid NOT NULL,
        clinic_id uuid NOT NULL,

        uploaded_by_user_id uuid NOT NULL,

        original_name varchar(255) NOT NULL,
        storage_disk varchar(50) NOT NULL,
        storage_key varchar(500) NOT NULL,
        content_type varchar(255) NOT NULL,
        size_in_bytes integer NOT NULL,
        sha256 varchar(64) NOT NULL,

        status varchar(30)
          NOT NULL
          DEFAULT 'pending',

        status_reason varchar(500),

        created_at timestamptz
          NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        updated_at timestamptz
          NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT medical_record_attachments_storage_unique
          UNIQUE (storage_disk, storage_key),

        CONSTRAINT medical_record_attachments_access_scope_unique
          UNIQUE (
            clinic_id,
            patient_id,
            medical_record_id,
            id
          ),

        CONSTRAINT medical_record_attachments_entry_scope_foreign
          FOREIGN KEY (
            clinic_id,
            medical_record_id,
            patient_id,
            medical_record_entry_id
          )
          REFERENCES clinic.medical_record_entries (
            clinic_id,
            medical_record_id,
            patient_id,
            id
          )
          ON DELETE RESTRICT,

        CONSTRAINT medical_record_attachments_uploaded_by_user_foreign
          FOREIGN KEY (uploaded_by_user_id)
          REFERENCES clinic.users (id)
          ON DELETE RESTRICT,

        CONSTRAINT medical_record_attachments_original_name_not_blank
          CHECK (btrim(original_name) <> ''),

        CONSTRAINT medical_record_attachments_storage_disk_not_blank
          CHECK (btrim(storage_disk) <> ''),

        CONSTRAINT medical_record_attachments_storage_key_not_blank
          CHECK (btrim(storage_key) <> ''),

        CONSTRAINT medical_record_attachments_content_type_not_blank
          CHECK (btrim(content_type) <> ''),

        CONSTRAINT medical_record_attachments_size_valid
          CHECK (
            size_in_bytes BETWEEN 1 AND 10485760
          ),

        CONSTRAINT medical_record_attachments_sha256_format
          CHECK (
            sha256 ~ '^[0-9a-f]{64}$'
          ),

        CONSTRAINT medical_record_attachments_status_valid
          CHECK (
            status IN (
              'pending',
              'available',
              'rejected'
            )
          ),

        CONSTRAINT medical_record_attachments_status_reason_not_blank
          CHECK (
            status_reason IS NULL
            OR btrim(status_reason) <> ''
          ),

        CONSTRAINT medical_record_attachments_rejection_consistency
          CHECK (
            (
              status = 'rejected'
              AND status_reason IS NOT NULL
            )
            OR (
              status <> 'rejected'
              AND status_reason IS NULL
            )
          )
      )
    `)

    this.schema.raw(`
      CREATE INDEX medical_record_attachments_entry_created_idx
      ON clinic.medical_record_attachments (
        medical_record_entry_id,
        created_at
      )
    `)

    this.schema.raw(`
      CREATE INDEX medical_record_attachments_record_created_idx
      ON clinic.medical_record_attachments (
        medical_record_id,
        created_at
      )
    `)

    this.schema.raw(`
      CREATE INDEX medical_record_attachments_clinic_created_idx
      ON clinic.medical_record_attachments (
        clinic_id,
        created_at
      )
    `)

    this.schema.raw(`
      CREATE INDEX medical_record_attachments_status_idx
      ON clinic.medical_record_attachments (status)
    `)

    /**
     * Um download de anexo também é acesso ao prontuário.
     * O log passa a identificar exatamente qual anexo foi baixado.
     */
    this.schema.raw(`
      ALTER TABLE clinic.medical_record_access_logs
      ADD COLUMN medical_record_attachment_id uuid
    `)

    this.schema.raw(`
      ALTER TABLE clinic.medical_record_access_logs
      DROP CONSTRAINT medical_record_access_logs_action_valid
    `)

    this.schema.raw(`
      ALTER TABLE clinic.medical_record_access_logs
      ADD CONSTRAINT medical_record_access_logs_action_valid
        CHECK (
          access_action IN (
            'view_timeline',
            'view_entry',
            'list_attachments',
            'download_attachment'
          )
        )
    `)

    this.schema.raw(`
      ALTER TABLE clinic.medical_record_access_logs
      ADD CONSTRAINT medical_record_access_logs_attachment_scope_foreign
        FOREIGN KEY (
          clinic_id,
          patient_id,
          medical_record_id,
          medical_record_attachment_id
        )
        REFERENCES clinic.medical_record_attachments (
          clinic_id,
          patient_id,
          medical_record_id,
          id
        )
        ON DELETE RESTRICT
    `)

    this.schema.raw(`
      ALTER TABLE clinic.medical_record_access_logs
      ADD CONSTRAINT medical_record_access_logs_attachment_consistency
        CHECK (
          (
            access_action = 'download_attachment'
            AND medical_record_attachment_id IS NOT NULL
          )
          OR (
            access_action <> 'download_attachment'
            AND medical_record_attachment_id IS NULL
          )
        )
    `)

    this.schema.raw(`
      CREATE INDEX medical_record_access_logs_attachment_idx
      ON clinic.medical_record_access_logs (
        medical_record_attachment_id
      )
    `)
  }

  async down() {
    this.schema.raw(`
      DROP INDEX clinic.medical_record_access_logs_attachment_idx
    `)

    this.schema.raw(`
      ALTER TABLE clinic.medical_record_access_logs
      DROP CONSTRAINT medical_record_access_logs_attachment_consistency
    `)

    this.schema.raw(`
      ALTER TABLE clinic.medical_record_access_logs
      DROP CONSTRAINT medical_record_access_logs_attachment_scope_foreign
    `)

    this.schema.raw(`
      ALTER TABLE clinic.medical_record_access_logs
      DROP CONSTRAINT medical_record_access_logs_action_valid
    `)

    this.schema.raw(`
      ALTER TABLE clinic.medical_record_access_logs
      ADD CONSTRAINT medical_record_access_logs_action_valid
        CHECK (
          access_action IN (
            'view_timeline',
            'view_entry'
          )
        )
    `)

    this.schema.raw(`
      ALTER TABLE clinic.medical_record_access_logs
      DROP COLUMN medical_record_attachment_id
    `)

    this.schema.raw(`
      DROP TABLE clinic.medical_record_attachments
    `)

    this.schema.raw(`
      ALTER TABLE clinic.medical_record_entries
      DROP CONSTRAINT medical_record_entries_attachment_scope_unique
    `)
  }
}
