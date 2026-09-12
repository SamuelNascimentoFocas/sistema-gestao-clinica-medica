import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import knex, { type Knex } from 'knex'

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temporaryRoot = join(backendRoot, 'tmp')
const emptyEnvironment = join(temporaryRoot, 'phase2-empty-env')
const reportPath = join(temporaryRoot, 'phase2-lineage-guard.json')
const database = 'clinic_baseline_suite_20260902'
const pgdata = 'C:/Users/Samuel/AppData/Local/Temp/clinic-baseline-pg18-20260902'
const oldCommit = '581c6baf71ee7652c74de0efd123939cb9110cec'
const expectedGuard = '1788307199999_guard_legacy_migration_lineage'
type Row = Record<string, unknown>
interface LedgerRow {
  id: number
  name: string
  batch: number
  migration_time: Date
}
interface CommandResult {
  command: string[]
  code: number
  stdout: string
  stderr: string
}

function command(
  executable: string,
  args: string[],
  env?: NodeJS.ProcessEnv
): Promise<CommandResult> {
  return new Promise((done) =>
    execFile(
      executable,
      args,
      { cwd: backendRoot, env, windowsHide: true, timeout: 120_000, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) =>
        done({
          command: [executable, ...args],
          code: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
          stdout,
          stderr,
        })
    )
  )
}

function childEnvironment(): NodeJS.ProcessEnv {
  const inherited = Object.fromEntries(
    ['PATH', 'SystemRoot', 'WINDIR', 'ComSpec', 'TEMP', 'TMP'].map((name) => [
      name,
      process.env[name],
    ])
  )
  const user = process.env.BASELINE_PG_USER || 'postgres'
  const password = process.env.BASELINE_PG_PASSWORD || 'phase2-isolated-password-sentinel'
  return {
    ...inherited,
    ENV_PATH: emptyEnvironment,
    NODE_ENV: 'test',
    PORT: '3333',
    HOST: '127.0.0.1',
    LOG_LEVEL: 'silent',
    APP_KEY: 'phase2-guard-only-nonproduction-key',
    DRIVE_DISK: 'private_fs',
    DB_HOST: '127.0.0.1',
    DB_PORT: '55432',
    DB_USER: user,
    DB_PASSWORD: password,
    DB_DATABASE: database,
    PGHOST: '127.0.0.1',
    PGPORT: '55432',
    PGUSER: user,
    PGPASSWORD: password,
    PGDATABASE: database,
    PGSSLMODE: 'disable',
    PGOPTIONS: '-c search_path=public',
    PGAPPNAME: 'phase2-lineage-guard',
  }
}

async function query(connection: Knex | Knex.Transaction, sql: string): Promise<Row[]> {
  const result: { rows: Row[] } = await connection.raw(sql)
  return result.rows
}

async function verifyTarget(connection: Knex | Knex.Transaction) {
  const [target] = await query(
    connection,
    `SELECT current_database() AS database,
    host(inet_server_addr()) AS host, inet_server_port() AS port,
    current_setting('data_directory') AS data_directory`
  )
  assert.equal(target.database, database)
  assert.equal(target.host, '127.0.0.1')
  assert.equal(target.port, 55432)
  assert.equal(resolve(String(target.data_directory)).toLowerCase(), resolve(pgdata).toLowerCase())
}

async function guarded<T>(
  connection: Knex,
  operation: (transaction: Knex.Transaction) => Promise<T>
) {
  return connection.transaction(async (transaction) => {
    await verifyTarget(transaction)
    return operation(transaction)
  })
}

