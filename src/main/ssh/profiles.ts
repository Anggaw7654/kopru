import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { app, safeStorage } from 'electron'
import type { Profile, ProfileInput } from '../../shared/types/profile.js'
import type { MonitorConfig } from '../../shared/types/metrics.js'
import { DEFAULT_MONITOR } from '../../shared/types/metrics.js'
import type { PostgresConfig } from '../../shared/types/postgres.js'
import { DEFAULT_POSTGRES } from '../../shared/types/postgres.js'

/**
 * On-disk shape. Secrets are stored as base64 of safeStorage ciphertext, which
 * on macOS is Keychain-backed. They are decrypted only at connect time and
 * never leave this process.
 */
interface StoredProfile {
  id: string
  name: string
  host: string
  port: number
  username: string
  authType: Profile['authType']
  privateKeyPath?: string
  autoConnect: boolean
  encryptedPassword?: string
  encryptedPassphrase?: string
  /** Absent on profiles written before the monitor module existed. */
  monitor?: MonitorConfig
  postgres?: PostgresConfig
  /** safeStorage ciphertext, base64. Never leaves this process in the clear. */
  encryptedPostgresPassword?: string
}

interface ProfileFile {
  version: 1
  profiles: StoredProfile[]
}

const EMPTY: ProfileFile = { version: 1, profiles: [] }

function filePath(): string {
  return join(app.getPath('userData'), 'profiles.json')
}

function read(): ProfileFile {
  const path = filePath()
  if (!existsSync(path)) return { ...EMPTY, profiles: [] }
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'profiles' in parsed &&
      Array.isArray((parsed as ProfileFile).profiles)
    ) {
      return parsed as ProfileFile
    }
    throw new Error('beklenmeyen dosya yapısı')
  } catch (error) {
    // Refuse to silently start with an empty profile list: that looks to the
    // user like their servers vanished, and the next save would overwrite the
    // file they could otherwise have recovered by hand.
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`Profil dosyası okunamadı (${path}): ${detail}`, { cause: error })
  }
}

function write(data: ProfileFile): void {
  const path = filePath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(data, null, 2), { mode: 0o600 })
}

function encrypt(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'Sistem anahtar zinciri kullanılamıyor; parola güvenli biçimde saklanamaz. ' +
        'Anahtar dosyası (private key) ile bağlanmayı deneyin.',
    )
  }
  return safeStorage.encryptString(value).toString('base64')
}

function decrypt(value: string): string {
  return safeStorage.decryptString(Buffer.from(value, 'base64'))
}

/**
 * Profiles saved before phase 3 have no `monitor` block. Fill it in on read
 * rather than migrating the file: an unwritten profile keeps working if the
 * user rolls back, and nothing is rewritten until they save.
 */
function withMonitorDefaults(monitor: MonitorConfig | undefined): MonitorConfig {
  if (!monitor) return { ...DEFAULT_MONITOR }
  return {
    ...DEFAULT_MONITOR,
    ...monitor,
    thresholds: { ...DEFAULT_MONITOR.thresholds, ...monitor.thresholds },
  }
}

function withPostgresDefaults(
  postgres: PostgresConfig | undefined,
  hasPassword: boolean,
): PostgresConfig {
  return { ...DEFAULT_POSTGRES, ...postgres, hasPassword }
}

function toPublic(stored: StoredProfile): Profile {
  const profile: Profile = {
    id: stored.id,
    name: stored.name,
    host: stored.host,
    port: stored.port,
    username: stored.username,
    authType: stored.authType,
    autoConnect: stored.autoConnect,
    hasPassword: stored.encryptedPassword !== undefined,
    hasPassphrase: stored.encryptedPassphrase !== undefined,
    monitor: withMonitorDefaults(stored.monitor),
    postgres: withPostgresDefaults(
      stored.postgres,
      stored.encryptedPostgresPassword !== undefined,
    ),
  }
  if (stored.privateKeyPath !== undefined) profile.privateKeyPath = stored.privateKeyPath
  return profile
}

export function list(): Profile[] {
  return read().profiles.map(toPublic)
}

export function save(input: ProfileInput): Profile {
  const file = read()
  const index = input.id ? file.profiles.findIndex((p) => p.id === input.id) : -1
  const previous = index >= 0 ? file.profiles[index] : undefined

  const next: StoredProfile = {
    id: previous?.id ?? randomUUID(),
    name: input.name,
    host: input.host,
    port: input.port,
    username: input.username,
    authType: input.authType,
    autoConnect: input.autoConnect,
    monitor: withMonitorDefaults(input.monitor ?? previous?.monitor),
    postgres: withPostgresDefaults(input.postgres ?? previous?.postgres, false),
  }
  if (input.privateKeyPath !== undefined) next.privateKeyPath = input.privateKeyPath

  // undefined = keep what is stored, null = clear it, string = replace it.
  const carry = (
    fresh: string | null | undefined,
    existing: string | undefined,
  ): string | undefined => {
    if (fresh === undefined) return existing
    if (fresh === null || fresh === '') return undefined
    return encrypt(fresh)
  }

  const password = carry(input.password, previous?.encryptedPassword)
  const passphrase = carry(input.passphrase, previous?.encryptedPassphrase)
  const pgPassword = carry(input.postgresPassword, previous?.encryptedPostgresPassword)
  if (password !== undefined) next.encryptedPassword = password
  if (passphrase !== undefined) next.encryptedPassphrase = passphrase
  if (pgPassword !== undefined) next.encryptedPostgresPassword = pgPassword

  if (index >= 0) file.profiles[index] = next
  else file.profiles.push(next)

  write(file)
  return toPublic(next)
}

export function remove(id: string): void {
  const file = read()
  file.profiles = file.profiles.filter((p) => p.id !== id)
  write(file)
}

export function findStored(id: string): StoredProfile | undefined {
  return read().profiles.find((p) => p.id === id)
}

/**
 * The database password, decrypted. Called only by the pg pool, and — per the
 * security requirements — this value must never enter Claude context.
 */
export function postgresPasswordFor(id: string): string | undefined {
  const stored = findStored(id)
  if (!stored?.encryptedPostgresPassword) return undefined
  return decrypt(stored.encryptedPostgresPassword)
}

/** Decrypted secrets, for the connect path only. Never returned over IPC. */
export function secretsFor(id: string): { password?: string; passphrase?: string } {
  const stored = findStored(id)
  if (!stored) return {}
  const out: { password?: string; passphrase?: string } = {}
  if (stored.encryptedPassword) out.password = decrypt(stored.encryptedPassword)
  if (stored.encryptedPassphrase) out.passphrase = decrypt(stored.encryptedPassphrase)
  return out
}
