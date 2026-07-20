import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { Client } from 'ssh2'
import type { ClientChannel, ConnectConfig, SFTPWrapper } from 'ssh2'
import type { ConnectionSnapshot, ConnectionState } from '../../shared/types/connection.js'
import type { Profile } from '../../shared/types/profile.js'
import * as hostkeys from './hostkeys.js'
import { secretsFor } from './profiles.js'

const BASE_DELAY_MS = 1_000
const MAX_DELAY_MS = 30_000

/** Exponential backoff with jitter, so a fleet of windows doesn't retry in lockstep. */
function backoffDelay(attempt: number): number {
  const exponential = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS)
  return Math.round(exponential * (0.75 + Math.random() * 0.5))
}

export interface ConnectionEvents {
  state: [ConnectionSnapshot]
  /** Fires after every successful (re)connect, so channels can be re-established. */
  ready: []
  mismatch: [{ pinned: string; presented: string }]
}

/**
 * One ssh2.Client per profile. Terminal shells, SFTP and exec are all channels
 * on this single connection (ADR 0001).
 */
export class SshConnection extends EventEmitter {
  private client: Client | null = null
  private state: ConnectionState = 'disconnected'
  private attempt = 0
  private retryTimer: NodeJS.Timeout | null = null
  /** Set when the user asked to disconnect, so we don't fight them with a retry. */
  private intentionalClose = false
  private message: string | undefined

  constructor(private profile: Profile) {
    super()
  }

  get snapshot(): ConnectionSnapshot {
    const snap: ConnectionSnapshot = {
      profileId: this.profile.id,
      state: this.state,
      attempt: this.attempt,
    }
    if (this.message !== undefined) snap.message = this.message
    return snap
  }

  get isConnected(): boolean {
    return this.state === 'connected' && this.client !== null
  }

  updateProfile(profile: Profile): void {
    this.profile = profile
  }

  private setState(state: ConnectionState, message?: string): void {
    this.state = state
    this.message = message
    this.emit('state', this.snapshot)
  }

  async connect(): Promise<void> {
    if (this.state === 'connecting' || this.state === 'connected') return
    this.intentionalClose = false
    this.attempt = 0
    await this.open()
  }

  disconnect(): void {
    this.intentionalClose = true
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
    this.client?.end()
    this.client = null
    this.attempt = 0
    this.setState('disconnected')
  }

  private buildConfig(): ConnectConfig {
    const { host, port, username, authType, privateKeyPath } = this.profile
    const secrets = secretsFor(this.profile.id)

    const config: ConnectConfig = {
      host,
      port,
      username,
      // Without this the client sits on a dead socket after a Wi-Fi drop until
      // the OS TCP timeout fires — minutes, not seconds.
      keepaliveInterval: 15_000,
      keepaliveCountMax: 3,
      readyTimeout: 20_000,
      hostVerifier: (key: Buffer, callback: (valid: boolean) => void) => {
        void hostkeys
          .verify(host, port, key, this.profile.name)
          .then((outcome) => {
            if (!outcome.ok && outcome.reason === 'mismatch') {
              // Refused for good: a retry loop would re-prompt forever.
              this.intentionalClose = true
              this.emit('mismatch', { pinned: outcome.pinned, presented: outcome.presented })
            } else if (!outcome.ok) {
              this.intentionalClose = true
            }
            callback(outcome.ok)
          })
          .catch(() => {
            this.intentionalClose = true
            callback(false)
          })
      },
    }

    if (authType === 'agent') {
      const sock = process.env['SSH_AUTH_SOCK']
      if (!sock) {
        throw new Error(
          'ssh-agent bulunamadı (SSH_AUTH_SOCK tanımsız). ' +
            'Agent’ı başlatın veya anahtar dosyası ile bağlanın.',
        )
      }
      config.agent = sock
    } else if (authType === 'key') {
      if (!privateKeyPath) {
        throw new Error('Anahtar dosyası yolu tanımlı değil.')
      }
      try {
        config.privateKey = readFileSync(privateKeyPath)
      } catch {
        throw new Error(`Anahtar dosyası okunamadı: ${privateKeyPath}`)
      }
      if (secrets.passphrase) config.passphrase = secrets.passphrase
    } else {
      if (!secrets.password) {
        throw new Error('Bu profil için kayıtlı parola yok.')
      }
      config.password = secrets.password
    }

    return config
  }