async function catalog(connection: Knex) {
  return guarded(connection, async (transaction) => {
    await transaction.raw('SET LOCAL search_path = pg_catalog')
    const sections: Record<string, string> = {
      schemas: `SELECT nspname FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname <> 'information_schema' ORDER BY 1`,
      relations: `SELECT n.nspname, c.relname, c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname IN ('clinic','public') ORDER BY 1,2`,
      columns: `SELECT n.nspname,c.relname,a.attname,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull,
        pg_get_expr(d.adbin,d.adrelid) AS default FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
        JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
        WHERE n.nspname IN ('clinic','public') AND a.attnum>0 AND NOT a.attisdropped ORDER BY 1,2,3`,
      constraints: `SELECT n.nspname,c.relname,k.conname,pg_get_constraintdef(k.oid,false) AS definition
        FROM pg_constraint k JOIN pg_namespace n ON n.oid=k.connamespace LEFT JOIN pg_class c ON c.oid=k.conrelid
        WHERE n.nspname IN ('clinic','public') ORDER BY 1,2,3`,
      indexes: `SELECT n.nspname,c.relname,pg_get_indexdef(i.indexrelid,0,false) AS definition
        FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname IN ('clinic','public') ORDER BY 1,2`,
      extensions: `SELECT extname,extversion FROM pg_extension ORDER BY 1`,
      sequences: `SELECT n.nspname,c.relname,s.seqstart,s.seqincrement,s.seqmin,s.seqmax,s.seqcache,s.seqcycle
        FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname IN ('clinic','public') ORDER BY 1,2`,
      routines: `SELECT n.nspname,p.proname,p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname IN ('clinic','public') AND NOT EXISTS (SELECT 1 FROM pg_depend d
          WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e') ORDER BY 1,2`,
      types: `SELECT n.nspname,t.typname,t.typtype FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
        WHERE n.nspname IN ('clinic','public') AND t.typtype IN ('d','e','r','m')
          AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_type'::regclass
            AND d.objid=t.oid AND d.deptype='e') ORDER BY 1,2`,
    }
    const result: Record<string, Row[]> = {}
    for (const [name, sql] of Object.entries(sections)) result[name] = await query(transaction, sql)
    return result
  })
}

