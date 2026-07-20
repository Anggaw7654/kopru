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
import * as files from './modules/files/operations.js'
import * as shellOps from './modules/files/shell-ops.js'
import * as previews from './modules/files/preview.js'
import * as editor from './modules/files/editor.js'
import * as transfers from './modules/files/transfers.js'
import { dialog, BrowserWindow } from 'electron'

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

  handle('fs:list', (request) => files.list(request))
  handle('fs:home', async ({ profileId }) => ({ path: await files.home(profileId) }))
  handle('fs:mkdir', (request) => files.mkdir(request))
  handle('fs:rename', (request) => files.rename(request))
  handle('fs:copy', (request) => shellOps.copy(request))
  handle('fs:delete', (request) => shellOps.remove(request))
  handle('fs:chmod', (request) =>
    request.recursive ? shellOps.chmodRecursive(request) : files.chmod(request),
  )
  handle('fs:compress', (request) => shellOps.compress(request))
  handle('fs:extract', (request) => shellOps.extract(request))
  handle('fs:preview', (request) => previews.preview(request))
  handle('fs:open', (request) => editor.open(request))
  handle('fs:save', (request) => editor.save(request))

  handle('transfer:upload', ({ profileId, localPaths, destinationDir }) => {
    transfers.upload(profileId, localPaths, destinationDir)
  })
  handle('transfer:download', async ({ profileId, remotePaths }) => {
    // The folder picker lives in main: the renderer must never learn a local
    // path the user did not choose.
    const window = BrowserWindow.getFocusedWindow()
    const result = await (window
      ? dialog.showOpenDialog(window, {
          title: 'İndirme klasörünü seçin',
          properties: ['openDirectory', 'createDirectory'],
          buttonLabel: 'Buraya indir',
        })
      : dialog.showOpenDialog({
          title: 'İndirme klasörünü seçin',
          properties: ['openDirectory', 'createDirectory'],
          buttonLabel: 'Buraya indir',
        }))
    const target = result.filePaths[0]
    if (result.canceled || target === undefined) return
    await transfers.download(profileId, remotePaths, target)
  })
  handle('transfer:cancel', ({ id }) => {
    transfers.cancel(id)
  })
  handle('transfer:list', () => transfers.list())
  handle('transfer:clear-finished', () => {
    transfers.clearFinished()
  })

  receive('terminal:write', ({ sessionId, data }) => {
    terminals.write(sessionId, data)
  })
  receive('terminal:resize', ({ sessionId, cols, rows }) => {
    terminals.resize(sessionId, cols, rows)
  })
}
