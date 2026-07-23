import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected schemaName = 'clinic'

  async up() {
    this.schema.withSchema(this.schemaName).createTable('patients', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))

      table.string('full_name', 180).notNullable()
      table.date('birth_date').notNullable()
      table.string('cpf', 11).nullable()
      table.string('phone', 20).nullable()
      table.string('email', 254).nullable()

      table.string('address_street', 180).nullable()
      table.string('address_number', 30).nullable()
      table.string('address_complement', 120).nullable()
      table.string('address_neighborhood', 120).nullable()
      table.string('address_city', 120).nullable()
      table.string('address_state', 2).nullable()
      table.string('address_postal_code', 8).nullable()

      table.boolean('is_active').notNullable().defaultTo(true)

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['cpf'], {
        indexName: 'patients_cpf_unique',
      })

      table.index(['full_name'], 'patients_full_name_idx')
      table.index(['birth_date'], 'patients_birth_date_idx')
      table.index(['is_active'], 'patients_is_active_idx')
    })

    this.schema.withSchema(this.schemaName).createTable('patient_clinics', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))

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

      table.index(['clinic_id', 'is_active'], 'patient_clinics_clinic_active_idx')
      table.index(['patient_id'], 'patient_clinics_patient_idx')
    })

    this.schema.withSchema(this.schemaName).createTable('medical_records', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))

      table
        .uuid('patient_id')
        .notNullable()
        .references('id')
        .inTable('clinic.patients')
        .onDelete('RESTRICT')

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['patient_id'], {
        indexName: 'medical_records_patient_unique',
      })
    })

    this.schema.raw(`
      ALTER TABLE clinic.patients
      ADD CONSTRAINT patients_full_name_not_blank
        CHECK (btrim(full_name) <> ''),
      ADD CONSTRAINT patients_cpf_digits
        CHECK (
          cpf IS NULL
          OR cpf ~ '^[0-9]{11}$'
        ),
      ADD CONSTRAINT patients_phone_not_blank
        CHECK (
          phone IS NULL
          OR btrim(phone) <> ''
        ),
      ADD CONSTRAINT patients_email_not_blank
        CHECK (
          email IS NULL
          OR btrim(email) <> ''
        ),
      ADD CONSTRAINT patients_address_state_format
        CHECK (
          address_state IS NULL
          OR address_state ~ '^[A-Z]{2}$'
        ),
      ADD CONSTRAINT patients_postal_code_digits
        CHECK (
          address_postal_code IS NULL
          OR address_postal_code ~ '^[0-9]{8}$'
        )
    `)

    this.schema.raw(`
      ALTER TABLE clinic.patient_clinics
      ADD CONSTRAINT patient_clinics_local_record_not_blank
        CHECK (
          local_record_number IS NULL
          OR btrim(local_record_number) <> ''
        )
    `)
  }

  async down() {
    this.schema.withSchema(this.schemaName).dropTable('medical_records')
    this.schema.withSchema(this.schemaName).dropTable('patient_clinics')
    this.schema.withSchema(this.schemaName).dropTable('patients')
  }
}
