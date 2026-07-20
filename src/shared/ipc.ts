import type { Profile, ProfileInput } from './types/profile.js'
import type { ConnectionSnapshot, HostKeyMismatch } from './types/connection.js'
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
}
