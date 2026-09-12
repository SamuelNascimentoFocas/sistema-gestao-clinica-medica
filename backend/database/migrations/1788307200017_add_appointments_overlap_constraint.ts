import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // PostgreSQL: não há Builder equivalente para EXCLUDE GiST com expressão range e WHERE.
    // O intervalo [) permite consultas adjacentes; apenas scheduled/confirmed ocupam horário.
    this.schema.raw(`
      ALTER TABLE clinic.appointments
      ADD CONSTRAINT appointments_professional_no_overlap
      EXCLUDE USING gist (
        clinic_id WITH =,
        clinic_professional_id WITH =,
        tstzrange(starts_at, ends_at, '[)') WITH &&
      )
      WHERE (status IN ('scheduled', 'confirmed'))
    `)
  }

  async down() {
    // O Builder não possui uma operação própria para remover exclusion constraints.
    this.schema.raw(`
      ALTER TABLE clinic.appointments
      DROP CONSTRAINT appointments_professional_no_overlap
    `)
  }
}
