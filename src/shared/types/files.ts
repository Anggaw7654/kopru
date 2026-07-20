export type EntryKind = 'file' | 'directory' | 'symlink' | 'other'

export interface DirEntry {
  name: string
  /** Absolute POSIX path on the server. */
  path: string
  kind: EntryKind
  size: number
  /** Unix epoch milliseconds. */
  modified: number
  /** Permission bits only, e.g. 0o644. */
  mode: number
  owner: number
  group: number
  /** Where a symlink points, when we could resolve it. */
  linkTarget?: string
}

export interface ListRequest {
  profileId: string
  path: string
  showHidden: boolean
}

export interface ListResult {
  path: string
  entries: DirEntry[]
}

export interface PathRequest {
  profileId: string
  path: string
}

export interface RenameRequest {
  profileId: string
  from: string
  to: string
}

export interface CopyRequest {
  profileId: string
  sources: string[]
  destinationDir: string
}

export interface DeleteRequest {
  profileId: string
  paths: string[]
}

export interface ChmodRequest {
  profileId: string
  path: string
  /** Permission bits only, e.g. 0o755. */
  mode: number
  recursive: boolean
}

export interface ArchiveRequest {
  profileId: string
  sources: string[]
  /** Absolute path of the archive to create. */
  archivePath: string
}

export interface ExtractRequest {
  profileId: string
  archivePath: string
  destinationDir: string
}

// --- preview ---------------------------------------------------------------

export type PreviewResult =
  | { kind: 'text'; content: string; language: string; truncated: boolean }
  | { kind: 'log'; content: string; lineCount: number; fromEnd: true; truncatedBytes: boolean }
  | { kind: 'image'; dataUrl: string; size: number }
  | { kind: 'binary'; size: number }
  | { kind: 'directory'; entryCount: number }
  | { kind: 'too-large'; size: number }

// --- editing ---------------------------------------------------------------

export interface OpenFileResult {
  path: string
  content: string
  language: string
  /** mtime at open; compared on save to detect a concurrent change. */
  modified: number
  /** True when the connected user cannot write the file (sudo path needed). */
  readOnlyForUser: boolean
}

export interface SaveFileRequest {
  profileId: string
  path: string
  content: string
  /** mtime observed when the file was opened. */
  expectedModified: number
  /** Set after the user accepts overwriting a changed file. */
  force: boolean
  /** Route the write through `sudo mv`; prompts for a password each time. */
  useSudo: boolean
}

export type SaveFileResult =
  | { ok: true; modified: number }
  | { ok: false; reason: 'conflict'; serverModified: number }
  | { ok: false; reason: 'permission' }
  | { ok: false; reason: 'sudo-cancelled' }
  | { ok: false; reason: 'sudo-failed'; message: string }

// --- transfers -------------------------------------------------------------

export type TransferDirection = 'upload' | 'download'
export type TransferState = 'queued' | 'running' | 'done' | 'error' | 'cancelled'

export interface Transfer {
  id: string
  profileId: string
  direction: TransferDirection
  /** Display name only. */
  name: string
  localPath: string
  remotePath: string
  bytesTotal: number
  bytesDone: number
  state: TransferState
  /** Turkish, user-facing. */
  error?: string
}

export interface UploadRequest {
  profileId: string
  localPaths: string[]
  destinationDir: string
}

export interface DownloadRequest {
  profileId: string
  remotePaths: string[]
}
