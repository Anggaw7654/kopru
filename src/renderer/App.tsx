import { useEffect, useState } from 'react'
import { useProfileStore } from './stores/profiles.js'
import { useConnectionStore } from './stores/connection.js'
import { useTerminalStore } from './stores/terminal.js'
import { ProfileList } from './features/profiles/ProfileList.js'
import { TerminalTabs } from './features/terminal/TerminalTabs.js'
import { FileBrowser } from './features/files/FileBrowser.js'
import { MonitorPanel } from './features/monitor/MonitorPanel.js'
import { DockerPanel } from './features/docker/DockerPanel.js'
import { PostgresPanel } from './features/postgres/PostgresPanel.js'
import { ContextPanel } from './features/context/ContextPanel.js'
import { SettingsPanel } from './features/settings/SettingsPanel.js'
import { useSettingsStore, applyTheme } from './stores/settings.js'
import { useFileStore } from './stores/files.js'
import { useMonitorStore } from './stores/monitor.js'
import { useProfileStore as useProfiles } from './stores/profiles.js'
import { useTransferStore } from './stores/transfers.js'

export function App(): React.JSX.Element {
  const loadProfiles = useProfileStore((s) => s.load)
  const profileError = useProfileStore((s) => s.error)
  const { apply, hydrate, setMismatch, mismatch, setActive, activeProfileId } = useConnectionStore()
  const markRestored = useTerminalStore((s) => s.markRestored)
  const removeTab = useTerminalStore((s) => s.remove)
  const applyTransfer = useTransferStore((s) => s.apply)
  const hydrateTransfers = useTransferStore((s) => s.hydrate)
  const applySample = useMonitorStore((s) => s.apply)
  const profiles = useProfiles((s) => s.profiles)
  const [view, setView] = useState<'files' | 'terminal' | 'monitor' | 'docker' | 'pg'>('files')
  const settingsOpen = useSettingsStore((s) => s.open)
  const themeChoice = useSettingsStore((s) => s.theme)

  useEffect(() => {
    applyTheme(themeChoice)
    if (themeChoice !== 'system') return
    // Only track the OS while set to follow it; an explicit choice must not be
    // overridden when the Mac switches at sunset.
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => { applyTheme('system') }
    media.addEventListener('change', onChange)
    return () => { media.removeEventListener('change', onChange) }
  }, [themeChoice])

  useEffect(() => {
    void loadProfiles().then(() => {
      // Bookmarks used to live in localStorage and showed only the last path
      // segment, so two project roots ending in public_html were
      // indistinguishable. Carry them into the named per-profile list once.
      const raw = localStorage.getItem('kopru.favorites')
      if (raw === null) return
      localStorage.removeItem('kopru.favorites')
      let paths: string[] = []
      try {
        const parsed: unknown = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          paths = parsed.filter((value): value is string => typeof value === 'string')
        }
      } catch {
        return
      }
      if (paths.length === 0) return

      const target = useProfiles.getState().profiles.find((p) => p.shortcuts.length === 0)
      if (!target) return
      void window.kopru
        .invoke('fs:set-shortcuts', {
          profileId: target.id,
          shortcuts: paths.map((value) => ({
            id: crypto.randomUUID(),
            label: value.split('/').filter(Boolean).at(-1) ?? value,
            path: value,
          })),
        })
        .then(() => loadProfiles())
    })
    void hydrate()

    const offState = window.kopru.on('connection:state', (snapshot) => {
      apply(snapshot)
      // First connection to arrive becomes the active one, so an auto-connect
      // profile lands the user straight in a usable state.
      if (
        snapshot.state === 'connected' &&
        useConnectionStore.getState().activeProfileId === null
      ) {
        setActive(snapshot.profileId)
      }
    })
    const offMismatch = window.kopru.on('connection:hostkey-mismatch', (payload) => {
      setMismatch(payload)
    })
    const offRestored = window.kopru.on('terminal:restored', ({ sessionId }) => {
      markRestored(sessionId, true)
    })
    const offTransfer = window.kopru.on('transfer:update', (transfer) => {
      applyTransfer(transfer)
    })
    const offSample = window.kopru.on('monitor:sample', (snapshot) => {
      applySample(snapshot)
    })
    const offInvalidate = window.kopru.on('fs:invalidate', ({ profileId, path }) => {
      // Only reload if the user is standing in the directory that changed.
      const store = useFileStore.getState()
      if (store.path === path) void store.navigate(profileId, path)
    })
    void hydrateTransfers()

    const offExit = window.kopru.on('terminal:exit', ({ sessionId }) => {
      // Keep the tab: after a drop the pty is gone but the tab is revived, and
      // removing it here would delete the scrollback the user is reading.
      markRestored(sessionId, false)
      void sessionId
    })

    return () => {
      offState()
      offMismatch()
      offRestored()
      offExit()
      offTransfer()
      offInvalidate()
      offSample()
    }
  }, [
    loadProfiles, hydrate, apply, setMismatch, setActive, markRestored, removeTab,
    applyTransfer, hydrateTransfers, applySample,
  ])

  const activeProfile = profiles.find((p) => p.id === activeProfileId)

  return (
    <div className="app">
      <ProfileList />
      <main className="main">
        {profileError !== null && <div className="banner banner--error">{profileError}</div>}
        {mismatch && (
          <div className="banner banner--danger">
            <strong>Güvenlik uyarısı:</strong> {mismatch.host}:{mismatch.port} sunucusunun kimliği
            değişti; bağlantı reddedildi. Kayıtlı: <code>{mismatch.pinnedFingerprint}</code> —
            sunulan: <code>{mismatch.presentedFingerprint}</code>
          </div>
        )}
        {activeProfileId === null ? (
          <div className="empty">Soldan bir sunucu seçip bağlanın.</div>
        ) : (
          <>
            <div className="view-switch">
              <button
                type="button"
                className={view === 'files' ? 'view-switch--active' : ''}
                onClick={() => { setView('files') }}
              >
                Dosyalar
              </button>
              <button
                type="button"
                className={view === 'monitor' ? 'view-switch--active' : ''}
                onClick={() => { setView('monitor') }}
              >
                İzleme
              </button>
              <button
                type="button"
                className={view === 'docker' ? 'view-switch--active' : ''}
                onClick={() => { setView('docker') }}
              >
                Docker
              </button>
              <button
                type="button"
                className={view === 'pg' ? 'view-switch--active' : ''}
                onClick={() => { setView('pg') }}
              >
                PostgreSQL
              </button>
              <button
                type="button"
                className={view === 'terminal' ? 'view-switch--active' : ''}
                onClick={() => { setView('terminal') }}
              >
                Terminal
              </button>
            </div>
            {/* Both stay mounted: unmounting the terminal would throw away
                every tab's scrollback on a view switch. */}
            <div style={{ display: view === 'files' ? 'contents' : 'none' }}>
              {activeProfile && <FileBrowser profile={activeProfile} />}
            </div>
            <div style={{ display: view === 'monitor' ? 'contents' : 'none' }}>
              {view === 'monitor' && activeProfile && <MonitorPanel profile={activeProfile} />}
            </div>
            {/* Unmounted when hidden on purpose: the expensive `docker stats`
                poll and any live log follow must stop when the user leaves. */}
            <div style={{ display: view === 'docker' ? 'contents' : 'none' }}>
              {view === 'docker' && <DockerPanel profileId={activeProfileId} />}
            </div>
            {/* Unmounted when hidden: the health tab polls every 5 s and the
                tunnelled connections should not stay warm for a hidden panel. */}
            <div style={{ display: view === 'pg' ? 'contents' : 'none' }}>
              {view === 'pg' && activeProfile && <PostgresPanel profile={activeProfile} />}
            </div>
            <div style={{ display: view === 'terminal' ? 'contents' : 'none' }}>
              <TerminalTabs />
            </div>
          </>
        )}
        <ContextPanel profileId={activeProfileId} />
        {settingsOpen && <SettingsPanel />}
      </main>
    </div>
  )
}