  private async open(): Promise<void> {
    this.setState(this.attempt === 0 ? 'connecting' : 'reconnecting')

    let config: ConnectConfig
    try {
      config = this.buildConfig()
    } catch (error) {
      this.setState('error', error instanceof Error ? error.message : String(error))
      return
    }

    const client = new Client()
    this.client = client

    await new Promise<void>((resolve) => {
      let settled = false
      const settle = (): void => {
        if (!settled) {
          settled = true
          resolve()
        }
      }

      client.on('ready', () => {
        this.attempt = 0
        this.setState('connected')
        this.emit('ready')
        settle()
      })

      client.on('error', (error: Error) => {
        // ssh2 emits 'error' then 'close'; scheduling happens in 'close' so we
        // never queue two retries for one failure.
        this.setState(this.attempt === 0 ? 'error' : 'reconnecting', this.describe(error))
        settle()
      })

      client.on('close', () => {
        if (this.client === client) this.client = null
        settle()
        this.scheduleRetry()
      })

      client.connect(config)
    })
  }

  private describe(error: Error): string {
    const raw = error.message
    // Turkish, and deliberately not echoing the raw auth payload back.
    if (/All configured authentication methods failed/i.test(raw)) {
      return 'Kimlik doğrulama başarısız. Kullanıcı adı, anahtar veya parolayı kontrol edin.'
    }
    if (/ENOTFOUND|EAI_AGAIN/i.test(raw)) return 'Sunucu adresi çözümlenemedi.'
    if (/ECONNREFUSED/i.test(raw)) return 'Bağlantı reddedildi. SSH servisi çalışıyor mu?'
    if (/ETIMEDOUT|Timed out/i.test(raw)) return 'Bağlantı zaman aşımına uğradı.'
    if (/ECONNRESET|EPIPE/i.test(raw)) return 'Bağlantı koptu.'
    return `Bağlantı hatası: ${raw}`
  }

  private scheduleRetry(): void {
    if (this.intentionalClose) return
    if (this.retryTimer) return

    this.attempt += 1
    const delay = backoffDelay(this.attempt)
    const snap: ConnectionSnapshot = {
      profileId: this.profile.id,
      state: 'reconnecting',
      attempt: this.attempt,
      nextRetryInMs: delay,
      message: this.message ?? 'Bağlantı koptu, yeniden bağlanılıyor…',
    }
    this.state = 'reconnecting'
    this.emit('state', snap)

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      void this.open()
    }, delay)
  }

  // --- channel factory (ADR 0001) -----------------------------------------

  private requireClient(): Client {
    if (!this.client || this.state !== 'connected') {
      throw new Error('Sunucuya bağlı değilsiniz.')
    }
    return this.client
  }

  shell(options: { cols: number; rows: number; cwd?: string }): Promise<ClientChannel> {
    const client = this.requireClient()
    return new Promise((resolve, reject) => {
      client.shell(
        { term: 'xterm-256color', cols: options.cols, rows: options.rows },
        (err, channel) => {
          if (err) {
            reject(new Error(`Terminal oturumu açılamadı: ${err.message}`))
            return
          }
          if (options.cwd) {
            // Quoted so paths with spaces survive; the cd is echoed, which is fine
            // and actually tells the user where they landed.
            channel.write(`cd '${options.cwd.replace(/'/g, `'\\''`)}'\n`)
          }
          resolve(channel)
        },
      )
    })
  }

  exec(command: string): Promise<ClientChannel> {
    const client = this.requireClient()
    return new Promise((resolve, reject) => {
      client.exec(command, (err, channel) => {
        if (err) reject(new Error(`Komut çalıştırılamadı: ${err.message}`))
        else resolve(channel)
      })
    })
  }

  /**
   * A direct-tcpip channel to a port on the server's own network namespace.
   *
   * This is the PostgreSQL tunnel: the channel is handed straight to the pg
   * client as its transport, so nothing is ever bound on the Mac. There is no
   * local port to scan, and no other process on this machine can reach the
   * database (ADR 0012).
   */
  forwardOut(destHost: string, destPort: number): Promise<ClientChannel> {
    const client = this.requireClient()
    return new Promise((resolve, reject) => {
      // Source address is informational; servers log it but do not route on it.
      client.forwardOut('127.0.0.1', 0, destHost, destPort, (err, channel) => {
        if (err) {
          reject(
            new Error(
              `Tünel açılamadı (${destHost}:${String(destPort)}): ${err.message}. ` +
                'Sunucuda bu porta erişim var mı ve SSH yapılandırmasında AllowTcpForwarding açık mı?',
            ),
          )
        } else {
          resolve(channel)
        }
      })
    })
  }

  sftp(): Promise<SFTPWrapper> {
    const client = this.requireClient()
    return new Promise((resolve, reject) => {
      client.sftp((err, sftp) => {
        if (err) reject(new Error(`Dosya kanalı açılamadı: ${err.message}`))
        else resolve(sftp)
      })
    })
  }
}
