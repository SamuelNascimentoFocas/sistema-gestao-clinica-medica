import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.raw('CREATE SCHEMA IF NOT EXISTS clinic')
  }

  async down() {
    this.schema.raw('DROP SCHEMA IF EXISTS clinic')
  }
}
