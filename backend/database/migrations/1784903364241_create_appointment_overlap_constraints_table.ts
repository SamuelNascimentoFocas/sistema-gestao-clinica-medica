import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    /*
     * A extensão fica no schema public, independentemente do search_path
     * utilizado pela conexão da aplicação.
     */
    this.schema.raw(`
      CREATE EXTENSION IF NOT EXISTS btree_gist
      WITH SCHEMA public
    `)

    /*
     * Somente agendamentos scheduled e confirmed ocupam horário.
     *
     * O intervalo [) inclui o início e exclui o fim. Portanto:
     * 08:00–09:00 e 09:00–10:00 são permitidos.
     */
    this.schema.raw(`
      ALTER TABLE clinic.appointments
      ADD CONSTRAINT appointments_professional_no_overlap
      EXCLUDE USING gist (
        clinic_id WITH =,
        clinic_professional_id WITH =,
        tstzrange(starts_at, ends_at, '[)') WITH &&
      )
      WHERE (
        status IN ('scheduled', 'confirmed')
      )
    `)
  }

  async down() {
    this.schema.raw(`
      ALTER TABLE clinic.appointments
      DROP CONSTRAINT appointments_professional_no_overlap
    `)

    /*
     * Não removemos btree_gist. Uma extensão é uma capacidade compartilhada
     * do banco e outras estruturas podem passar a utilizá-la.
     */
  }
}
