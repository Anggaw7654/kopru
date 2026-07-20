export interface PostgresConfig {
  enabled: boolean
  /** From the server's point of view — usually 127.0.0.1. */
  host: string
  port: number
  database: string
  user: string
  statementTimeoutMs: number
  /** Mirrors the profile secret flags; the password itself never crosses IPC. */
  hasPassword?: boolean
}

export const DEFAULT_POSTGRES: PostgresConfig = {
  enabled: false,
  host: '127.0.0.1',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  statementTimeoutMs: 30_000,
}

export interface DatabaseInfo {
  name: string
  sizeBytes: number
  /** False for template databases, which cannot be connected to normally. */
  connectable: boolean
}

export interface TableRef {
  schema: string
  name: string
  kind: 'table' | 'view' | 'matview'
  /** Planner estimate from pg_class.reltuples — an exact count needs a full scan. */
  estimatedRows: number
  sizeBytes: number
}

export interface SchemaInfo {
  name: string
  tables: TableRef[]
}

export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  defaultValue: string | null
  isPrimaryKey: boolean
}

export interface IndexInfo {
  name: string
  definition: string
  isUnique: boolean
  isPrimary: boolean
  scans: number
  sizeBytes: number
}

export interface TableDetail {
  table: TableRef
  columns: ColumnInfo[]
  indexes: IndexInfo[]
}

export interface QueryField {
  name: string
  dataTypeId: number
}

export interface QueryResult {
  fields: QueryField[]
  /** Values are stringified in main; the renderer never handles a pg type. */
  rows: (string | null)[][]
  rowCount: number
  durationMs: number
  /** SELECT, INSERT, UPDATE… as reported by the server. */
  command: string
  /** True when the read-only transaction refused a write (SQLSTATE 25006). */
  blockedByReadOnly?: boolean
}

export interface QueryRequest {
  profileId: string
  database: string
  sql: string
  readOnly: boolean
  limit?: number
  offset?: number
}

export type DangerKind = 'drop' | 'truncate' | 'unfiltered-delete' | 'unfiltered-update' | 'alter'

export interface DangerAssessment {
  dangerous: boolean
  kinds: DangerKind[]
  /** Planner estimate of affected rows, when one could be obtained. */
  estimatedRows: number | null
}

export interface Activity {
  pid: number
  user: string
  database: string
  state: string
  /** Seconds the current statement has been running. */
  durationSeconds: number
  waitEvent: string | null
  query: string
}

export interface SlowQuery {
  query: string
  calls: number
  totalMs: number
  meanMs: number
}

export interface BloatEntry {
  table: string
  deadRows: number
  liveRows: number
  ratio: number
}

export interface UnusedIndex {
  table: string
  index: string
  sizeBytes: number
}

export interface HealthReport {
  activity: Activity[]
  connections: { used: number; max: number }
  /** Null when pg_stat_statements is absent — reported, never faked. */
  slowQueries: SlowQuery[] | null
  slowQueryNote?: string
  bloat: BloatEntry[]
  unusedIndexes: UnusedIndex[]
}

export interface BackupRequest {
  profileId: string
  database: string
}
