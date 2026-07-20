import { useEffect } from 'react'
import { useProfileStore } from './stores/profiles.js'
import { useConnectionStore } from './stores/connection.js'
import { useTerminalStore } from './stores/terminal.js'
import { ProfileList } from './features/profiles/ProfileList.js'
import { TerminalTabs } from './features/terminal/TerminalTabs.js'

export function App(): React.JSX.Element {
  const loadProfiles = useProfileStore((s) => s.load)
  const profileError = useProfileStore((s) => s.error)
  const { apply, hydrate, setMismatch, mismatch, setActive, activeProfileId } = useConnectionStore()
  const markRestored = useTerminalStore((s) => s.markRestored)
  const removeTab = useTerminalStore((s) => s.remove)

  useEffect(() => {
    void loadProfiles()
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
    }
  }, [loadProfiles, hydrate, apply, setMismatch, setActive, markRestored, removeTab])

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
          <TerminalTabs />
        )}
      </main>
    </div>
  )
}
