export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'

/** Current state of one profile's connection, as broadcast to every window. */
export interface ConnectionSnapshot {
  profileId: string
  state: ConnectionState
  /** Turkish, user-facing. Never contains credentials. */
  message?: string
  /** Which reconnect attempt we are on; 0 when not reconnecting. */
  attempt: number
  /** ms until the next reconnect attempt, when state === 'reconnecting'. */
  nextRetryInMs?: number
}

/** Raised when a pinned host key no longer matches. Connection is refused. */
export interface HostKeyMismatch {
  profileId: string
  host: string
  port: number
  pinnedFingerprint: string
  presentedFingerprint: string
}
