import type { Client, QueryResult as PgResult } from 'pg'
import type {
  DangerAssessment,
  DangerKind,
  PostgresConfig,
  QueryRequest,
  QueryResult,
} from '../../../shared/types/postgres.js'
import { withClient } from './pool.js'

/**
 * Read-only mode is enforced by PostgreSQL, not by pattern matching.
 *
 * Every statement runs inside `BEGIN TRANSACTION READ ONLY`. The engine then
 * rejects any write with SQLSTATE 25006, and it does so for cases no regex
 * survives: writes inside CTEs, DO blocks, functions called from a SELECT,
 * comment-obfuscated keywords, or a second statement after a semicolon.
 *
 * The pattern check below still exists, but its job is a *warning dialog* — it
 * is not the boundary. Treating a regex as the boundary would be selling a
 * guarantee we cannot keep (ADR 0013).
 */

const READ_ONLY_SQLSTATE = '25006'

/** Values reach the renderer as strings; no pg type ever crosses IPC. */
function stringify(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) {
    const pad = (n: number): string => String(n).padStart(2, '0')
    // Project standard: GG.AA.YYYY SS:DD:SS
    return (
      `${pad(value.getDate())}.${pad(value.getMonth() + 1)}.${String(value.getFullYear())} ` +
      `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
    )
  }
  if (Buffer.isBuffer(value)) return `\\x${value.toString('hex')}`
  if (typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  // Anything else (symbol, function) cannot come out of pg; be explicit rather
  // than emitting "[object Object]" into a data grid.
  return null
}

function toResult(result: PgResult, durationMs: number): QueryResult {
  const fields = result.fields.map((field) => ({
    name: field.name,
    dataTypeId: field.dataTypeID,
  }))
  return {
    fields,
    rows: (result.rows as Record<string, unknown>[]).map((row) =>
      fields.map((field) => stringify(row[field.name])),
    ),
    rowCount: result.rowCount ?? result.rows.length,
    durationMs,
    command: result.command,
  }
}

function isReadOnlyViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === READ_ONLY_SQLSTATE
  )
}

export async function execute(request: QueryRequest, config: PostgresConfig): Promise<QueryResult> {
  return withClient(request.profileId, request.database, config, async (client: Client) => {
    const started = Date.now()

    // READ ONLY for browsing, READ WRITE explicitly for write mode — never an
    // implicit autocommit, so a half-applied multi-statement script rolls back
    // instead of leaving the database in between.
    await client.query(request.readOnly ? 'BEGIN TRANSACTION READ ONLY' : 'BEGIN')
    try {
      const raw: unknown = await client.query(request.sql)
      // pg returns an array when the text held several statements; the last one
      // is what the user sees, matching psql.
      const single = (Array.isArray(raw) ? raw.at(-1) : raw) as PgResult
      await client.query('COMMIT')
      return toResult(single, Date.now() - started)
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)

      if (isReadOnlyViolation(error)) {
        return {
          fields: [],
          rows: [],
          rowCount: 0,
          durationMs: Date.now() - started,
          command: '',
          blockedByReadOnly: true,
        }
      }
      throw new Error(error instanceof Error ? error.message : String(error), { cause: error })
    }
  })
}

export async function explain(request: QueryRequest, config: PostgresConfig): Promise<string> {
  return withClient(request.profileId, request.database, config, async (client: Client) => {
    // ANALYZE actually runs the statement. Inside a read-only transaction a
    // write plan is refused rather than executed, which is the safe default for
    // a button labelled "explain".
    await client.query('BEGIN TRANSACTION READ ONLY')
    try {
      const result = await client.query<{ 'QUERY PLAN': string }>(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${request.sql}`,
      )
      await client.query('COMMIT')
      return result.rows.map((row) => row['QUERY PLAN']).join('\n')
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      if (isReadOnlyViolation(error)) {
        throw new Error(
          'Bu ifade veri değiştiriyor; EXPLAIN ANALYZE onu gerçekten çalıştıracağı için ' +
            'salt-okunur modda engellendi.',
          { cause: error },
        )
      }
      throw new Error(error instanceof Error ? error.message : String(error), { cause: error })
    }
  })
}

/** Strip strings and comments so keyword matching cannot be fooled by literals. */
function normalise(sql: string): string {
  return sql
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

/**
 * Classifies a statement for the confirmation dialog. Deliberately conservative
 * — a false positive costs one extra click, a false negative costs data. It is
 * *not* what stops a write in read-only mode; the transaction is.
 */
export function assess(sql: string): { kinds: DangerKind[]; dangerous: boolean } {
  const text = normalise(sql)
  const kinds: DangerKind[] = []

  if (/\bdrop\s+(table|database|schema|index|view|column|function|type)\b/.test(text)) {
    kinds.push('drop')
  }
  if (/\btruncate\b/.test(text)) kinds.push('truncate')
  if (/\bdelete\s+from\b/.test(text) && !/\bwhere\b/.test(text)) kinds.push('unfiltered-delete')
  if (/\bupdate\b\s+\S+\s+\bset\b/.test(text) && !/\bwhere\b/.test(text)) {
    kinds.push('unfiltered-update')
  }
  if (/\balter\s+(table|database|schema|type|sequence)\b/.test(text)) kinds.push('alter')

  return { kinds, dangerous: kinds.length > 0 }
}

/**
 * Asks the planner how many rows a statement would touch, so the confirmation
 * can say "142.000 satır" instead of "bu tehlikeli olabilir".
 */
export async function assessWithEstimate(
  request: QueryRequest,
  config: PostgresConfig,
): Promise<DangerAssessment> {
  const { kinds, dangerous } = assess(request.sql)
  if (!dangerous) return { dangerous: false, kinds: [], estimatedRows: null }

  let estimatedRows: number | null = null
  // Only DML has a row estimate; DDL does not, and asking would just error.
  if (kinds.includes('unfiltered-delete') || kinds.includes('unfiltered-update')) {
    try {
      estimatedRows = await withClient(
        request.profileId,
        request.database,
        config,
        async (client: Client) => {
          // Plain EXPLAIN does not execute — safe for a statement we have not
          // been authorised to run yet.
          const result = await client.query<{ 'QUERY PLAN': Record<string, unknown>[] }>(
            `EXPLAIN (FORMAT JSON) ${request.sql}`,
          )
          const first = result.rows[0]?.['QUERY PLAN']?.[0] as
            { Plan?: Record<string, unknown> } | undefined
          const rows = first?.Plan?.['Plan Rows']
          return typeof rows === 'number' ? rows : null
        },
      )
    } catch {
      // No estimate is better than a wrong one; the dialog says "bilinmiyor".
      estimatedRows = null
    }
  }

  return { dangerous: true, kinds, estimatedRows }
}
