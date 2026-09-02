import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // PostgreSQL: o Builder não representa triggers BEFORE UPDATE OR DELETE por linha.
    this.schema.raw(`
      CREATE TRIGGER medical_record_access_logs_immutable
      BEFORE UPDATE OR DELETE ON clinic.medical_record_access_logs
      FOR EACH ROW
      EXECUTE FUNCTION clinic.prevent_medical_record_history_change()
    `)
  }

  async down() {
    this.schema.raw(
      'DROP TRIGGER IF EXISTS medical_record_access_logs_immutable ON clinic.medical_record_access_logs'
    )
  }
}
