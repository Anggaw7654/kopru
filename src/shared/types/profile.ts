/** How we authenticate to a server. */
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
  /**
   * Plaintext secrets, present only in this one direction and only when the user
   * just typed them. `undefined` means "leave whatever is stored alone";
   * `null` means "clear the stored secret".
   */
  password?: string | null
  passphrase?: string | null
}
