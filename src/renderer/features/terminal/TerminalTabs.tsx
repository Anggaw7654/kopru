import { useCallback } from 'react'
import { useTerminalStore } from '../../stores/terminal.js'
import { useConnectionStore } from '../../stores/connection.js'
import { TerminalPane } from './TerminalPane.js'

export function TerminalTabs(): React.JSX.Element {
  const { tabs, activeSessionId, add, remove, setActive } = useTerminalStore()
  const activeProfileId = useConnectionStore((s) => s.activeProfileId)
  const connection = useConnectionStore((s) =>
    s.activeProfileId ? s.byProfile[s.activeProfileId] : undefined,
  )
  const connected = connection?.state === 'connected'

  const openTab = useCallback(async () => {
    if (!activeProfileId) return
    try {
      const session = await window.kopru.invoke('terminal:create', {
        profileId: activeProfileId,
        cols: 80,
        rows: 24,
      })
      add({
        sessionId: session.sessionId,
        profileId: session.profileId,
        title: `Terminal ${String(useTerminalStore.getState().tabs.length + 1)}`,
        restored: false,
      })
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error))
    }
  }, [activeProfileId, add])

  const closeTab = useCallback(
    async (sessionId: string) => {
      await window.kopru.invoke('terminal:close', { sessionId })
      remove(sessionId)
    },
    [remove],
  )

  return (
    <div className="terminal-area">
      <div className="tab-bar">
        {tabs.map((tab) => (
          <div
            key={tab.sessionId}
            className={`tab ${tab.sessionId === activeSessionId ? 'tab--active' : ''}`}
            onClick={() => {
              setActive(tab.sessionId)
            }}
          >
            <span>{tab.title}</span>
            <button
              type="button"
              className="tab__close"
              aria-label="Sekmeyi kapat"
              onClick={(event) => {
                event.stopPropagation()
                void closeTab(tab.sessionId)
              }}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="tab__new"
          disabled={!connected}
          onClick={() => void openTab()}
        >
          + Yeni terminal
        </button>
      </div>

      <div className="terminal-stack">
        {tabs.length === 0 && (
          <div className="empty">
            {connected
              ? 'Başlamak için “Yeni terminal” deyin.'
              : 'Terminal açmak için önce bir sunucuya bağlanın.'}
          </div>
        )}
        {tabs.map((tab) => (
          <TerminalPane
            key={tab.sessionId}
            sessionId={tab.sessionId}
            visible={tab.sessionId === activeSessionId}
          />
        ))}
      </div>
    </div>
  )
}
