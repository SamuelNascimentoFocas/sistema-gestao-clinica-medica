import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import knex, { type Knex } from 'knex'
import { BaseSchema } from '@adonisjs/lucid/schema'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'

const oldCommit = '581c6baf71ee7652c74de0efd123939cb9110cec'
const guardFile = '1788307199999_guard_legacy_migration_lineage.ts'
const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temporaryRoot = join(backendRoot, 'tmp')
const reportPath = join(temporaryRoot, 'phase2-schema-equivalence.json')
const databaseNames = ['clinic_baseline_old_20260902', 'clinic_baseline_new_20260902'] as const
const runFile = promisify(execFile)
type DatabaseName = (typeof databaseNames)[number]
type Row = Record<string, unknown>
type Snapshot = Record<string, Row[]>
interface MigrationSQL {
  file: string
  up: string[]
  down: string[]
}

// Deparsers run with one search_path on the same PostgreSQL server. Physical
// column order and OIDs are excluded; key/index column order remains meaningful.
const catalogQueries: Record<string, string> = {
  schemas: `SELECT nspname AS name FROM pg_namespace
    WHERE nspname !~ '^pg_' AND nspname <> 'information_schema'`,
  tables: `SELECT n.nspname AS schema, c.relname AS name, c.relkind, c.relpersistence,
      c.relrowsecurity, c.relforcerowsecurity, c.relreplident, c.reloptions
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('clinic', 'public') AND c.relkind IN ('r', 'p', 'v', 'm', 'f')`,
  columns: `SELECT n.nspname AS schema, c.relname AS table, a.attname AS name,
      format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull AS not_null,
      pg_get_expr(d.adbin, d.adrelid, false) AS default, a.attidentity AS identity,
      a.attgenerated AS generated, cn.nspname AS collation_schema, co.collname AS collation
    FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    LEFT JOIN pg_collation co ON co.oid = a.attcollation
    LEFT JOIN pg_namespace cn ON cn.oid = co.collnamespace
    WHERE n.nspname IN ('clinic', 'public') AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND a.attnum > 0 AND NOT a.attisdropped`,
  constraints: `SELECT n.nspname AS schema, c.relname AS table, co.conname AS name,
      co.contype AS type, pg_get_constraintdef(co.oid, false) AS definition,
      co.condeferrable AS deferrable, co.condeferred AS deferred, co.convalidated AS validated
    FROM pg_constraint co JOIN pg_namespace n ON n.oid = co.connamespace
    LEFT JOIN pg_class c ON c.oid = co.conrelid
    WHERE n.nspname IN ('clinic', 'public')`,
  indexes: `SELECT n.nspname AS schema, t.relname AS table, c.relname AS name,
      am.amname AS method, pg_get_indexdef(i.indexrelid, 0, false) AS definition,
      pg_get_expr(i.indpred, i.indrelid, false) AS predicate,
      i.indisunique, i.indisprimary, i.indisexclusion, i.indisvalid, i.indisready,
      i.indnullsnotdistinct, c.reloptions
    FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_class t ON t.oid = i.indrelid JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_am am ON am.oid = c.relam WHERE n.nspname IN ('clinic', 'public')`,
  sequences: `SELECT n.nspname AS schema, c.relname AS name,
      format_type(s.seqtypid, NULL) AS type, s.seqstart::text AS start,
      s.seqincrement::text AS increment, s.seqmax::text AS maximum,
      s.seqmin::text AS minimum, s.seqcache::text AS cache, s.seqcycle AS cycle,
      tn.nspname AS owner_schema, t.relname AS owner_table, a.attname AS owner_column
    FROM pg_sequence s JOIN pg_class c ON c.oid = s.seqrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_depend d ON d.classid = 'pg_class'::regclass AND d.objid = c.oid
      AND d.refclassid = 'pg_class'::regclass AND d.deptype IN ('a', 'i')
    LEFT JOIN pg_class t ON t.oid = d.refobjid
    LEFT JOIN pg_namespace tn ON tn.oid = t.relnamespace
    LEFT JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
    WHERE n.nspname IN ('clinic', 'public')`,
  extensions: `SELECT e.extname AS name, e.extversion AS version,
      n.nspname AS schema, e.extrelocatable AS relocatable
    FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace`,
  types: `SELECT n.nspname AS schema, t.typname AS name, t.typtype AS kind,
      format_type(t.typbasetype, t.typtypmod) AS base_type, t.typnotnull AS not_null,
      t.typdefault AS default,
      ARRAY(SELECT e.enumlabel FROM pg_enum e WHERE e.enumtypid = t.oid
        ORDER BY e.enumsortorder) AS enum_values
    FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname IN ('clinic', 'public') AND t.typtype IN ('d', 'e', 'r', 'm')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_type'::regclass
        AND d.objid = t.oid AND d.deptype = 'e')`,
  functions: `SELECT n.nspname AS schema, p.proname AS name,
      pg_get_function_identity_arguments(p.oid) AS arguments,
      pg_get_function_result(p.oid) AS result, l.lanname AS language,
      p.prosrc AS body, p.probin AS binary, p.prokind AS kind,
      p.provolatile AS volatility, p.proisstrict AS strict, p.prosecdef AS security_definer,
      p.proleakproof AS leakproof, p.proparallel AS parallel, p.proconfig AS config,
      p.procost AS cost, p.prorows AS rows
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname IN ('clinic', 'public')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass
        AND d.objid = p.oid AND d.deptype = 'e')`,
  triggers: `SELECT n.nspname AS schema, c.relname AS table, t.tgname AS name,
      pg_get_triggerdef(t.oid, false) AS definition, t.tgenabled AS enabled,
      t.tgdeferrable AS deferrable, t.tginitdeferred AS deferred
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('clinic', 'public') AND NOT t.tgisinternal`,
}

