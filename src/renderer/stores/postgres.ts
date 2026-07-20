import { create } from 'zustand'
import type { DatabaseInfo, SchemaInfo, TableRef } from '@shared/types/postgres.js'

const HISTORY_KEY = 'kopru.sqlHistory'
const HISTORY_LIMIT = 50

function readHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

interface PostgresStore {
  database: string
  databases: DatabaseInfo[]
  schemas: SchemaInfo[]
  selectedTable: TableRef | null
  /**
   * Write mode is off on every open, and is never persisted. A panel that
   * remembered it would eventually be left writable by accident.
   */
  writeMode: boolean
  history: string[]

  setDatabase: (database: string) => void
  setDatabases: (databases: DatabaseInfo[]) => void
  setSchemas: (schemas: SchemaInfo[]) => void
  selectTable: (table: TableRef | null) => void
  setWriteMode: (writeMode: boolean) => void
  pushHistory: (sql: string) => void
}

export const usePostgresStore = create<PostgresStore>((set, get) => ({
  database: 'postgres',
  databases: [],
  schemas: [],
  selectedTable: null,
  writeMode: false,
  history: readHistory(),

  setDatabase: (database) => {
    set({ database, schemas: [], selectedTable: null })
  },
  setDatabases: (databases) => {
    set({ databases })
  },
  setSchemas: (schemas) => {
    set({ schemas })
  },
  selectTable: (selectedTable) => {
    set({ selectedTable })
  },
  setWriteMode: (writeMode) => {
    set({ writeMode })
  },
  pushHistory: (sql) => {
    const trimmed = sql.trim()
    if (trimmed === '') return
    const history = [trimmed, ...get().history.filter((h) => h !== trimmed)].slice(0, HISTORY_LIMIT)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
    set({ history })
  },
}))
