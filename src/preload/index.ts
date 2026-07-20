/* eslint-disable @typescript-eslint/no-invalid-void-type -- mirrors the void
 * payload markers in the IPC contract; see src/shared/ipc.ts. */
import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  IpcEventChannel,
  IpcEventMap,
  IpcInvokeChannel,
  IpcRequest,
  IpcResponse,
  IpcSendChannel,
  IpcSendMap,
  KopruApi,
} from '../shared/ipc.js'

/**
 * Channel allow-lists. Without these, `invoke` here is a generic bridge that
 * lets renderer code reach *any* main-process handler, including ones added
 * later for privileged work. Enumerating them keeps the surface exactly as wide
 * as the contract says it is.
 */
const INVOKE_CHANNELS: readonly IpcInvokeChannel[] = [
  'profiles:list',
  'profiles:save',
  'profiles:delete',
  'connection:connect',
  'connection:disconnect',
  'connection:status',
  'terminal:create',
  'terminal:close',
  'fs:list',
  'fs:home',
  'fs:mkdir',
  'fs:rename',
  'fs:copy',
  'fs:delete',
  'fs:chmod',
  'fs:compress',
  'fs:extract',
  'fs:preview',
  'fs:open',
  'fs:save',
  'fs:set-shortcuts',
  'transfer:upload',
  'transfer:download',
  'transfer:cancel',
  'transfer:list',
  'transfer:clear-finished',
  'monitor:history',
  'monitor:restart-service',
  'monitor:list-units',
  'docker:availability',
  'docker:containers',
  'docker:stats',
  'docker:disk-usage',
  'docker:container-action',
  'docker:logs',
  'docker:follow-start',
  'docker:follow-stop',
  'docker:shell-command',
  'docker:compose-list',
  'docker:compose-action',
  'docker:compose-apply',
  'docker:prune-preview',
  'docker:prune',
  'pg:databases',
  'pg:schemas',
  'pg:table-detail',
  'pg:browse',
  'pg:query',
  'pg:explain',
  'pg:assess',
  'pg:health',
  'pg:cancel-query',
  'pg:backup',
  'context:system-summary',
]

const SEND_CHANNELS: readonly IpcSendChannel[] = ['terminal:write', 'terminal:resize']

const EVENT_CHANNELS: readonly IpcEventChannel[] = [
  'connection:state',
  'connection:hostkey-mismatch',
  'terminal:data',
  'terminal:exit',
  'terminal:restored',
  'transfer:update',
  'fs:invalidate',
  'monitor:sample',
  'docker:log-chunk',
]

const api: KopruApi = {
  invoke<C extends IpcInvokeChannel>(
    channel: C,
    ...args: IpcRequest<C> extends void ? [] : [IpcRequest<C>]
  ): Promise<IpcResponse<C>> {
    if (!INVOKE_CHANNELS.includes(channel)) {
      return Promise.reject(new Error(`İzin verilmeyen IPC kanalı: ${channel}`))
    }
    return ipcRenderer.invoke(channel, ...args) as Promise<IpcResponse<C>>
  },

  send<C extends IpcSendChannel>(channel: C, payload: IpcSendMap[C]): void {
    if (!SEND_CHANNELS.includes(channel)) {
      throw new Error(`İzin verilmeyen IPC kanalı: ${channel}`)
    }
    ipcRenderer.send(channel, payload)
  },

  on<C extends IpcEventChannel>(
    channel: C,
    listener: (payload: IpcEventMap[C]) => void,
  ): () => void {
    if (!EVENT_CHANNELS.includes(channel)) {
      throw new Error(`İzin verilmeyen IPC kanalı: ${channel}`)
    }
    // The IpcRendererEvent is dropped on purpose: it carries a `sender` handle
    // that must never reach renderer code.
    const wrapped = (_event: unknown, payload: IpcEventMap[C]): void => {
      listener(payload)
    }
    ipcRenderer.on(channel, wrapped)
    return () => {
      ipcRenderer.removeListener(channel, wrapped)
    }
  },

  pathForFile(file: File): string | null {
    const path = webUtils.getPathForFile(file)
    return path === '' ? null : path
  },
}

contextBridge.exposeInMainWorld('kopru', api)
