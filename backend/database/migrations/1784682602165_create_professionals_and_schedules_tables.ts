import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected schemaName = 'clinic'

  async up() {
    this.schema.withSchema(this.schemaName).alterTable('clinics', (table) => {
      table.string('timezone', 100).notNullable().defaultTo('America/Sao_Paulo')
    })

    this.schema.withSchema(this.schemaName).createTable('professionals', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))

      table.uuid('user_id').nullable().references('id').inTable('clinic.users').onDelete('SET NULL')

      table.string('full_name', 180).notNullable()
      table.string('crm_number', 30).notNullable()
      table.string('crm_state', 2).notNullable()
      table.string('specialty', 120).notNullable()
      table.string('phone', 20).nullable()
      table.string('email', 254).nullable()

      table.boolean('is_active').notNullable().defaultTo(true)

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['user_id'], {
        indexName: 'professionals_user_unique',
      })

      table.unique(['crm_state', 'crm_number'], {
        indexName: 'professionals_crm_unique',
      })

      table.index(['full_name'], 'professionals_full_name_idx')
      table.index(['specialty'], 'professionals_specialty_idx')
      table.index(['is_active'], 'professionals_is_active_idx')
    })

    this.schema.withSchema(this.schemaName).createTable('clinic_professionals', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))

      table
        .uuid('clinic_id')
        .notNullable()
        .references('id')
        .inTable('clinic.clinics')
        .onDelete('RESTRICT')

      table
        .uuid('professional_id')
        .notNullable()
        .references('id')
        .inTable('clinic.professionals')
        .onDelete('RESTRICT')

      table.string('local_code', 60).nullable()

      table.integer('default_appointment_duration_minutes').notNullable().defaultTo(30)

      table.boolean('accepts_appointments').notNullable().defaultTo(true)

      table.boolean('is_active').notNullable().defaultTo(true)

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['clinic_id', 'professional_id'], {
        indexName: 'clinic_professionals_clinic_professional_unique',
      })

      table.unique(['clinic_id', 'local_code'], {
        indexName: 'clinic_professionals_local_code_unique',
      })

      table.index(['clinic_id', 'is_active'], 'clinic_professionals_clinic_active_idx')

      table.index(['professional_id'], 'clinic_professionals_professional_idx')
    })

    this.schema
      .withSchema(this.schemaName)
      .createTable('professional_weekly_availabilities', (table) => {
        table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))

        table
          .uuid('clinic_professional_id')
          .notNullable()
          .references('id')
          .inTable('clinic.clinic_professionals')
          .onDelete('RESTRICT')

        table.smallint('weekday').notNullable()
        table.time('start_time').notNullable()
        table.time('end_time').notNullable()

        table.boolean('is_active').notNullable().defaultTo(true)

        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

        table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

        table.unique(['clinic_professional_id', 'weekday', 'start_time', 'end_time'], {
          indexName: 'professional_weekly_availabilities_exact_unique',
        })

        table.index(
          ['clinic_professional_id', 'weekday', 'is_active'],
          'professional_weekly_availabilities_lookup_idx'
        )
      })

    this.schema.withSchema(this.schemaName).createTable('professional_schedule_blocks', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))

      table
        .uuid('clinic_professional_id')
        .notNullable()
        .references('id')
        .inTable('clinic.clinic_professionals')
        .onDelete('RESTRICT')

      table.timestamp('starts_at', { useTz: true }).notNullable()

      table.timestamp('ends_at', { useTz: true }).notNullable()

      table.string('reason', 240).nullable()
      table.boolean('is_active').notNullable().defaultTo(true)

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['clinic_professional_id', 'starts_at', 'ends_at'], {
        indexName: 'professional_schedule_blocks_exact_unique',
      })

      table.index(
        ['clinic_professional_id', 'starts_at', 'ends_at'],
        'professional_schedule_blocks_lookup_idx'
      )
    })

    this.schema.raw(`
      ALTER TABLE clinic.clinics
      ADD CONSTRAINT clinics_timezone_not_blank
        CHECK (btrim(timezone) <> '')
    `)

    this.schema.raw(`
      ALTER TABLE clinic.professionals
      ADD CONSTRAINT professionals_full_name_not_blank
        CHECK (btrim(full_name) <> ''),
      ADD CONSTRAINT professionals_crm_number_not_blank
        CHECK (btrim(crm_number) <> ''),
      ADD CONSTRAINT professionals_crm_state_format
        CHECK (crm_state ~ '^[A-Z]{2}$'),
      ADD CONSTRAINT professionals_specialty_not_blank
        CHECK (btrim(specialty) <> ''),
      ADD CONSTRAINT professionals_phone_not_blank
        CHECK (
          phone IS NULL
          OR btrim(phone) <> ''
        ),
      ADD CONSTRAINT professionals_email_not_blank
        CHECK (
          email IS NULL
          OR btrim(email) <> ''
        )
    `)

    this.schema.raw(`
      ALTER TABLE clinic.clinic_professionals
      ADD CONSTRAINT clinic_professionals_local_code_not_blank
        CHECK (
          local_code IS NULL
          OR btrim(local_code) <> ''
        ),
      ADD CONSTRAINT clinic_professionals_duration_range
        CHECK (
          default_appointment_duration_minutes
          BETWEEN 5 AND 480
        )
    `)

    this.schema.raw(`
      ALTER TABLE clinic.professional_weekly_availabilities
      ADD CONSTRAINT professional_weekly_availabilities_weekday_range
        CHECK (weekday BETWEEN 1 AND 7),
      ADD CONSTRAINT professional_weekly_availabilities_time_order
        CHECK (start_time < end_time)
    `)

    this.schema.raw(`
      ALTER TABLE clinic.professional_schedule_blocks
      ADD CONSTRAINT professional_schedule_blocks_time_order
        CHECK (starts_at < ends_at),
      ADD CONSTRAINT professional_schedule_blocks_reason_not_blank
        CHECK (
          reason IS NULL
          OR btrim(reason) <> ''
        )
    `)
  }

  async down() {
    this.schema.withSchema(this.schemaName).dropTable('professional_schedule_blocks')

    this.schema.withSchema(this.schemaName).dropTable('professional_weekly_availabilities')

    this.schema.withSchema(this.schemaName).dropTable('clinic_professionals')

    this.schema.withSchema(this.schemaName).dropTable('professionals')

    this.schema.raw(`
      ALTER TABLE clinic.clinics
      DROP CONSTRAINT clinics_timezone_not_blank
    `)

    this.schema.withSchema(this.schemaName).alterTable('clinics', (table) => {
      table.dropColumn('timezone')
    })
  }
}
