import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // PostgreSQL: criação de função PL/pgSQL não é representada pelo Schema Builder.
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
  }

  async down() {
    // A função só é removida depois dos dois triggers que dependem dela.
    this.schema.raw('DROP FUNCTION IF EXISTS clinic.prevent_medical_record_history_change()')
  }
}
