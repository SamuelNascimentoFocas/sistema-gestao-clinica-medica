import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected schemaName = 'clinic'
  protected tableName = 'appointments'

  async up() {
    /*
     * Estas constraints auxiliares permitem que as foreign keys
     * compostas comprovem que cada vínculo pertence ao clinic_id
     * informado no agendamento.
     */
    this.schema.raw(`
      ALTER TABLE clinic.patient_clinics
      ADD CONSTRAINT patient_clinics_clinic_id_id_unique
      UNIQUE (clinic_id, id)
    `)

    this.schema.raw(`
      ALTER TABLE clinic.clinic_professionals
      ADD CONSTRAINT clinic_professionals_clinic_id_id_unique
      UNIQUE (clinic_id, id)
    `)

    this.schema.withSchema(this.schemaName).createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))

      table.uuid('clinic_id').notNullable()

      table.uuid('patient_clinic_id').notNullable()

      table.uuid('clinic_professional_id').notNullable()

      table
        .timestamp('starts_at', {
          useTz: true,
        })
        .notNullable()

      table
        .timestamp('ends_at', {
          useTz: true,
        })
        .notNullable()

      table.string('status', 20).notNullable().defaultTo('scheduled')

      table.integer('version').notNullable().defaultTo(1)

      table.string('appointment_type_code', 60).nullable()

      table.string('administrative_note', 500).nullable()

      table.uuid('created_by_user_id').notNullable()

      table
        .timestamp('confirmed_at', {
          useTz: true,
        })
        .nullable()

      table.uuid('confirmed_by_user_id').nullable()

      table
        .timestamp('completed_at', {
          useTz: true,
        })
        .nullable()

      table.uuid('completed_by_user_id').nullable()

      table
        .timestamp('cancelled_at', {
          useTz: true,
        })
        .nullable()

      table.uuid('cancelled_by_user_id').nullable()

      table.string('cancellation_reason_code', 40).nullable()

      table.string('cancellation_note', 500).nullable()

      table
        .timestamp('no_show_at', {
          useTz: true,
        })
        .nullable()

      table.uuid('no_show_by_user_id').nullable()

      table.uuid('rescheduled_from_appointment_id').nullable()

      table
        .timestamp('created_at', {
          useTz: true,
        })
        .notNullable()
        .defaultTo(this.now())

      table
        .timestamp('updated_at', {
          useTz: true,
        })
        .notNullable()
        .defaultTo(this.now())

      table.unique(['clinic_id', 'id'], {
        indexName: 'appointments_clinic_id_id_unique',
      })

      table.unique(['rescheduled_from_appointment_id'], {
        indexName: 'appointments_rescheduled_from_unique',
      })

      table.index(['clinic_id', 'starts_at', 'ends_at'], 'appointments_clinic_interval_idx')

      table.index(
        ['clinic_professional_id', 'starts_at', 'ends_at'],
        'appointments_professional_interval_idx'
      )

      table.index(['patient_clinic_id', 'starts_at'], 'appointments_patient_starts_idx')

      table.index(['clinic_id', 'status', 'starts_at'], 'appointments_clinic_status_starts_idx')
    })

    /*
     * As foreign keys compostas impedem que um vínculo de paciente
     * ou profissional pertencente a outro consultório seja utilizado.
     */
    this.schema.raw(`
      ALTER TABLE clinic.appointments
      ADD CONSTRAINT appointments_clinic_id_foreign
        FOREIGN KEY (clinic_id)
        REFERENCES clinic.clinics (id)
        ON DELETE RESTRICT,

      ADD CONSTRAINT appointments_patient_clinic_scope_foreign
        FOREIGN KEY (clinic_id, patient_clinic_id)
        REFERENCES clinic.patient_clinics (clinic_id, id)
        ON DELETE RESTRICT,

      ADD CONSTRAINT appointments_professional_scope_foreign
        FOREIGN KEY (clinic_id, clinic_professional_id)
        REFERENCES clinic.clinic_professionals (clinic_id, id)
        ON DELETE RESTRICT,

      ADD CONSTRAINT appointments_created_by_user_foreign
        FOREIGN KEY (created_by_user_id)
        REFERENCES clinic.users (id)
        ON DELETE RESTRICT,

      ADD CONSTRAINT appointments_confirmed_by_user_foreign
        FOREIGN KEY (confirmed_by_user_id)
        REFERENCES clinic.users (id)
        ON DELETE RESTRICT,

      ADD CONSTRAINT appointments_completed_by_user_foreign
        FOREIGN KEY (completed_by_user_id)
        REFERENCES clinic.users (id)
        ON DELETE RESTRICT,

      ADD CONSTRAINT appointments_cancelled_by_user_foreign
        FOREIGN KEY (cancelled_by_user_id)
        REFERENCES clinic.users (id)
        ON DELETE RESTRICT,

      ADD CONSTRAINT appointments_no_show_by_user_foreign
        FOREIGN KEY (no_show_by_user_id)
        REFERENCES clinic.users (id)
        ON DELETE RESTRICT,

      ADD CONSTRAINT appointments_rescheduled_from_scope_foreign
        FOREIGN KEY (clinic_id, rescheduled_from_appointment_id)
        REFERENCES clinic.appointments (clinic_id, id)
        ON DELETE RESTRICT
    `)

    /*
     * As checks protegem invariantes que devem permanecer válidas
     * mesmo quando os dados forem inseridos fora da futura API.
     */
    this.schema.raw(`
      ALTER TABLE clinic.appointments
      ADD CONSTRAINT appointments_valid_interval
        CHECK (starts_at < ends_at),

      ADD CONSTRAINT appointments_duration_range
        CHECK (
          ends_at >= starts_at + INTERVAL '5 minutes'
          AND ends_at <= starts_at + INTERVAL '480 minutes'
        ),

      ADD CONSTRAINT appointments_valid_status
        CHECK (
          status IN (
            'scheduled',
            'confirmed',
            'completed',
            'cancelled',
            'no_show'
          )
        ),

      ADD CONSTRAINT appointments_version_positive
        CHECK (version >= 1),

      ADD CONSTRAINT appointments_type_code_not_blank
        CHECK (
          appointment_type_code IS NULL
          OR btrim(appointment_type_code) <> ''
        ),

      ADD CONSTRAINT appointments_administrative_note_not_blank
        CHECK (
          administrative_note IS NULL
          OR btrim(administrative_note) <> ''
        ),

      ADD CONSTRAINT appointments_cancellation_reason_valid
        CHECK (
          cancellation_reason_code IS NULL
          OR cancellation_reason_code IN (
            'patient_request',
            'professional_unavailable',
            'clinic_request',
            'duplicate',
            'created_by_mistake',
            'rescheduled',
            'other'
          )
        ),

      ADD CONSTRAINT appointments_cancellation_note_not_blank
        CHECK (
          cancellation_note IS NULL
          OR btrim(cancellation_note) <> ''
        ),

      ADD CONSTRAINT appointments_confirmation_pair_consistency
        CHECK (
          (
            confirmed_at IS NULL
            AND confirmed_by_user_id IS NULL
          )
          OR
          (
            confirmed_at IS NOT NULL
            AND confirmed_by_user_id IS NOT NULL
          )
        ),

      ADD CONSTRAINT appointments_confirmed_state_consistency
        CHECK (
          status <> 'confirmed'
          OR (
            confirmed_at IS NOT NULL
            AND confirmed_by_user_id IS NOT NULL
          )
        ),

      ADD CONSTRAINT appointments_scheduled_state_consistency
        CHECK (
          status <> 'scheduled'
          OR (
            confirmed_at IS NULL
            AND confirmed_by_user_id IS NULL
          )
        ),

      ADD CONSTRAINT appointments_completion_consistency
        CHECK (
          (
            status = 'completed'
            AND completed_at IS NOT NULL
            AND completed_by_user_id IS NOT NULL
          )
          OR
          (
            status <> 'completed'
            AND completed_at IS NULL
            AND completed_by_user_id IS NULL
          )
        ),

      ADD CONSTRAINT appointments_cancellation_consistency
        CHECK (
          (
            status = 'cancelled'
            AND cancelled_at IS NOT NULL
            AND cancelled_by_user_id IS NOT NULL
            AND cancellation_reason_code IS NOT NULL
          )
          OR
          (
            status <> 'cancelled'
            AND cancelled_at IS NULL
            AND cancelled_by_user_id IS NULL
            AND cancellation_reason_code IS NULL
            AND cancellation_note IS NULL
          )
        ),

      ADD CONSTRAINT appointments_no_show_consistency
        CHECK (
          (
            status = 'no_show'
            AND no_show_at IS NOT NULL
            AND no_show_by_user_id IS NOT NULL
          )
          OR
          (
            status <> 'no_show'
            AND no_show_at IS NULL
            AND no_show_by_user_id IS NULL
          )
        )
    `)
  }

  async down() {
    this.schema.withSchema(this.schemaName).dropTable(this.tableName)

    this.schema.raw(`
      ALTER TABLE clinic.clinic_professionals
      DROP CONSTRAINT clinic_professionals_clinic_id_id_unique
    `)

    this.schema.raw(`
      ALTER TABLE clinic.patient_clinics
      DROP CONSTRAINT patient_clinics_clinic_id_id_unique
    `)
  }
}
