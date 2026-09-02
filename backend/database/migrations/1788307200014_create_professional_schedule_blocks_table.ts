import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.withSchema('clinic').createTable('professional_schedule_blocks', (table) => {
      table.uuid('id').primary().defaultTo(this.db.getWriteClient().fn.uuid())
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
      table.check('starts_at < ends_at', [], 'professional_schedule_blocks_time_order')
      table.check(
        "reason IS NULL OR btrim(reason) <> ''",
        [],
        'professional_schedule_blocks_reason_not_blank'
      )
    })
  }

  async down() {
    this.schema.withSchema('clinic').dropTable('professional_schedule_blocks')
  }
}
