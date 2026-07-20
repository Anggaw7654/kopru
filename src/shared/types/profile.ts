/** How we authenticate to a server. */
import type { MonitorConfig } from './metrics.js'
import type { PostgresConfig } from './postgres.js'
import type { Shortcut } from './files.js'

export type AuthType = 'key' | 'password' | 'agent'

/**
 * A saved server, as the renderer sees it.
 *
 * Deliberately contains no secret material: the password and the key passphrase
 * live encrypted in the main process (safeStorage) and never cross the IPC
 * boundary. `hasPassword` / `hasPassphrase` only tell the UI whether a secret is
 * on file, so it can render "kayıtlı" instead of an empty field.
 */
export interface Profile {
  id: string
  name: string
  host: string
  port: number
  username: string
  authType: AuthType
  /** Absolute path to the private key file. Only meaningful when authType === 'key'. */
  privateKeyPath?: string
  autoConnect: boolean
  hasPassword: boolean
  hasPassphrase: boolean
  monitor: MonitorConfig
  postgres: PostgresConfig
  /** Named folder jump targets, per server. */
  shortcuts: Shortcut[]
}

/** What the renderer sends when creating or updating a profile. */
export interface ProfileInput {
  /** Absent when creating. */
  id?: string
  name: string
  host: string
  port: number
  username: string
  authType: AuthType
  privateKeyPath?: string
  autoConnect: boolean
  /** Absent on save means "leave the stored monitor settings alone". */
  monitor?: MonitorConfig
  /** Same rule as monitor: absent means "do not touch". */
  postgres?: PostgresConfig
  /** Database password: undefined keeps, null clears, string replaces. */
  postgresPassword?: string | null
  /** Absent means "do not touch"; an empty array clears them. */
  shortcuts?: Shortcut[]
  /**
   * Plaintext secrets, present only in this one direction and only when the user
   * just typed them. `undefined` means "leave whatever is stored alone";
   * `null` means "clear the stored secret".
   */
  password?: string | null
  passphrase?: string | null
}