async function git(...args: string[]) {
  const result = await runFile('git', args, { cwd: backendRoot, maxBuffer: 4 * 1024 * 1024 })
  return result.stdout
}

async function extractOldMigrations(directory: string) {
  const listing = await git('ls-tree', '-r', '--name-only', oldCommit, '--', 'database/migrations')
  const files = listing
    .trim()
    .split('\n')
    .filter((file) => file.endsWith('.ts'))
  assert(files.length > 0, 'The approved commit contains no migration sources')
  for (const file of files) {
    const source = await git('show', `${oldCommit}:backend/${file}`)
    await writeFile(join(directory, file.split('/').at(-1)!), source)
  }
}

async function compile(directory: string): Promise<MigrationSQL[]> {
  // No connection configuration exists. Unexpected DB APIs fail immediately;
  // the real BaseSchema dry-run still compiles every schema/table builder call.
  const compiler = knex({ client: 'pg' })
  const client = new Proxy({} as QueryClientContract, {
    get(_target, property) {
      if (property === 'debug') return false
      if (property === 'schema') return compiler.schema
      if (property === 'getWriteClient') return () => compiler
      if (property === 'knexRawQuery') return compiler.raw.bind(compiler)
      if (property === 'knexQuery') return compiler.queryBuilder.bind(compiler)
      throw new Error(`Offline compilation does not support DB API ${String(property)}`)
    },
  })
  try {
    const migrations: MigrationSQL[] = []
    const files = await readdir(directory)
    for (const file of files.filter((name) => name.endsWith('.ts')).sort()) {
      const imported: { default: typeof BaseSchema } = await import(
        pathToFileURL(join(directory, file)).href
      )
      assert(imported.default.prototype instanceof BaseSchema, `Invalid migration: ${file}`)
      assert(
        !imported.default.disableTransactions,
        `Nontransactional migration requires review: ${file}`
      )
      const statements = async (direction: 'up' | 'down') => {
        const migration = new imported.default(client, file, true)
        const defer = migration.defer.bind(migration)
        let deferredChecks = 0
        migration.defer = (callback) => {
          assert.equal(file, guardFile, `Unexpected deferred operation: ${file}`)
          assert.equal(direction, 'up', 'The lineage guard down must be a no-op')
          deferredChecks++
          defer(callback)
        }
        const sql = await (direction === 'up' ? migration.execUp() : migration.execDown())
        assert(Array.isArray(sql), `No SQL collected for ${file}`)
        if (file === guardFile) {
          assert.equal(deferredChecks, direction === 'up' ? 1 : 0)
          assert.equal(sql.length, 0, 'The lineage guard must not emit DDL')
        }
        return sql
      }
      migrations.push({ file, up: await statements('up'), down: await statements('down') })
    }
    assert(migrations.length > 0, `No migrations found in ${directory}`)
    return migrations
  } finally {
    await compiler.destroy()
  }
}

