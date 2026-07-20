import type { SFTPWrapper } from 'ssh2'
import { require_ as requireConnection } from '../../ssh/manager.js'

/**
 * Two SFTP channels per profile, on purpose.
 *
 * A single channel serialises requests: a 2 GB download would block every
 * directory listing behind it and the browser UI would appear frozen. Browsing
 * and transfers therefore get their own channel — still on the one TCP
 * connection (ADR 0001), just separate streams.
 */
type Lane = 'browse' | 'transfer'

const channels = new Map<string, SFTPWrapper>()
const pending = new Map<string, Promise<SFTPWrapper>>()

function key(profileId: string, lane: Lane): string {
  return `${profileId}:${lane}`
}

export async function channel(profileId: string, lane: Lane = 'browse'): Promise<SFTPWrapper> {
  const id = key(profileId, lane)

  const existing = channels.get(id)
  if (existing) return existing

  // Two rapid calls must not open two channels for the same lane.
  const inFlight = pending.get(id)
  if (inFlight) return inFlight

  const connection = requireConnection(profileId)
  const promise = connection
    .sftp()
    .then((sftp) => {
      sftp.on('close', () => {
        channels.delete(id)
      })
      sftp.on('error', () => {
        channels.delete(id)
      })
      channels.set(id, sftp)
      pending.delete(id)
      return sftp
    })
    .catch((error: unknown) => {
      pending.delete(id)
      throw error
    })

  pending.set(id, promise)
  return promise
}

/** Called when a connection drops; the channels went with it. */
export function reset(profileId: string): void {
  for (const lane of ['browse', 'transfer'] as const) {
    const id = key(profileId, lane)
    channels.delete(id)
    pending.delete(id)
  }
}
