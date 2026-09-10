import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.withSchema('clinic').alterTable('users', (table) => {
      table.text('password_hash').nullable().alter()
    })

    this.schema.withSchema('clinic').createTable('user_invitation_tokens', (table) => {
      table.uuid('id').primary().defaultTo(this.db.getWriteClient().fn.uuid())
      table.uuid('user_id').notNullable()
      table.string('token_digest', 64).notNullable()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('consumed_at', { useTz: true }).nullable()
      table.timestamp('revoked_at', { useTz: true }).nullable()
      table.timestamp('sent_at', { useTz: true }).nullable()
      table.uuid('created_by_user_id').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table
        .foreign('user_id', 'user_invitation_tokens_user_id_foreign')
        .references('id')
        .inTable('clinic.users')
        .onDelete('CASCADE')
      table
        .foreign('created_by_user_id', 'user_invitation_tokens_created_by_foreign')
        .references('id')
        .inTable('clinic.users')
        .onDelete('RESTRICT')
      table.unique(['token_digest'], {
        indexName: 'user_invitation_tokens_digest_unique',
      })
      table.index(['user_id'], 'user_invitation_tokens_user_idx')
      table.index(['expires_at'], 'user_invitation_tokens_expires_idx')
      table.check(
        'NOT (consumed_at IS NOT NULL AND revoked_at IS NOT NULL)',
        [],
        'user_invitation_tokens_terminal_state_check'
      )
    })

    this.schema.raw(`
      CREATE UNIQUE INDEX user_invitation_tokens_pending_user_unique
      ON clinic.user_invitation_tokens (user_id)
      WHERE consumed_at IS NULL AND revoked_at IS NULL
    `)
  }

  async down() {
    const invitation = await this.db.from('clinic.user_invitation_tokens').first()
    const passwordlessUser = await this.db.from('clinic.users').whereNull('password_hash').first()

    if (invitation || passwordlessUser) {
      throw new Error(
        'Cannot rollback invitation lifecycle while invitations or users without passwords exist'
      )
    }

    this.schema.raw('DROP INDEX clinic.user_invitation_tokens_pending_user_unique')
    this.schema.withSchema('clinic').dropTable('user_invitation_tokens')
    this.schema.withSchema('clinic').alterTable('users', (table) => {
      table.text('password_hash').notNullable().alter()
    })
  }
}
