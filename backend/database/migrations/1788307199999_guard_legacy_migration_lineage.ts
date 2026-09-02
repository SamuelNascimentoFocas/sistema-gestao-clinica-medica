import { BaseSchema } from '@adonisjs/lucid/schema'
import type { Knex } from 'knex'

const legacyPrefixes = new Set([
  '1784682602158',
  '1784682602159',
  '1784682602162',
  '1784682602163',
  '1784682602164',
  '1784682602165',
  '1784902280079',
  '1784903364241',
  '1784918402685',
  '1784927686961',
  '1784939266207',
])

export default class extends BaseSchema {
  async up() {
    this.defer(async (client) => {
      // Lucid 21.8.2 mantém migrations.tableName na configuração do Knex,
      // inclusive na transação. Use o mesmo ledger/conexão do runner.
      const config: Knex.Config = client.getWriteClient().client.config
      const ledger = config.migrations?.tableName ?? 'adonis_schema'
      const migrations = await client.query<{ name: string }>().from(ledger).select('name')
      const legacy = migrations.filter(({ name }) => {
        const basename = name.replaceAll('\\', '/').split('/').at(-1) ?? ''
        const prefix = /^([0-9]{13})_/.exec(basename)?.[1]
        return prefix !== undefined && legacyPrefixes.has(prefix)
      })

      if (legacy.length > 0) {
        throw new Error(
          'LEGACY_MIGRATION_LINEAGE: baseline bloqueada; o ledger contém migrations ' +
            'da linhagem v0.1.0-mvp. Nenhum DDL da nova baseline foi executado. ' +
            'Preserve este banco e use um banco novo/vazio ou uma transição previamente aprovada. ' +
            `Histórico detectado: ${legacy.map(({ name }) => name).join(', ')}`
        )
      }
    })
  }

  async down() {
    // Guarda somente de leitura: não há estrutura ou dado a desfazer.
    // O runner remove apenas o registro desta migration no rollback normal.
  }
}
