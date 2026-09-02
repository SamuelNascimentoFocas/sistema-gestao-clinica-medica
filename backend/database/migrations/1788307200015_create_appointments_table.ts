import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'appointments'

  async up() {
    this.schema.withSchema('clinic').createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.getWriteClient().fn.uuid())
      table.uuid('clinic_id').notNullable()
      table.uuid('patient_clinic_id').notNullable()
      table.uuid('clinic_professional_id').notNullable()
      table.timestamp('starts_at', { useTz: true }).notNullable()
      table.timestamp('ends_at', { useTz: true }).notNullable()
      table.string('status', 20).notNullable().defaultTo('scheduled')
      table.integer('version').notNullable().defaultTo(1)
      table.string('appointment_type_code', 60).nullable()
      table.string('administrative_note', 500).nullable()
      table.uuid('created_by_user_id').notNullable()
      table.timestamp('confirmed_at', { useTz: true }).nullable()
      table.uuid('confirmed_by_user_id').nullable()
      table.timestamp('completed_at', { useTz: true }).nullable()
      table.uuid('completed_by_user_id').nullable()
      table.timestamp('cancelled_at', { useTz: true }).nullable()
      table.uuid('cancelled_by_user_id').nullable()
      table.string('cancellation_reason_code', 40).nullable()
      table.string('cancellation_note', 500).nullable()
      table.timestamp('no_show_at', { useTz: true }).nullable()
      table.uuid('no_show_by_user_id').nullable()
      table.uuid('rescheduled_from_appointment_id').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['clinic_id', 'id'], { indexName: 'appointments_clinic_id_id_unique' })
      table.unique(['rescheduled_from_appointment_id'], {
        indexName: 'appointments_rescheduled_from_unique',
      })
      table.unique(['clinic_id', 'patient_clinic_id', 'clinic_professional_id', 'id'], {
        indexName: 'appointments_clinical_context_unique',
      })
      table.index(['clinic_id', 'starts_at', 'ends_at'], 'appointments_clinic_interval_idx')
      table.index(
        ['clinic_professional_id', 'starts_at', 'ends_at'],
        'appointments_professional_interval_idx'
      )
      table.index(['patient_clinic_id', 'starts_at'], 'appointments_patient_starts_idx')
      table.index(['clinic_id', 'status', 'starts_at'], 'appointments_clinic_status_starts_idx')

      table
        .foreign('clinic_id', 'appointments_clinic_id_foreign')
        .references('id')
        .inTable('clinic.clinics')
        .onDelete('RESTRICT')
      // As FKs compostas preservam o isolamento entre consultórios.
      table
        .foreign(['clinic_id', 'patient_clinic_id'], 'appointments_patient_clinic_scope_foreign')
        .references(['clinic_id', 'id'])
        .inTable('clinic.patient_clinics')
        .onDelete('RESTRICT')
      table
        .foreign(['clinic_id', 'clinic_professional_id'], 'appointments_professional_scope_foreign')
        .references(['clinic_id', 'id'])
        .inTable('clinic.clinic_professionals')
        .onDelete('RESTRICT')
      table
        .foreign('created_by_user_id', 'appointments_created_by_user_foreign')
        .references('id')
        .inTable('clinic.users')
        .onDelete('RESTRICT')
      table
        .foreign('confirmed_by_user_id', 'appointments_confirmed_by_user_foreign')
        .references('id')
        .inTable('clinic.users')
        .onDelete('RESTRICT')
      table
        .foreign('completed_by_user_id', 'appointments_completed_by_user_foreign')
        .references('id')
        .inTable('clinic.users')
        .onDelete('RESTRICT')
      table
        .foreign('cancelled_by_user_id', 'appointments_cancelled_by_user_foreign')
        .references('id')
        .inTable('clinic.users')
        .onDelete('RESTRICT')
      table
        .foreign('no_show_by_user_id', 'appointments_no_show_by_user_foreign')
        .references('id')
        .inTable('clinic.users')
        .onDelete('RESTRICT')
      table
        .foreign(
          ['clinic_id', 'rescheduled_from_appointment_id'],
          'appointments_rescheduled_from_scope_foreign'
        )
        .references(['clinic_id', 'id'])
        .inTable('clinic.appointments')
        .onDelete('RESTRICT')

      table.check('starts_at < ends_at', [], 'appointments_valid_interval')
      table.check(
        "ends_at >= starts_at + INTERVAL '5 minutes' AND ends_at <= starts_at + INTERVAL '480 minutes'",
        [],
        'appointments_duration_range'
      )
      table.check(
        "status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')",
        [],
        'appointments_valid_status'
      )
      table.check('version >= 1', [], 'appointments_version_positive')
      table.check(
        "appointment_type_code IS NULL OR btrim(appointment_type_code) <> ''",
        [],
        'appointments_type_code_not_blank'
      )
      table.check(
        "administrative_note IS NULL OR btrim(administrative_note) <> ''",
        [],
        'appointments_administrative_note_not_blank'
      )
      table.check(
        "cancellation_reason_code IS NULL OR cancellation_reason_code IN ('patient_request', 'professional_unavailable', 'clinic_request', 'duplicate', 'created_by_mistake', 'rescheduled', 'other')",
        [],
        'appointments_cancellation_reason_valid'
      )
      table.check(
        "cancellation_note IS NULL OR btrim(cancellation_note) <> ''",
        [],
        'appointments_cancellation_note_not_blank'
      )
      table.check(
        '(confirmed_at IS NULL AND confirmed_by_user_id IS NULL) OR (confirmed_at IS NOT NULL AND confirmed_by_user_id IS NOT NULL)',
        [],
        'appointments_confirmation_pair_consistency'
      )
      table.check(
        "status <> 'confirmed' OR (confirmed_at IS NOT NULL AND confirmed_by_user_id IS NOT NULL)",
        [],
        'appointments_confirmed_state_consistency'
      )
      table.check(
        "status <> 'scheduled' OR (confirmed_at IS NULL AND confirmed_by_user_id IS NULL)",
        [],
        'appointments_scheduled_state_consistency'
      )
      table.check(
        "(status = 'completed' AND completed_at IS NOT NULL AND completed_by_user_id IS NOT NULL) OR (status <> 'completed' AND completed_at IS NULL AND completed_by_user_id IS NULL)",
        [],
        'appointments_completion_consistency'
      )
      table.check(
        "(status = 'cancelled' AND cancelled_at IS NOT NULL AND cancelled_by_user_id IS NOT NULL AND cancellation_reason_code IS NOT NULL) OR (status <> 'cancelled' AND cancelled_at IS NULL AND cancelled_by_user_id IS NULL AND cancellation_reason_code IS NULL AND cancellation_note IS NULL)",
        [],
        'appointments_cancellation_consistency'
      )
      table.check(
        "(status = 'no_show' AND no_show_at IS NOT NULL AND no_show_by_user_id IS NOT NULL) OR (status <> 'no_show' AND no_show_at IS NULL AND no_show_by_user_id IS NULL)",
        [],
        'appointments_no_show_consistency'
      )
    })
  }

  async down() {
    this.schema.withSchema('clinic').dropTable(this.tableName)
  }
}
