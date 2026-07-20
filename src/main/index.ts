import { join } from 'node:path'
import { app, BrowserWindow, shell, session } from 'electron'
import { registerIpcHandlers } from './ipc-registry.js'
import * as manager from './ssh/manager.js'
import * as terminals from './modules/terminal/registry.js'
import * as sftpPool from './modules/files/sftp.js'
import * as monitor from './modules/monitor/collector.js'
import * as dockerLogs from './modules/docker/logs.js'
import * as dockerDetect from './modules/docker/detect.js'
import * as profiles from './ssh/profiles.js'

const isDev = !app.isPackaged

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1b26',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload needs Node built-ins for the typed bridge
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  })

  window.once('ready-to-show', () => {
    window.show()
  })

  // Nothing in this app should ever open a second window or navigate away from
  // the bundled renderer; both are how a compromised page escalates.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })

  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (isDev && devServerUrl) {
    void window.loadURL(devServerUrl)
  } else {
    void window.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }

  return window
}

function applyContentSecurityPolicy(): void {
  // Vite's dev server needs inline styles and a websocket for HMR; production
  // gets the locked-down policy.
  const policy = isDev
    ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: http://localhost:*; img-src 'self' data:; font-src 'self' data:"
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self' data:; object-src 'none'; base-uri 'none'; frame-src 'none'"

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy],
      },
    })
  })
}

void app.whenReady().then(async () => {
  app.setName('Köprü')
  applyContentSecurityPolicy()
  registerIpcHandlers()

  // A reconnect leaves every tab without a remote pty; give them fresh ones.
  manager.onConnectionReady((profileId) => {
    // The old SFTP channels went down with the connection; forget the handles
    // so the next request opens fresh ones.
    sftpPool.reset(profileId)
    void terminals.reviveFor(profileId)

    // Metric collection runs while connected regardless of whether the panel is
    // open; alerts that only fire when the user is already watching are useless.
    const profile = profiles.list().find((p) => p.id === profileId)
    if (profile) monitor.start(profile)
  })

  manager.onConnectionLost((profileId) => {
    // Without this every tick would throw "not connected" until reconnect.
    monitor.stop(profileId)
    // Follow channels died with the connection; drop the handles so a
    // reconnect does not accumulate orphans.
    dockerLogs.stopAllFor(profileId)
    dockerDetect.forget(profileId)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  await manager.autoConnect()
})

// Sessions live in main, so closing the last window on macOS must not tear them
// down — the user expects to reopen and find the server still connected.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  manager.disconnectAll()
})
