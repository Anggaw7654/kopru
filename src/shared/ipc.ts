import type { Profile, ProfileInput } from './types/profile.js'
import type { ConnectionSnapshot, HostKeyMismatch } from './types/connection.js'
import type {
  ArchiveRequest,
  ChmodRequest,
  CopyRequest,
  DeleteRequest,
  DownloadRequest,
  ExtractRequest,
  ListRequest,
  ListResult,
  OpenFileResult,
  PathRequest,
  PreviewResult,
  RenameRequest,
  SaveFileRequest,
  SaveFileResult,
  Transfer,
  UploadRequest,
} from './types/files.js'
import type {
  TerminalCreateRequest,
  TerminalData,
  TerminalExit,
  TerminalResize,
  TerminalSession,
  TerminalWrite,
} from './types/terminal.js'

/* eslint-disable @typescript-eslint/no-invalid-void-type --
 * `void` marks "this channel carries no payload". The rule assumes void only
 * appears in return position, but this file is a signature table: void here is
 * exactly as meaningful as it is in a function type. */

/**
 * The single source of truth for every process boundary crossing.
 *
 * Three maps, because the three directions have genuinely different cost
 * profiles (ADR 0002):
 *   invoke — request/response, awaits a reply
 *   send   — renderer to main, fire-and-forget, no reply allocated
 *   event  — main to renderer, pushed
 */

export interface IpcInvokeMap {
  'profiles:list': { req: void; res: Profile[] }
  'profiles:save': { req: ProfileInput; res: Profile }
  'profiles:delete': { req: { id: string }; res: void }

  'connection:connect': { req: { profileId: string }; res: void }
  'connection:disconnect': { req: { profileId: string }; res: void }
  'connection:status': { req: void; res: ConnectionSnapshot[] }

  'terminal:create': { req: TerminalCreateRequest; res: TerminalSession }
  'terminal:close': { req: { sessionId: string }; res: void }

  'fs:list': { req: ListRequest; res: ListResult }
  'fs:home': { req: { profileId: string }; res: { path: string } }
  'fs:mkdir': { req: PathRequest; res: void }
  'fs:rename': { req: RenameRequest; res: void }
  'fs:copy': { req: CopyRequest; res: void }
  'fs:delete': { req: DeleteRequest; res: void }
  'fs:chmod': { req: ChmodRequest; res: void }
  'fs:compress': { req: ArchiveRequest; res: void }
  'fs:extract': { req: ExtractRequest; res: void }
  'fs:preview': { req: PathRequest; res: PreviewResult }
  'fs:open': { req: PathRequest; res: OpenFileResult }
  'fs:save': { req: SaveFileRequest; res: SaveFileResult }

  'transfer:upload': { req: UploadRequest; res: void }
  /** Opens a native folder picker, then queues the downloads. */
  'transfer:download': { req: DownloadRequest; res: void }
  'transfer:cancel': { req: { id: string }; res: void }
  'transfer:list': { req: void; res: Transfer[] }
  'transfer:clear-finished': { req: void; res: void }
}

/**
 * Renderer to main, no response. Terminal keystrokes and resizes go here rather
 * than through invoke: at 60fps a promise round-trip per chunk stalls the
 * renderer for no benefit, since neither call has a meaningful reply.
 */
export interface IpcSendMap {
  'terminal:write': TerminalWrite
  'terminal:resize': TerminalResize
}

/** Main to renderer, pushed to every window. */
export interface IpcEventMap {
  'connection:state': ConnectionSnapshot
  'connection:hostkey-mismatch': HostKeyMismatch
  'terminal:data': TerminalData
  'terminal:exit': TerminalExit
  /** A dropped session was replaced with a fresh pty; UI marks the tab. */
  'terminal:restored': { sessionId: string }
  /** Progress ticks and terminal states for one transfer. */
  'transfer:update': Transfer
  /** Something changed this directory behind the UI's back (e.g. an upload finished). */
  'fs:invalidate': { profileId: string; path: string }
}

export type IpcInvokeChannel = keyof IpcInvokeMap
export type IpcSendChannel = keyof IpcSendMap
export type IpcEventChannel = keyof IpcEventMap

export type IpcRequest<C extends IpcInvokeChannel> = IpcInvokeMap[C]['req']
export type IpcResponse<C extends IpcInvokeChannel> = IpcInvokeMap[C]['res']

/** The exact surface preload exposes on `window.kopru`. Nothing else is reachable. */
export interface KopruApi {
  invoke<C extends IpcInvokeChannel>(
    channel: C,
    ...args: IpcRequest<C> extends void ? [] : [IpcRequest<C>]
  ): Promise<IpcResponse<C>>

  send<C extends IpcSendChannel>(channel: C, payload: IpcSendMap[C]): void

  /** Returns an unsubscribe function; callers must call it on unmount. */
  on<C extends IpcEventChannel>(channel: C, listener: (payload: IpcEventMap[C]) => void): () => void

  /**
   * Local filesystem path of a dropped File. Electron 32 removed `File.path`;
   * this is the supported replacement and the only way drag-and-drop upload can
   * learn what the user dropped.
   */
  pathForFile(file: File): string | null
}
