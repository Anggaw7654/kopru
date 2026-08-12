import type { Client } from 'pg'
import type {
  Activity, BloatEntry, HealthReport, PostgresConfig, SlowQuery, UnusedIndex,
} from '../../../shared/types/postgres.js'
import { withClient } from './pool.js'
import { m } from '../../i18n.js'

/** Extension may not be installed; that is reported, never faked. */
async function slowQueries(
  client: Client,
): Promise<{ rows: SlowQuery[] | null; note?: string }> {
  const installed = await client.query<{ present: boolean }>(
    "select count(*) > 0 as present from pg_extension where extname = 'pg_stat_statements'",
  )
  if (installed.rows[0]?.present !== true) {
    return {
      rows: null,
      note:
        'pg_stat_statements eklentisi kurulu değil, bu yüzden en yavaş sorgular ' +
        'listelenemiyor. Kurmak için: shared_preload_libraries listesine ekleyip ' +
        'CREATE EXTENSION pg_stat_statements çalıştırın.',
    }
  }

  try {
    const result = await client.query<{
      query: string; calls: string; total_ms: string; mean_ms: string
    }>(
      `select query,
              calls::text,
              total_exec_time::text as total_ms,
              mean_exec_time::text  as mean_ms
         from pg_stat_statements
        order by total_exec_time desc
        limit 20`,
    )
    return {
      rows: result.rows.map((row) => ({
        query: row.query,
        calls: Number(row.calls),
        totalMs: Number(row.total_ms),
        meanMs: Number(row.mean_ms),
      })),
    }
  } catch {
    // Column names differ before PG 13 (total_time vs total_exec_time).
    return {
      rows: null,
      note: m('pg_stat_statements okunamadı; sürüm uyumsuz olabilir.'),
    }
  }
}

export async function report(
  profileId: string,
  database: string,
  config: PostgresConfig,
): Promise<HealthReport> {
  return withClient(profileId, database, config, async (client: Client) => {
    const activity = await client.query<{
      pid: number; usename: string | null; datname: string | null; state: string | null;
      duration: string | null; wait_event: string | null; query: string | null
    }>(
      `select pid,
              usename,
              datname,
              state,
              extract(epoch from (now() - query_start))::text as duration,
              wait_event,
              query
         from pg_stat_activity
        where pid <> pg_backend_pid()
          and backend_type = 'client backend'
        order by query_start nulls last`,
    )

    const limits = await client.query<{ used: string; max: string }>(
      `select (select count(*) from pg_stat_activity)::text as used,
              current_setting('max_connections') as max`,
    )

    const bloat = await client.query<{ table: string; dead: string; live: string }>(
      `select schemaname || '.' || relname as table,
              n_dead_tup::text as dead,
              n_live_tup::text as live
         from pg_stat_user_tables
        where n_dead_tup > 1000
        order by n_dead_tup desc
        limit 20`,
    )

    const unused = await client.query<{ table: string; index: string; size: string }>(
      `select s.schemaname || '.' || s.relname as table,
              s.indexrelname as index,
              pg_relation_size(s.indexrelid)::text as size
         from pg_stat_user_indexes s
         join pg_index i on i.indexrelid = s.indexrelid
        where s.idx_scan = 0
          and not i.indisunique
          and not i.indisprimary
        order by pg_relation_size(s.indexrelid) desc
        limit 20`,
    )

    const slow = await slowQueries(client)

    const activityRows: Activity[] = activity.rows.map((row) => ({
      pid: row.pid,
      user: row.usename ?? '—',
      database: row.datname ?? '—',
      state: row.state ?? 'unknown',
      durationSeconds: Number(row.duration ?? 0),
      waitEvent: row.wait_event,
      query: row.query ?? '',
    }))

    const bloatRows: BloatEntry[] = bloat.rows.map((row) => {
      const dead = Number(row.dead)
      const live = Number(row.live)
      return { table: row.table, deadRows: dead, liveRows: live, ratio: dead / (dead + live || 1) }
    })

    const unusedRows: UnusedIndex[] = unused.rows.map((row) => ({
      table: row.table,
      index: row.index,
      sizeBytes: Number(row.size),
    }))

    return {
      activity: activityRows,
      connections: {
        used: Number(limits.rows[0]?.used ?? 0),
        max: Number(limits.rows[0]?.max ?? 0),
      },
      slowQueries: slow.rows,
      ...(slow.note !== undefined ? { slowQueryNote: slow.note } : {}),
      bloat: bloatRows,
      unusedIndexes: unusedRows,
    }
  })
}

/**
 * Cancels a running statement. This needs a connection other than the stuck
 * one, which is why the pool keeps more than one (see pool.ts).
 *
 * `pg_cancel_backend` first: it asks the backend to stop its current statement
 * and leaves the session intact. Terminating the whole backend is the harsher
 * option and rolls back anything in flight, so it is opt-in.
 */
export async function cancelQuery(
  profileId: string,
  database: string,
  config: PostgresConfig,
  pid: number,
  terminate: boolean,
): Promise<boolean> {
  return withClient(profileId, database, config, async (client: Client) => {
    const fn = terminate ? 'pg_terminate_backend' : 'pg_cancel_backend'
    const result = await client.query<{ ok: boolean }>(`select ${fn}($1) as ok`, [pid])
    return result.rows[0]?.ok ?? false
  })
}
