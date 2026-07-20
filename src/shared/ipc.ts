import type { Profile, ProfileInput } from './types/profile.js'
import type { ConnectionSnapshot, HostKeyMismatch } from './types/connection.js'
import type {
  ArchiveRequest,
  Shortcut,
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
  ComposeActionRequest,
  ComposeProject,
  Container,
  ContainerActionRequest,
  ContainerStats,
  DiskUsageEntry,
  DockerAvailability,
  LogChunk,
  LogRequest,
  PrunePreview,
  PruneResult,
  PruneTarget,
} from './types/docker.js'
import type {
  BackupRequest,
  DangerAssessment,
  DatabaseInfo,
  HealthReport,
  QueryRequest,
  QueryResult,
  SchemaInfo,
  TableDetail,
  TableRef,
} from './types/postgres.js'
import type { SystemSummary } from './types/context.js'
import type {
  MetricSnapshot,
  MonitorHistory,
  RestartServiceRequest,
} from './types/metrics.js'
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
  'fs:set-shortcuts': { req: { profileId: string; shortcuts: Shortcut[] }; res: Profile }

  'transfer:upload': { req: UploadRequest; res: void }
  /** Opens a native folder picker, then queues the downloads. */
  'transfer:download': { req: DownloadRequest; res: void }
  'transfer:cancel': { req: { id: string }; res: void }
  'transfer:list': { req: void; res: Transfer[] }
  'transfer:clear-finished': { req: void; res: void }

  /** Buffered history so a newly opened window draws a full chart immediately. */
  'monitor:history': { req: { profileId: string }; res: MonitorHistory }
  'monitor:restart-service': { req: RestartServiceRequest; res: void }
  /** Lists systemd units so the settings screen can offer real choices. */
  'monitor:list-units': { req: { profileId: string }; res: { units: string[] } }

  'docker:availability': { req: { profileId: string }; res: DockerAvailability }
  'docker:containers': { req: { profileId: string }; res: Container[] }
  /** Expensive (1-2 s); only called while the panel is open. */
  'docker:stats': { req: { profileId: string }; res: ContainerStats[] }
  'docker:disk-usage': { req: { profileId: string }; res: DiskUsageEntry[] }
  'docker:container-action': { req: ContainerActionRequest; res: void }
  'docker:logs': { req: LogRequest; res: { content: string } }
  'docker:follow-start': { req: { profileId: string; containerId: string }; res: void }
  'docker:follow-stop': { req: { profileId: string; containerId: string }; res: void }
  /** Returns the command to type into a terminal tab; the tab is created separately. */
  'docker:shell-command': { req: { containerId: string }; res: { command: string } }
  'docker:compose-list': { req: { profileId: string }; res: ComposeProject[] }
  'docker:compose-action': { req: ComposeActionRequest; res: void }
  'docker:compose-apply': { req: { profileId: string; project: string }; res: void }
  'docker:prune-preview': { req: { profileId: string; target: PruneTarget }; res: PrunePreview }
  'docker:prune': { req: { profileId: string; target: PruneTarget }; res: PruneResult }

  'pg:databases': { req: { profileId: string }; res: DatabaseInfo[] }
  'pg:schemas': { req: { profileId: string; database: string }; res: SchemaInfo[] }
  'pg:table-detail': {
    req: { profileId: string; database: string; table: TableRef }
    res: TableDetail
  }
  'pg:browse': {
    req: {
      profileId: string; database: string; table: TableRef
      orderBy: string | null; descending: boolean; limit: number; offset: number
    }
    res: QueryResult
  }
  'pg:query': { req: QueryRequest; res: QueryResult }
  'pg:explain': { req: QueryRequest; res: { plan: string } }
  /** Asked before running anything in write mode; drives the red dialog. */
  'pg:assess': { req: QueryRequest; res: DangerAssessment }
  'pg:health': { req: { profileId: string; database: string }; res: HealthReport }
  'pg:cancel-query': {
    req: { profileId: string; database: string; pid: number; terminate: boolean }
    res: { ok: boolean }
  }
  /** Runs pg_dump on the server, then queues the download. */
  'pg:backup': { req: BackupRequest; res: { remotePath: string } | null }

  /** Fresh, credential-free picture of the server for a pasted context block. */
  'context:system-summary': { req: { profileId: string }; res: SystemSummary }

  /** Opens another view of the same session set; does not fork state in main. */
  'window:new': { req: void; res: void }
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
  'monitor:sample': MetricSnapshot
  'docker:log-chunk': LogChunk
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
