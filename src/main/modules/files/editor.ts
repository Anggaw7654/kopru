import { randomUUID } from 'node:crypto'
import type { SFTPWrapper } from 'ssh2'
import type {
  OpenFileResult,
  PathRequest,
  SaveFileRequest,
  SaveFileResult,
} from '../../../shared/types/files.js'
import { channel } from './sftp.js'
import { stat } from './operations.js'
import { languageFor, shellQuote } from './paths.js'
import { run } from './exec.js'
import { promptForPassword } from './sudo.js'

const EDIT_LIMIT_BYTES = 5 * 1024 * 1024

function readAll(sftp: SFTPWrapper, path: string, size: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    sftp.open(path, 'r', (openErr, handle) => {
      if (openErr) {
        reject(new Error(`Açılamadı: ${path}`))
        return
      }
      const buffer = Buffer.alloc(size)
      sftp.read(handle, buffer, 0, size, 0, (readErr, bytesRead) => {
        sftp.close(handle, () => {
          /* best effort */
        })
        if (readErr) reject(new Error(`Okunamadı: ${path}`))
        else resolve(buffer.subarray(0, bytesRead))
      })
    })
  })
}

function writeAll(sftp: SFTPWrapper, path: string, content: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.open(path, 'w', (openErr, handle) => {
      if (openErr) {
        reject(openErr)
        return
      }
      sftp.write(handle, content, 0, content.length, 0, (writeErr) => {
        sftp.close(handle, () => {
          /* best effort */
        })
        if (writeErr) reject(writeErr)
        else resolve()
      })
    })
  })
}

export async function open(request: PathRequest): Promise<OpenFileResult> {
  const sftp = await channel(request.profileId)
  const stats = await stat(sftp, request.path)

  if (stats.size > EDIT_LIMIT_BYTES) {
    throw new Error(
      `Dosya düzenleyici için çok büyük (${(stats.size / 1024 / 1024).toFixed(1)} MB). ` +
        'Önizleme ile bakabilir veya Mac’e indirebilirsiniz.',
    )
  }

  const data = await readAll(sftp, request.path, stats.size)
  if (data.subarray(0, 8192).includes(0)) {
    throw new Error('Bu bir metin dosyası değil; düzenleyicide açılamaz.')
  }

  // Cheapest reliable writability check: ask the server, don't guess from mode
  // bits — that would ignore ACLs, read-only mounts and group membership.
  const probe = await run(request.profileId, `test -w ${shellQuote(request.path)} && echo yes`)
  const readOnlyForUser = probe.stdout.trim() !== 'yes'

  return {
    path: request.path,
    content: data.toString('utf8'),
    language: languageFor(request.path),
    modified: stats.mtime * 1000,
    readOnlyForUser,
  }
}

async function saveWithSudo(request: SaveFileRequest, content: Buffer): Promise<SaveFileResult> {
  const password = await promptForPassword(
    `${request.path} dosyasını yönetici olarak kaydetmek için parolanız gerekiyor.`,
  )
  if (password === null) return { ok: false, reason: 'sudo-cancelled' }

  const sftp = await channel(request.profileId)
  const temp = `/tmp/.kopru-${randomUUID()}`

  try {
    await writeAll(sftp, temp, content)

    // `cp` into the existing file rather than `mv` over it: mv would replace
    // the inode and hand the target the temp file's owner and 0600 mode, which
    // silently breaks config files that a daemon reads as another user.
    const quotedTemp = shellQuote(temp)
    const quotedTarget = shellQuote(request.path)
    const result = await run(
      request.profileId,
      `sudo -S -p '' cp -- ${quotedTemp} ${quotedTarget}`,
      // The password goes down stdin, never argv: argv is world-readable in /proc.
      `${password}\n`,
    )

    if (result.code !== 0) {
      const stderr = result.stderr.toLowerCase()
      const message = stderr.includes('incorrect password') || stderr.includes('try again')
        ? 'Parola yanlış.'
        : result.stderr.trim() || 'sudo komutu başarısız oldu.'
      return { ok: false, reason: 'sudo-failed', message }
    }

    const stats = await stat(sftp, request.path)
    return { ok: true, modified: stats.mtime * 1000 }
  } finally {
    // Remove the plaintext copy from /tmp whether or not the write succeeded.
    await run(request.profileId, `rm -f -- ${shellQuote(temp)}`).catch(() => undefined)
  }
}

export async function save(request: SaveFileRequest): Promise<SaveFileResult> {
  const sftp = await channel(request.profileId)

  if (!request.force) {
    const current = await stat(sftp, request.path).catch(() => null)
    if (current !== null && current.mtime * 1000 !== request.expectedModified) {
      return { ok: false, reason: 'conflict', serverModified: current.mtime * 1000 }
    }
  }

  const content = Buffer.from(request.content, 'utf8')

  if (request.useSudo) return saveWithSudo(request, content)

  try {
    await writeAll(sftp, request.path, content)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/permission denied/i.test(message)) return { ok: false, reason: 'permission' }
    throw new Error(`Kaydedilemedi: ${message}`, { cause: error })
  }

  const stats = await stat(sftp, request.path)
  return { ok: true, modified: stats.mtime * 1000 }
}