async function rows(connection: Knex | Knex.Transaction, sql: string): Promise<Row[]> {
  const result: { rows: Row[] } = await connection.raw(sql)
  return result.rows
}

async function verifyTarget(connection: Knex | Knex.Transaction, name: DatabaseName, port: number) {
  const [target] = await rows(
    connection,
    `SELECT current_database() AS database,
    inet_server_port() AS port, host(inet_server_addr()) AS host`
  )
  assert.equal(target.database, name, 'Refusing an unexpected database')
  assert.equal(target.port, port, 'Refusing an unexpected PostgreSQL port')
  assert.equal(target.host, '127.0.0.1', 'Refusing a non-loopback PostgreSQL server')
}

async function snapshot(connection: Knex, name: DatabaseName, port: number): Promise<Snapshot> {
  return connection.transaction(async (transaction) => {
    await verifyTarget(transaction, name, port)
    await transaction.raw('SET LOCAL search_path = pg_catalog')
    const result: Snapshot = {}
    for (const [section, sql] of Object.entries(catalogQueries)) {
      const entries = await rows(transaction, sql)
      result[section] = entries.sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right), 'en')
      )
    }
    return result
  })
}

function assertEmpty(snapshotBefore: Snapshot, name: DatabaseName) {
  assert.deepEqual(snapshotBefore.schemas, [{ name: 'public' }], `${name}: unexpected schemas`)
  assert.deepEqual(
    snapshotBefore.extensions.map((extension) => extension.name),
    ['plpgsql'],
    `${name}: expected only the default plpgsql extension`
  )
  for (const section of Object.keys(catalogQueries).filter(
    (key) => !['schemas', 'extensions'].includes(key)
  )) {
    assert.equal(snapshotBefore[section].length, 0, `${name}: database is not empty (${section})`)
  }
}

async function apply(
  connection: Knex,
  name: DatabaseName,
  port: number,
  migrations: MigrationSQL[],
  direction: 'up' | 'down'
) {
  for (const migration of direction === 'up' ? migrations : [...migrations].reverse()) {
    await connection.transaction(async (transaction) => {
      await verifyTarget(transaction, name, port)
      for (const sql of migration[direction]) await transaction.raw(sql)
    })
    console.log(`${name}: ${direction} ${migration.file}`)
  }
}

function differences(left: Snapshot, right: Snapshot) {
  return Object.keys(catalogQueries).flatMap((section) => {
    const oldRows = new Set(left[section].map((row) => JSON.stringify(row)))
    const newRows = new Set(right[section].map((row) => JSON.stringify(row)))
    return [
      ...[...oldRows]
        .filter((row) => !newRows.has(row))
        .map((row) => ({ section, only: 'old', value: JSON.parse(row) as Row })),
      ...[...newRows]
        .filter((row) => !oldRows.has(row))
        .map((row) => ({ section, only: 'new', value: JSON.parse(row) as Row })),
    ]
  })
}

