import { Client } from 'pg'
import type { ClientChannel } from 'ssh2'
import type { PostgresConfig } from '../../../shared/types/postgres.js'
import { require_ as requireConnection } from '../../ssh/manager.js'
import { postgresPasswordFor } from '../../ssh/profiles.js'

/**
 * Connections are tunnelled, never bound.
 *
 * `pg` accepts a `stream` factory and speaks the wire protocol over whatever
 * Duplex it returns. Handing it an ssh2 direct-tcpip channel means no TCP
 * listener exists on this machine at all — there is no local port for another
 * process (or another user on the Mac) to connect to. That is strictly tighter
 * than the usual localhost:randomPort forward (ADR 0012).
 *
 * The factory `pg` calls is synchronous, so the channel is opened first and the
 * factory just hands back the already-open one.
 */

/** Three per database: a stuck query cannot be killed from its own connection. */
const MAX_PER_DATABASE = 3

interface Entry {
  client: Client
  channel: ClientChannel
  busy: boolean
}

const pools = new Map<string, Entry[]>()

function key(profileId: string, database: string): string {
  return `${profileId}::${database}`
}

function describe(error: unknown, config: PostgresConfig): Error {
  const message = error instanceof Error ? error.message : String(error)

  if (/password authentication failed/i.test(message)) {
    return new Error(`PostgreSQL kimlik doğrulaması başarısız (kullanıcı: ${config.user}).`)
  }
  if (/no pg_hba\.conf entry/i.test(message)) {
    return new Error(
      'PostgreSQL bu bağlantıyı reddetti (pg_hba.conf kuralı yok). ' +
        'Sunucuda bu kullanıcı için yerel bağlantıya izin verilmesi gerekiyor.',
    )
  }
  if (/database .* does not exist/i.test(message)) {
    return new Error(`Veritabanı bulunamadı: ${config.database}`)
  }
  if (/ECONNREFUSED/i.test(message)) {
    return new Error(
      `PostgreSQL ${config.host}:${String(config.port)} adresinde yanıt vermiyor. ` +
        'Servis çalışıyor mu?',
    )
  }
  return new Error(`PostgreSQL bağlantı hatası: ${message}`)
}

async function create(profileId: string, database: string, config: PostgresConfig): Promise<Entry> {
  const connection = requireConnection(profileId)
  const channel = await connection.forwardOut(config.host, config.port)

  const password = postgresPasswordFor(profileId)
  const client = new Client({
    user: config.user,
    database,
    // Present but unused for transport: pg validates these before consulting `stream`.
    host: config.host,
    port: config.port,
    ...(password !== undefined ? { password } : {}),
    stream: () => channel,
    // A runaway query must not pin a connection for the rest of the session.
    statement_timeout: config.statementTimeoutMs,
    query_timeout: config.statementTimeoutMs + 5_000,
  })

  try {
    await client.connect()
  } catch (error) {
    channel.close()
    throw describe(error, { ...config, database })
  }

  // A dead channel leaves a client that still looks alive; drop it either way.
  const drop = (): void => {
    const list = pools.get(key(profileId, database))
    if (!list) return
    pools.set(
      key(profileId, database),
      list.filter((candidate) => candidate.client !== client),
    )
  }
  client.on('error', drop)
  channel.on('close', drop)

  return { client, channel, busy: false }
}

/**
 * Runs `work` on a connection and releases it afterwards. Callers never hold a
 * client, so a thrown error cannot leak one out of the pool.
 */
export async function withClient<T>(
  profileId: string,
  database: string,
  config: PostgresConfig,
  work: (client: Client) => Promise<T>,
): Promise<T> {
  const id = key(profileId, database)
  const list = pools.get(id) ?? []
  pools.set(id, list)

  let entry = list.find((candidate) => !candidate.busy)

  if (!entry) {
    if (list.length >= MAX_PER_DATABASE) {
      throw new Error(
        'Tüm veritabanı bağlantıları meşgul. Çalışan bir sorgu varsa Sağlık ' +
          'sekmesinden durdurabilirsiniz.',
      )
    }
    entry = await create(profileId, database, config)
    list.push(entry)
  }

  entry.busy = true
  try {
    return await work(entry.client)
  } finally {
    entry.busy = false
  }
}

export async function closeFor(profileId: string): Promise<void> {
  for (const [id, list] of [...pools]) {
    if (!id.startsWith(`${profileId}::`)) continue
    for (const entry of list) {
      try {
        await entry.client.end()
      } catch {
        // Already gone with the SSH connection.
      }
      entry.channel.close()
    }
    pools.delete(id)
  }
}
