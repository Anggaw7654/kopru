import { randomUUID } from 'node:crypto'
import type { ClientChannel } from 'ssh2'
import type { TerminalCreateRequest, TerminalSession } from '../../../shared/types/terminal.js'
import { broadcast, require_ as requireConnection } from '../../ssh/manager.js'

interface Session {
  sessionId: string
  profileId: string
  channel: ClientChannel | null
  cols: number
  rows: number
  /** Set when the user closed the tab, so a channel close isn't treated as a drop. */
  closing: boolean
}

const sessions = new Map<string, Session>()

function attach(session: Session, channel: ClientChannel): void {
  session.channel = channel

  channel.on('data', (chunk: Buffer) => {
    broadcast('terminal:data', { sessionId: session.sessionId, chunk: chunk.toString('utf8') })
  })

  // stderr of a pty is usually folded into stdout, but exec-style channels and
  // some servers still split it; dropping it would silently hide errors.
  channel.stderr.on('data', (chunk: Buffer) => {
    broadcast('terminal:data', { sessionId: session.sessionId, chunk: chunk.toString('utf8') })
  })

  channel.on('close', () => {
    session.channel = null
    if (session.closing) {
      sessions.delete(session.sessionId)
      return
    }
    broadcast('terminal:exit', { sessionId: session.sessionId, code: null, signal: null })
  })
}

export async function create(request: TerminalCreateRequest): Promise<TerminalSession> {
  const connection = requireConnection(request.profileId)
  const session: Session = {
    sessionId: randomUUID(),
    profileId: request.profileId,
    channel: null,
    cols: request.cols,
    rows: request.rows,
    closing: false,
  }

  const options: { cols: number; rows: number; cwd?: string } = {
    cols: request.cols,
    rows: request.rows,
  }
  if (request.cwd !== undefined) options.cwd = request.cwd

  const channel = await connection.shell(options)
  attach(session, channel)
  sessions.set(session.sessionId, session)

  return { sessionId: session.sessionId, profileId: session.profileId }
}

export function write(sessionId: string, data: string): void {
  sessions.get(sessionId)?.channel?.write(data)
}

export function resize(sessionId: string, cols: number, rows: number): void {
  const session = sessions.get(sessionId)
  if (!session) return
  session.cols = cols
  session.rows = rows
  // Last two args are pixel dimensions; 0 means "unspecified", which every
  // server we care about accepts.
  session.channel?.setWindow(rows, cols, 0, 0)
}

export function close(sessionId: string): void {
  const session = sessions.get(sessionId)
  if (!session) return
  session.closing = true
  session.channel?.end()
  sessions.delete(sessionId)
}

/**
 * After a reconnect the old remote ptys are gone for good (ADR 0004). We give
 * each surviving tab a fresh shell and tell the UI to mark it, rather than
 * pretending the session continued.
 */
export async function reviveFor(profileId: string): Promise<void> {
  const connection = requireConnection(profileId)
  for (const session of sessions.values()) {
    if (session.profileId !== profileId || session.channel !== null) continue
    try {
      const channel = await connection.shell({ cols: session.cols, rows: session.rows })
      attach(session, channel)
      broadcast('terminal:restored', { sessionId: session.sessionId })
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      broadcast('terminal:data', {
        sessionId: session.sessionId,
        chunk: `\r\n\x1b[31m[Köprü] Oturum yenilenemedi: ${detail}\x1b[0m\r\n`,
      })
    }
  }
}

export function closeAllFor(profileId: string): void {
  for (const session of [...sessions.values()]) {
    if (session.profileId === profileId) close(session.sessionId)
  }
}
