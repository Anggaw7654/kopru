import type { ClientChannel } from 'ssh2'
import type { LogRequest } from '../../../shared/types/docker.js'
import { broadcast, require_ as requireConnection } from '../../ssh/manager.js'
import { run } from '../files/exec.js'
import { shellQuote } from '../files/paths.js'
import { requireDocker } from './detect.js'

/**
 * A `docker logs -f` channel stays open until something closes it. There are
 * three ways a follow ends — the user toggles it off, switches container, or
 * the connection drops — and all three must reach here. An unclosed channel
 * leaks for the life of the session and walks the server toward MaxSessions,
 * which is the exact failure the single-chain design in ADR 0009 avoids.
 */
const follows = new Map<string, ClientChannel>()

function key(profileId: string, containerId: string): string {
  return `${profileId}:${containerId}`
}

export async function tail(request: LogRequest): Promise<string> {
  await requireDocker(request.profileId)
  const result = await run(
    request.profileId,
    // 2>&1 because container stderr is where most applications log.
    `docker logs --tail ${String(request.tail)} ${shellQuote(request.containerId)} 2>&1`,
  )
  if (result.code !== 0 && result.stdout.trim() === '') {
    throw new Error(`Log alınamadı: ${result.stderr.trim() || 'bilinmeyen hata'}`)
  }
  return result.stdout
}

export async function startFollow(profileId: string, containerId: string): Promise<void> {
  stopFollow(profileId, containerId)
  await requireDocker(profileId)

  const connection = requireConnection(profileId)
  const channel = await connection.exec(
    `docker logs -f --tail 0 ${shellQuote(containerId)} 2>&1`,
  )
  follows.set(key(profileId, containerId), channel)

  const forward = (chunk: Buffer): void => {
    broadcast('docker:log-chunk', { containerId, chunk: chunk.toString('utf8') })
  }
  channel.on('data', forward)
  channel.stderr.on('data', forward)
  channel.on('close', () => {
    follows.delete(key(profileId, containerId))
  })
}

export function stopFollow(profileId: string, containerId: string): void {
  const channel = follows.get(key(profileId, containerId))
  if (!channel) return
  channel.close()
  follows.delete(key(profileId, containerId))
}

/** Called on disconnect: those channels are already dead, drop the handles. */
export function stopAllFor(profileId: string): void {
  for (const [id, channel] of [...follows]) {
    if (!id.startsWith(`${profileId}:`)) continue
    try {
      channel.close()
    } catch {
      // The channel died with the connection; nothing to close.
    }
    follows.delete(id)
  }
}

/**
 * Opens a shell inside a container by writing into an existing pty-backed
 * terminal channel, rather than building a second pty mechanism: `docker exec
 * -it` needs a tty and the terminal module already has one.
 */
export function shellCommand(containerId: string): string {
  const id = shellQuote(containerId)
  // Prefer bash when the image has it; plenty of images (alpine) only have sh.
  return `docker exec -it ${id} sh -c 'command -v bash >/dev/null 2>&1 && exec bash || exec sh'`
}
