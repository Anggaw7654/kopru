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
import * as monitor from './modules/monitor/collector.js'
import * as dockerDetect from './modules/docker/detect.js'
import * as dockerInspect from './modules/docker/inspect.js'
import * as dockerControl from './modules/docker/control.js'
import * as dockerLogs from './modules/docker/logs.js'
import * as dockerCompose from './modules/docker/compose.js'
import * as pgPool from './modules/postgres/pool.js'
import * as pgSchema from './modules/postgres/schema.js'
import * as pgQuery from './modules/postgres/query.js'
import * as pgHealth from './modules/postgres/health.js'
import * as pgBackup from './modules/postgres/backup.js'
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
    monitor.forget(id)
    manager.disconnect(id)
    terminals.closeAllFor(id)
    profiles.remove(id)
  })

  handle('connection:connect', async ({ profileId }) => {
    await manager.connect(profileId)
  })
  handle('connection:disconnect', async ({ profileId }) => {
    monitor.stop(profileId)
    await pgPool.closeFor(profileId)
    dockerLogs.stopAllFor(profileId)
    dockerDetect.forget(profileId)
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

  handle('monitor:history', ({ profileId }) => ({
    profileId,
    snapshots: monitor.history(profileId),
  }))
  handle('monitor:restart-service', ({ profileId, unit }) => monitor.restartService(profileId, unit))
  handle('monitor:list-units', async ({ profileId }) => ({
    units: await monitor.listUnits(profileId),
  }))

  handle('docker:availability', ({ profileId }) => dockerDetect.detect(profileId))
  handle('docker:containers', ({ profileId }) => dockerInspect.containers(profileId))
  handle('docker:stats', ({ profileId }) => dockerInspect.stats(profileId))
  handle('docker:disk-usage', ({ profileId }) => dockerInspect.diskUsage(profileId))
  handle('docker:container-action', (request) => dockerControl.containerAction(request))
  handle('docker:logs', async (request) => ({ content: await dockerLogs.tail(request) }))
  handle('docker:follow-start', ({ profileId, containerId }) =>
    dockerLogs.startFollow(profileId, containerId),
  )
  handle('docker:follow-stop', ({ profileId, containerId }) => {
    dockerLogs.stopFollow(profileId, containerId)
  })
  handle('docker:shell-command', ({ containerId }) => ({
    command: dockerLogs.shellCommand(containerId),
  }))
  handle('docker:compose-list', ({ profileId }) => dockerCompose.projects(profileId))
  handle('docker:compose-action', (request) => dockerCompose.action(request))
  handle('docker:compose-apply', ({ profileId, project }) => dockerCompose.apply(profileId, project))
  handle('docker:prune-preview', ({ profileId, target }) =>
    dockerControl.prunePreview(profileId, target),
  )
  handle('docker:prune', ({ profileId, target }) => dockerControl.prune(profileId, target))

  const pgConfig = (profileId: string) => {
    const profile = profiles.list().find((p) => p.id === profileId)
    if (!profile) throw new Error('Profil bulunamadı.')
    if (!profile.postgres.enabled) {
      throw new Error('Bu profilde PostgreSQL kapalı. Ayarlar’dan açın.')
    }
    return profile.postgres
  }

  handle('pg:databases', ({ profileId }) => pgSchema.databases(profileId, pgConfig(profileId)))
  handle('pg:schemas', ({ profileId, database }) =>
    pgSchema.schemas(profileId, database, pgConfig(profileId)),
  )
  handle('pg:table-detail', ({ profileId, database, table }) =>
    pgSchema.tableDetail(profileId, database, pgConfig(profileId), table),
  )
  handle('pg:browse', ({ profileId, database, table, orderBy, descending, limit, offset }) => {
    const sql = pgSchema.browseSql(table, orderBy, descending)
    return pgQuery.execute(
      {
        profileId,
        database,
        // Browsing is always read-only regardless of the panel's mode: the grid
        // has no cell editing by design, so it never needs write access.
        readOnly: true,
        sql: `${sql} limit ${String(limit)} offset ${String(offset)}`,
      },
      pgConfig(profileId),
    )
  })
  handle('pg:query', (request) => pgQuery.execute(request, pgConfig(request.profileId)))
  handle('pg:explain', async (request) => ({
    plan: await pgQuery.explain(request, pgConfig(request.profileId)),
  }))
  handle('pg:assess', (request) => pgQuery.assessWithEstimate(request, pgConfig(request.profileId)))
  handle('pg:health', ({ profileId, database }) =>
    pgHealth.report(profileId, database, pgConfig(profileId)),
  )
  handle('pg:cancel-query', async ({ profileId, database, pid, terminate }) => ({
    ok: await pgHealth.cancelQuery(profileId, database, pgConfig(profileId), pid, terminate),
  }))
  handle('pg:backup', async (request) => {
    const window = BrowserWindow.getFocusedWindow()
    const options = {
      title: 'Yedeğin indirileceği klasörü seçin',
      properties: ['openDirectory', 'createDirectory'] as const,
      buttonLabel: 'Buraya indir',
    }
    const result = await (window
      ? dialog.showOpenDialog(window, { ...options, properties: [...options.properties] })
      : dialog.showOpenDialog({ ...options, properties: [...options.properties] }))
    const target = result.filePaths[0]
    if (result.canceled || target === undefined) return null
    return pgBackup.backup(request, pgConfig(request.profileId), target)
  })

  receive('terminal:write', ({ sessionId, data }) => {
    terminals.write(sessionId, data)
  })
  receive('terminal:resize', ({ sessionId, cols, rows }) => {
    terminals.resize(sessionId, cols, rows)
  })
}
