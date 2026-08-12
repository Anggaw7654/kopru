import { randomUUID } from 'node:crypto'
import { statSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { Transfer, TransferDirection } from '../../../shared/types/files.js'
import { broadcast } from '../../ssh/manager.js'
import { channel } from './sftp.js'
import { joinPath } from './paths.js'
import { stat as remoteStat } from './operations.js'
import { m } from '../../i18n.js'

/**
 * Sequential queue on the dedicated transfer channel.
 *
 * One at a time on purpose: parallel transfers over a single SSH connection
 * share the same window and only make each other slower, while making progress
 * reporting meaningless.
 */
const transfers = new Map<string, Transfer>()
const cancelled = new Set<string>()
let running = false

function emit(transfer: Transfer): void {
  transfers.set(transfer.id, transfer)
  broadcast('transfer:update', { ...transfer })
}

function enqueue(
  profileId: string,
  direction: TransferDirection,
  localPath: string,
  remotePath: string,
  bytesTotal: number,
): void {
  emit({
    id: randomUUID(),
    profileId,
    direction,
    name: direction === 'upload' ? basename(localPath) : remotePath.split('/').pop() ?? remotePath,
    localPath,
    remotePath,
    bytesTotal,
    bytesDone: 0,
    state: 'queued',
  })
}

export function list(): Transfer[] {
  return [...transfers.values()]
}

export function cancel(id: string): void {
  const transfer = transfers.get(id)
  if (!transfer) return
  if (transfer.state === 'done' || transfer.state === 'error') return
  cancelled.add(id)
  if (transfer.state === 'queued') {
    emit({ ...transfer, state: 'cancelled' })
  }
  // A running transfer notices the flag on its next progress tick.
}

export function clearFinished(): void {
  for (const [id, transfer] of transfers) {
    if (transfer.state === 'done' || transfer.state === 'error' || transfer.state === 'cancelled') {
      transfers.delete(id)
      cancelled.delete(id)
    }
  }
}

async function runOne(transfer: Transfer): Promise<void> {
  const sftp = await channel(transfer.profileId, 'transfer')
  emit({ ...transfer, state: 'running' })

  let lastEmit = 0
  const onStep = (_total: number, _chunk: number, done: number): void => {
    if (cancelled.has(transfer.id)) return
    const now = Date.now()
    // Throttle: an unthrottled fastGet fires per 32 KB chunk and would flood
    // every window with IPC messages on a large file.
    if (now - lastEmit < 120) return
    lastEmit = now
    emit({ ...transfer, state: 'running', bytesDone: done })
  }

  await new Promise<void>((resolve, reject) => {
    const done = (err: Error | null | undefined): void => {
      if (cancelled.has(transfer.id)) {
        emit({ ...transfer, state: 'cancelled' })
        resolve()
        return
      }
      if (err) reject(err)
      else resolve()
    }

    if (transfer.direction === 'download') {
      sftp.fastGet(transfer.remotePath, transfer.localPath, { step: onStep }, done)
    } else {
      sftp.fastPut(transfer.localPath, transfer.remotePath, { step: onStep }, done)
    }
  })

  if (!cancelled.has(transfer.id)) {
    emit({ ...transfer, state: 'done', bytesDone: transfer.bytesTotal })
    if (transfer.direction === 'upload') {
      broadcast('fs:invalidate', {
        profileId: transfer.profileId,
        path: transfer.remotePath.slice(0, transfer.remotePath.lastIndexOf('/')) || '/',
      })
    }
  }
}

async function pump(): Promise<void> {
  if (running) return
  running = true
  try {
    for (;;) {
      const next = [...transfers.values()].find((t) => t.state === 'queued')
      if (!next) break
      if (cancelled.has(next.id)) {
        emit({ ...next, state: 'cancelled' })
        continue
      }
      try {
        await runOne(next)
      } catch (error) {
        emit({
          ...next,
          state: 'error',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  } finally {
    running = false
  }
}

export function upload(profileId: string, localPaths: string[], destinationDir: string): void {
  for (const localPath of localPaths) {
    let size: number
    try {
      const stats = statSync(localPath)
      if (stats.isDirectory()) {
        // SFTP has no recursive put; a folder upload needs a walk, which is not
        // in this phase. Surface it instead of silently skipping.
        emit({
          id: randomUUID(),
          profileId,
          direction: 'upload',
          name: basename(localPath),
          localPath,
          remotePath: joinPath(destinationDir, basename(localPath)),
          bytesTotal: 0,
          bytesDone: 0,
          state: 'error',
          error: m('Klasör yüklemesi henüz desteklenmiyor; önce sıkıştırın.'),
        })
        continue
      }
      size = stats.size
    } catch {
      continue
    }
    enqueue(profileId, 'upload', localPath, joinPath(destinationDir, basename(localPath)), size)
  }
  void pump()
}

export async function download(
  profileId: string,
  remotePaths: string[],
  destinationDir: string,
): Promise<void> {
  const sftp = await channel(profileId)
  for (const remotePath of remotePaths) {
    const stats = await remoteStat(sftp, remotePath).catch(() => null)
    if (stats === null) continue
    if ((stats.mode & 0o170000) === 0o040000) {
      emit({
        id: randomUUID(),
        profileId,
        direction: 'download',
        name: remotePath.split('/').pop() ?? remotePath,
        localPath: '',
        remotePath,
        bytesTotal: 0,
        bytesDone: 0,
        state: 'error',
        error: m('Klasör indirmesi henüz desteklenmiyor; önce sunucuda sıkıştırın.'),
      })
      continue
    }
    const name = remotePath.split('/').pop() ?? 'dosya'
    enqueue(profileId, 'download', join(destinationDir, name), remotePath, stats.size)
  }
  void pump()
}