async function execute(oldSQL: MigrationSQL[], newSQL: MigrationSQL[]) {
  const port = Number(process.env.BASELINE_PG_PORT)
  assert(
    port === 55432,
    'BASELINE_PG_PORT must be 55432, the exclusively authorized isolated cluster'
  )
  const connections = databaseNames.map((database) =>
    knex({
      client: 'pg',
      connection: {
        host: '127.0.0.1',
        port,
        database,
        user: process.env.BASELINE_PG_USER || 'postgres',
        password: process.env.BASELINE_PG_PASSWORD,
      },
      pool: { min: 0, max: 1 },
      acquireConnectionTimeout: 5000,
    })
  )
  const phases: Record<string, Snapshot[]> = {}
  const comparisons: Record<string, ReturnType<typeof differences>> = {}
  try {
    // Both existing targets must be empty before either receives any migration.
    phases.empty = await Promise.all(
      connections.map((connection, index) => snapshot(connection, databaseNames[index], port))
    )
    phases.empty.forEach((initial, index) => assertEmpty(initial, databaseNames[index]))
    const collect = () =>
      Promise.all(
        connections.map((connection, index) => snapshot(connection, databaseNames[index], port))
      )
    const migrate = async (direction: 'up' | 'down') => {
      for (const [index, sql] of [oldSQL, newSQL].entries()) {
        await apply(connections[index], databaseNames[index], port, sql, direction)
      }
    }
    await migrate('up')
    phases.up = await collect()
    comparisons.up = differences(phases.up[0], phases.up[1])
    await migrate('down')
    phases.down = await collect()
    comparisons.down = differences(phases.down[0], phases.down[1])
    for (const [index, residual] of phases.down.entries()) {
      assert(
        !residual.schemas.some((schema) => schema.name === 'clinic'),
        'Rollback left the clinic schema'
      )
      assert(
        residual.extensions.some((extension) => extension.name === 'btree_gist'),
        'Rollback removed the shared btree_gist extension'
      )
      assertEmpty(
        {
          ...residual,
          extensions: residual.extensions.filter((extension) => extension.name !== 'btree_gist'),
        },
        databaseNames[index]
      )
    }
    await migrate('up')
    phases.reapplied = await collect()
    comparisons.reapplied = differences(phases.reapplied[0], phases.reapplied[1])
    comparisons.oldRoundTrip = differences(phases.up[0], phases.reapplied[0])
    comparisons.newRoundTrip = differences(phases.up[1], phases.reapplied[1])
    return {
      status: Object.values(comparisons).every((diff) => diff.length === 0)
        ? 'equivalent'
        : 'different',
      port,
      databases: databaseNames,
      phases,
      comparisons,
    }
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      port,
      databases: databaseNames,
      phases,
      comparisons,
    }
  } finally {
    await Promise.all(connections.map((connection) => connection.destroy()))
  }
}

async function main() {
  const args = process.argv.slice(2)
  assert(
    args.length === 0 || (args.length === 1 && args[0] === '--execute'),
    'Usage: node --import=ts-node-maintained/register/esm scripts/verify_migration_baseline.ts [--execute]'
  )
  const branch = await git('branch', '--show-current')
  assert.equal(branch.trim(), 'refactor/company-review-compliance', 'Unexpected working branch')
  await mkdir(temporaryRoot, { recursive: true })
  const oldDirectory = await mkdtemp(join(temporaryRoot, 'phase2-old-migrations-'))
  const report: Record<string, unknown> = {
    oldCommit,
    mode: args.length ? 'execute' : 'compile',
    status: 'failed',
    runtimeGuard: {
      file: guardFile,
      evaluatedBySqlReplay: false,
      verification: 'scripts/verify_migration_guard.ts --execute (real Lucid runner)',
    },
  }
  try {
    await extractOldMigrations(oldDirectory)
    const oldSQL = await compile(oldDirectory)
    const newSQL = await compile(join(backendRoot, 'database', 'migrations'))
    report.migrations = { old: oldSQL, new: newSQL }
    report.status = 'compiled-only'
    if (args.length) Object.assign(report, await execute(oldSQL, newSQL))
    console.log(
      JSON.stringify(
        {
          status: report.status,
          oldMigrations: oldSQL.length,
          newMigrations: newSQL.length,
          comparisons: report.comparisons,
          error: report.error,
          report: reportPath,
        },
        null,
        2
      )
    )
    if (report.status === 'different' || report.status === 'failed') process.exitCode = 1
  } catch (error) {
    report.status = 'failed'
    report.error = error instanceof Error ? error.message : String(error)
    throw error
  } finally {
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
    const withinTemporaryRoot = relative(temporaryRoot, oldDirectory)
    assert(
      !withinTemporaryRoot.startsWith(`..${sep}`) &&
        withinTemporaryRoot.startsWith('phase2-old-migrations-')
    )
    await rm(oldDirectory, { recursive: true, force: false })
  }
}

await main()
