import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { app, dialog } from 'electron'

interface PinFile {
  version: 1
  /** key: "host:port" -> OpenSSH-style SHA256 fingerprint */
  pins: Record<string, string>
}

function filePath(): string {
  return join(app.getPath('userData'), 'hostkeys.json')
}

function read(): PinFile {
  const path = filePath()
  if (!existsSync(path)) return { version: 1, pins: {} }
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (typeof parsed === 'object' && parsed !== null && 'pins' in parsed) {
    return parsed as PinFile
  }
  throw new Error(`Host key dosyası bozuk: ${path}`)
}

function write(data: PinFile): void {
  const path = filePath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(data, null, 2), { mode: 0o600 })
}

/** OpenSSH prints `SHA256:<base64 without padding>`; match that so users can diff by eye. */
export function fingerprint(key: Buffer): string {
  const digest = createHash('sha256').update(key).digest('base64').replace(/=+$/, '')
  return `SHA256:${digest}`
}

export type VerifyOutcome =
  | { ok: true }
  | { ok: false; reason: 'rejected' }
  | { ok: false; reason: 'mismatch'; pinned: string; presented: string }

/**
 * Trust on first use, then pin hard.
 *
 * A mismatch is refused outright with no override (ADR 0003): the user cannot
 * distinguish a rebuilt server from an active MITM at this prompt, so offering
 * "devam et" would turn the check into a click-through.
 *
 * The dialog is raised here in main rather than round-tripping to a renderer —
 * the handshake is waiting on this answer, and a renderer-drawn prompt is
 * spoofable by page content.
 */
export async function verify(
  host: string,
  port: number,
  key: Buffer,
  label: string,
): Promise<VerifyOutcome> {
  const presented = fingerprint(key)
  const file = read()
  const slot = `${host}:${String(port)}`
  const pinned = file.pins[slot]

  if (pinned === presented) return { ok: true }

  if (pinned !== undefined) {
    await dialog.showMessageBox({
      type: 'error',
      title: 'GÜVENLİK UYARISI — Sunucu kimliği değişti',
      message: `${label} sunucusunun kimliği beklenenden farklı. Bağlantı reddedildi.`,
      detail:
        `Sunucu: ${slot}\n\n` +
        `Kayıtlı parmak izi:\n${pinned}\n\n` +
        `Şimdi sunulan:\n${presented}\n\n` +
        'Bu ya sunucunun yeniden kurulduğu ya da araya birinin girdiği (MITM) ' +
        'anlamına gelir. Sunucuyu siz yeniden kurduysanız Ayarlar’dan bu ' +
        'sunucunun kaydını silip yeniden onaylayın. Aksi halde ağınıza güvenmeyin.',
      buttons: ['Tamam'],
      defaultId: 0,
    })
    return { ok: false, reason: 'mismatch', pinned, presented }
  }

  const { response } = await dialog.showMessageBox({
    type: 'question',
    title: 'Yeni sunucu — kimliği doğrulayın',
    message: `${label} sunucusuna ilk kez bağlanıyorsunuz.`,
    detail:
      `Sunucu: ${slot}\n\nParmak izi:\n${presented}\n\n` +
      'Bu parmak izinin sunucudaki değerle aynı olduğunu doğrulayın. ' +
      'Sunucuda şu komutla görebilirsiniz:\n' +
      'ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub',
    buttons: ['Güven ve bağlan', 'İptal'],
    defaultId: 1,
    cancelId: 1,
  })

  if (response !== 0) return { ok: false, reason: 'rejected' }

  file.pins[slot] = presented
  write(file)
  return { ok: true }
}

export function unpin(host: string, port: number): void {
  const file = read()
  const slot = `${host}:${String(port)}`
  file.pins = Object.fromEntries(Object.entries(file.pins).filter(([key]) => key !== slot))
  write(file)
}
