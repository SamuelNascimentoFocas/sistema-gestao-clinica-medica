import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected schemaName = 'clinic'

  async up() {
    this.schema.withSchema(this.schemaName).createTable('clinics', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('name', 180).notNullable()
      table.string('cnpj', 14).nullable()
      table.string('phone', 20).nullable()

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

      table.unique(['cnpj'], {
        indexName: 'clinics_cnpj_unique',
      })
    })

    this.schema.withSchema(this.schemaName).createTable('permissions', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('code', 100).notNullable()
      table.string('description', 255).notNullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['code'], {
        indexName: 'permissions_code_unique',
      })
    })

    this.schema.withSchema(this.schemaName).createTable('roles', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('code', 60).notNullable()
      table.string('name', 120).notNullable()
      table.string('description', 255).nullable()
      table.boolean('is_system').notNullable().defaultTo(false)
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['code'], {
        indexName: 'roles_code_unique',
      })
    })

    this.schema.withSchema(this.schemaName).createTable('role_permissions', (table) => {
      table
        .uuid('role_id')
        .notNullable()
        .references('id')
        .inTable('clinic.roles')
        .onDelete('CASCADE')

      table
        .uuid('permission_id')
        .notNullable()
        .references('id')
        .inTable('clinic.permissions')
        .onDelete('CASCADE')

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.primary(['role_id', 'permission_id'])
      table.index(['permission_id'], 'role_permissions_permission_idx')
    })

    this.schema.withSchema(this.schemaName).createTable('user_clinic_roles', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))

      table
        .uuid('user_id')
        .notNullable()
        .references('id')
        .inTable('clinic.users')
        .onDelete('CASCADE')

      table
        .uuid('clinic_id')
        .notNullable()
        .references('id')
        .inTable('clinic.clinics')
        .onDelete('CASCADE')

      table
        .uuid('role_id')
        .notNullable()
        .references('id')
        .inTable('clinic.roles')
        .onDelete('RESTRICT')

      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['user_id', 'clinic_id'], {
        indexName: 'user_clinic_roles_user_clinic_unique',
      })

      table.index(['clinic_id'], 'user_clinic_roles_clinic_idx')
      table.index(['role_id'], 'user_clinic_roles_role_idx')
    })

    this.schema.raw(`
      ALTER TABLE clinic.clinics
      ADD CONSTRAINT clinics_name_not_blank
        CHECK (btrim(name) <> ''),
      ADD CONSTRAINT clinics_cnpj_digits
        CHECK (cnpj IS NULL OR cnpj ~ '^[0-9]{14}$'),
      ADD CONSTRAINT clinics_address_state_format
        CHECK (
          address_state IS NULL
          OR address_state ~ '^[A-Z]{2}$'
        ),
      ADD CONSTRAINT clinics_postal_code_digits
        CHECK (
          address_postal_code IS NULL
          OR address_postal_code ~ '^[0-9]{8}$'
        )
    `)

    this.schema.raw(`
      ALTER TABLE clinic.permissions
      ADD CONSTRAINT permissions_code_format
        CHECK (code ~ '^[a-z][a-z0-9_]*([.][a-z][a-z0-9_]*)+$'),
      ADD CONSTRAINT permissions_description_not_blank
        CHECK (btrim(description) <> '')
    `)

    this.schema.raw(`
      ALTER TABLE clinic.roles
      ADD CONSTRAINT roles_code_format
        CHECK (code ~ '^[a-z][a-z0-9_]*$'),
      ADD CONSTRAINT roles_name_not_blank
        CHECK (btrim(name) <> '')
    `)
  }

  async down() {
    this.schema.withSchema(this.schemaName).dropTable('user_clinic_roles')
    this.schema.withSchema(this.schemaName).dropTable('role_permissions')
    this.schema.withSchema(this.schemaName).dropTable('roles')
    this.schema.withSchema(this.schemaName).dropTable('permissions')
    this.schema.withSchema(this.schemaName).dropTable('clinics')
  }
}
