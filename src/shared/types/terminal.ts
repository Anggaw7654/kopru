export interface TerminalCreateRequest {
  profileId: string
  cols: number
  rows: number
  /** Start the shell in this directory, when known (used by "open in terminal"). */
  cwd?: string
}

export interface TerminalSession {
  sessionId: string
  profileId: string
}

export interface TerminalResize {
  sessionId: string
  cols: number
  rows: number
}

export interface TerminalWrite {
  sessionId: string
  data: string
}

export interface TerminalData {
  sessionId: string
  chunk: string
}

export interface TerminalExit {
  sessionId: string
  code: number | null
  signal: string | null
}
