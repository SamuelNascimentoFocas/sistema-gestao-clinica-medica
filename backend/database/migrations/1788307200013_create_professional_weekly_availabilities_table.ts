import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.withSchema('clinic').createTable('professional_weekly_availabilities', (table) => {
      table.uuid('id').primary().defaultTo(this.db.getWriteClient().fn.uuid())
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
      table.check('weekday BETWEEN 1 AND 7', [], 'professional_weekly_availabilities_weekday_range')
      table.check('start_time < end_time', [], 'professional_weekly_availabilities_time_order')
    })
  }

  async down() {
    this.schema.withSchema('clinic').dropTable('professional_weekly_availabilities')
  }
}