async function main() {
  if (process.argv.length === 2) {
    console.log(
      'No database access. Pass --execute with BASELINE_PG_PORT=55432 to validate the isolated migration guard.'
    )
    return
  }
  assert.deepEqual(process.argv.slice(2), ['--execute'])
  assert.equal(
    process.env.BASELINE_PG_PORT,
    '55432',
    'Only the approved isolated cluster is allowed'
  )
  const branch = await command('git', ['branch', '--show-current'])
  assert.equal(branch.stdout.trim(), 'refactor/company-review-compliance')
  await mkdir(emptyEnvironment, { recursive: true })
  assert.deepEqual(await readdir(emptyEnvironment), [], 'ENV_PATH must be an empty directory')
  const environment = childEnvironment()
  const connection = knex({
    client: 'pg',
    connection: {
      host: '127.0.0.1',
      port: 55432,
      database,
      user: environment.DB_USER,
      password: environment.DB_PASSWORD,
      ssl: false,
      options: '-c search_path=public',
      application_name: 'phase2-lineage-guard',
    },
    pool: { min: 0, max: 1 },
    acquireConnectionTimeout: 5000,
  })
  const commands: CommandResult[] = []
  const cases: string[] = []
  const report: Record<string, unknown> = {
    status: 'failed',
    database,
    host: '127.0.0.1',
    port: 55432,
    pgdata,
    cases,
    commands,
  }
  const runMigration = async (action: 'run' | 'reset', expectedCode = 0) => {
    await verifyTarget(connection)
    const result = await command(
      process.execPath,
      // Lucid 21.8.2 compact output omits the error message. Inspect the
      // standard CLI output when rejection is expected.
      ['ace', `migration:${action}`, ...(expectedCode === 0 ? ['--compact-output'] : [])],
      environment
    )
    commands.push(result)
    await verifyTarget(connection)
    assert.equal(result.code, expectedCode, result.stdout + result.stderr)
    return result
  }
  const ledger = () =>
    guarded(connection, async (transaction) =>
      transaction<LedgerRow>('public.adonis_schema').select('*').orderBy('id')
    )
  const versions = () =>
    guarded(connection, async (transaction) =>
      transaction<{ version: number }>('public.adonis_schema_versions')
        .select('version')
        .orderBy('version')
    )
  try {
    const initial = await catalog(connection)
    assert.deepEqual(initial.schemas, [{ nspname: 'public' }])
    assert.deepEqual(initial.relations, [])
    assert.deepEqual(initial.routines, [])
    assert.deepEqual(initial.types, [])
    assert.deepEqual(
      initial.extensions.map((extension) => extension.extname),
      ['plpgsql']
    )
    await runMigration('run')
    const applied = await ledger()
    assert.equal(applied.length, 25)
    assert.equal(applied[0].name.split('/').at(-1), expectedGuard)
    const schema = await catalog(connection)
    assert.equal(
      schema.relations.filter(
        (relation) => relation.nspname === 'clinic' && relation.relkind === 'r'
      ).length,
      18
    )
    cases.push('fresh database: 25 migrations, guard first, 18 clinic tables')
    await runMigration('run')
    assert.deepEqual(await ledger(), applied)
    cases.push('second run: no migrations reapplied')
    await guarded(connection, async (transaction) =>
      transaction.schema.withSchema('public').createTable('phase2_shared_gist', (table) => {
        table.uuid('id').notNullable()
        table.index(['id'], 'phase2_shared_gist_uuid_idx', 'gist')
      })
    )
    const sharedRow = { id: '00000000-0000-4000-8000-000000000002' }
    await guarded(connection, async (transaction) =>
      transaction('public.phase2_shared_gist').insert(sharedRow)
    )
    await runMigration('reset')
    assert.deepEqual(await ledger(), [])
    const reset = await catalog(connection)
    assert(!reset.schemas.some((schemaName) => schemaName.nspname === 'clinic'))
    assert(reset.extensions.some((extension) => extension.extname === 'btree_gist'))
    assert(reset.relations.some((relation) => relation.relname === 'phase2_shared_gist'))
    assert(reset.indexes.some((index) => index.relname === 'phase2_shared_gist_uuid_idx'))
    assert.deepEqual(
      await guarded(connection, async (transaction) =>
        transaction('public.phase2_shared_gist').select('*')
      ),
      [sharedRow]
    )
    cases.push('reset: empty ledger, no clinic schema, shared btree_gist dependency preserved')
    await guarded(connection, async (transaction) =>
      transaction.schema.withSchema('public').dropTable('phase2_shared_gist')
    )
    const listing = await command('git', [
      'ls-tree',
      '-r',
      '--name-only',
      oldCommit,
      '--',
      'database/migrations',
    ])
    assert.equal(listing.code, 0)
    const oldNames = listing.stdout
      .trim()
      .split('\n')
      .map((name, index) => {
        const extension = index % 3 === 0 ? '' : index % 3 === 1 ? '.ts' : '.js'
        const normalized = name.replace(/\.ts$/, extension)
        return index % 2 === 0 ? normalized : normalized.replaceAll('/', '\\')
      })
    assert.equal(oldNames.length, 11)
    const fixtureRows = await guarded(connection, async (transaction) =>
      transaction('public.adonis_schema')
        .insert(oldNames.map((name) => ({ name, batch: 1 })))
        .returning<{ id: number }[]>('id')
    )
    const beforeLedger = await ledger()
    const beforeVersions = await versions()
    assert.deepEqual(
      beforeVersions,
      [{ version: 2 }],
      'Use the existing Lucid v2 ledger for this regression'
    )
    const beforeCatalog = await catalog(connection)
    const beforeSequence = await guarded(connection, async (transaction) =>
      transaction('public.adonis_schema_id_seq').select('last_value', 'is_called')
    )
    const rejected = await runMigration('run', 1)
    assert.match(rejected.stdout + rejected.stderr, /LEGACY_MIGRATION_LINEAGE/)
    for (const name of oldNames) {
      assert((rejected.stdout + rejected.stderr).includes(name.match(/[0-9]{13}/)![0]))
    }
    assert.deepEqual(await ledger(), beforeLedger)
    assert.deepEqual(await versions(), beforeVersions)
    assert.deepEqual(await catalog(connection), beforeCatalog)
    assert.deepEqual(
      await guarded(connection, async (transaction) =>
        transaction('public.adonis_schema_id_seq').select('last_value', 'is_called')
      ),
      beforeSequence
    )
    assert(!beforeCatalog.schemas.some((schemaName) => schemaName.nspname === 'clinic'))
    assert(!beforeLedger.some((row) => row.name.includes('1788307')))
    cases.push(
      'legacy lineage: command rejected, ledger/catalog/sequence unchanged, no new baseline records'
    )
    report.legacyFixtureNames = oldNames
    await guarded(connection, async (transaction) =>
      transaction('public.adonis_schema')
        .whereIn(
          'id',
          fixtureRows.map((row) => row.id)
        )
        .delete()
    )
    assert.deepEqual(await ledger(), [])
    cases.push('only synthetic legacy ledger rows removed; suite database ready for npm test')
    report.status = 'passed'
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error)
    process.exitCode = 1
  } finally {
    await connection.destroy()
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
    console.log(
      JSON.stringify(
        { status: report.status, cases, error: report.error, report: reportPath },
        null,
        2
      )
    )
  }
}

await main()
