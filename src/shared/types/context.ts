import type { Redaction } from '../redact.js'

export type ContextKind = 'file' | 'log' | 'sql' | 'terminal' | 'system' | 'note'

export interface ContextItem {
  id: string
  kind: ContextKind
  /** Shown in the basket list, e.g. a path or container name. */
  label: string
  /** Already redacted. Raw text never reaches the store. */
  content: string
  redactions: Redaction[]
  addedAt: number
  /** Fenced-block language for the rendered markdown. */
  language?: string
}

/** Server-side facts, gathered fresh when the user asks for them. */
export interface SystemSummary {
  profileName: string
  host: string
  osRelease: string
  uptime: string
  metrics?: string
  docker?: string
  postgres?: string
}
