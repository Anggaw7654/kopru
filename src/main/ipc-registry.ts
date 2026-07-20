import { ipcMain } from 'electron'
import type {
  IpcInvokeChannel,
  IpcRequest,
  IpcResponse,
  IpcSendChannel,
  IpcSendMap,
} from '../shared/ipc.js'
import * as profiles from './ssh/profiles.js'
import * as manager from './ssh/manager.js'
import * as terminals from './modules/terminal/registry.js'

/**
 * Typed wrappers. Every handler's argument and return type is checked against
 * the contract, so a channel can't drift from its declared shape (ADR 0002).
 */
function handle<C extends IpcInvokeChannel>(
  channel: C,
  handler: (payload: IpcRequest<C>) => IpcResponse<C> | Promise<IpcResponse<C>>,
): void {
  ipcMain.handle(channel, async (_event, payload: IpcRequest<C>) => {
    try {
      return await handler(payload)
    } catch (error) {
      // Surface a Turkish message; never let a stack trace or credential-bearing
      // raw error cross the boundary.
      throw new Error(error instanceof Error ? error.message : String(error), { cause: error })
    }
  })
}

function receive<C extends IpcSendChannel>(
  channel: C,
  handler: (payload: IpcSendMap[C]) => void,
): void {
  ipcMain.on(channel, (_event, payload: IpcSendMap[C]) => {
    try {
      handler(payload)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.error(`[kopru] ${channel} işlenemedi: ${detail}`)
    }
  })
}

export function registerIpcHandlers(): void {
  handle('profiles:list', () => profiles.list())
  handle('profiles:save', (input) => profiles.save(input))
  handle('profiles:delete', ({ id }) => {
    manager.disconnect(id)
    terminals.closeAllFor(id)
    profiles.remove(id)
  })

  handle('connection:connect', async ({ profileId }) => {
    await manager.connect(profileId)
  })
  handle('connection:disconnect', ({ profileId }) => {
    terminals.closeAllFor(profileId)
    manager.disconnect(profileId)
  })
  handle('connection:status', () => manager.status())

  handle('terminal:create', (request) => terminals.create(request))
  handle('terminal:close', ({ sessionId }) => {
    terminals.close(sessionId)
  })

  receive('terminal:write', ({ sessionId, data }) => {
    terminals.write(sessionId, data)
  })
  receive('terminal:resize', ({ sessionId, cols, rows }) => {
    terminals.resize(sessionId, cols, rows)
  })
}
