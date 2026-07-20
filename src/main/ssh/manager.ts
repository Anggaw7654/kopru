import { BrowserWindow } from 'electron'
import type { ConnectionSnapshot } from '../../shared/types/connection.js'
import type { IpcEventChannel, IpcEventMap } from '../../shared/ipc.js'
import { SshConnection } from './connection.js'
import * as profiles from './profiles.js'

const connections = new Map<string, SshConnection>()

/**
 * Registered by main at startup. Lives here as a callback rather than a direct
 * import so the terminal module can depend on the manager without the manager
 * depending back on it.
 */
type ReadyHandler = (profileId: string) => void
const readyHandlers: ReadyHandler[] = []
const lostHandlers: ReadyHandler[] = []

export function onConnectionReady(handler: ReadyHandler): void {
  readyHandlers.push(handler)
}

/** Fires when a connected profile stops being connected, for any reason. */
export function onConnectionLost(handler: ReadyHandler): void {
  lostHandlers.push(handler)
}

/** Push to every open window; tabs may live in any of them. */
export function broadcast<C extends IpcEventChannel>(channel: C, payload: IpcEventMap[C]): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(channel, payload)
  }
}

export function get(profileId: string): SshConnection | undefined {
  return connections.get(profileId)
}

export function require_(profileId: string): SshConnection {
  const connection = connections.get(profileId)
  if (!connection) throw new Error('Sunucuya bağlı değilsiniz.')
  return connection
}

export async function connect(profileId: string): Promise<void> {
  const profile = profiles.list().find((p) => p.id === profileId)
  if (!profile) throw new Error('Profil bulunamadı.')

  let connection = connections.get(profileId)
  if (!connection) {
    connection = new SshConnection(profile)
    connection.on('state', (snapshot: ConnectionSnapshot) => {
      broadcast('connection:state', snapshot)
      if (snapshot.state !== 'connected') {
        for (const handler of lostHandlers) handler(profileId)
      }
    })
    connection.on('ready', () => {
      for (const handler of readyHandlers) handler(profileId)
    })
    connection.on('mismatch', ({ pinned, presented }: { pinned: string; presented: string }) => {
      broadcast('connection:hostkey-mismatch', {
        profileId,
        host: profile.host,
        port: profile.port,
        pinnedFingerprint: pinned,
        presentedFingerprint: presented,
      })
    })
    connections.set(profileId, connection)
  } else {
    connection.updateProfile(profile)
  }

  await connection.connect()
}

export function disconnect(profileId: string): void {
  connections.get(profileId)?.disconnect()
}

export function status(): ConnectionSnapshot[] {
  return [...connections.values()].map((c) => c.snapshot)
}

export function disconnectAll(): void {
  for (const connection of connections.values()) connection.disconnect()
  connections.clear()
}

/** Called once at startup for every profile flagged auto-connect. */
export async function autoConnect(): Promise<void> {
  for (const profile of profiles.list()) {
    if (!profile.autoConnect) continue
    try {
      await connect(profile.id)
    } catch (error) {
      // One bad profile must not stop the others; the failure is already
      // visible in that profile's connection state.
      const detail = error instanceof Error ? error.message : String(error)
      console.error(`[kopru] otomatik bağlantı başarısız (${profile.name}): ${detail}`)
    }
  }
}
