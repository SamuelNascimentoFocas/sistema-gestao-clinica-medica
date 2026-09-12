import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // PostgreSQL: o Schema Builder não expõe CREATE EXTENSION.
    this.schema.raw('CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public')
  }

  async down() {
    // IF NOT EXISTS aceita uma extensão prévia; não prova que esta migration a criou.
    // A extensão é compartilhável no banco inteiro. Não remover seus objetos nem
    // dependências de outros schemas; decisão e resíduo estão em docs/MIGRATIONS.md.
  }
}
