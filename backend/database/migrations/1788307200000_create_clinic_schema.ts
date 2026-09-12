import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createSchemaIfNotExists('clinic')
  }

  async down() {
    this.schema.dropSchemaIfExists('clinic')
  }
}
