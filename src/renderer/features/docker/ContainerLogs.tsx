import { useEffect, useMemo, useRef, useState } from 'react'
import type { Container } from '@shared/types/docker.js'

interface Props {
  profileId: string
  container: Container
  onClose: () => void
}

export function ContainerLogs({ profileId, container, onClose }: Props): React.JSX.Element {
  const [lines, setLines] = useState<string[]>([])
  const [following, setFollowing] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.kopru
      .invoke('docker:logs', { profileId, containerId: container.id, tail: 500 })
      .then(({ content }) => { setLines(content.split('\n')) })
      .catch((err: unknown) => { setError(err instanceof Error ? err.message : String(err)) })
  }, [profileId, container.id])

  useEffect(() => {
    if (!following) return

    const off = window.kopru.on('docker:log-chunk', (payload) => {
      if (payload.containerId !== container.id) return
      setLines((current) => {
        const next = [...current, ...payload.chunk.split('\n')]
        // Cap the buffer: an application logging in a loop would otherwise grow
        // this array without bound and take the renderer down.
        return next.length > 5000 ? next.slice(-5000) : next
      })
    })

    window.kopru
      .invoke('docker:follow-start', { profileId, containerId: container.id })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err))
        setFollowing(false)
      })

    return () => {
      off()
      // Always stop the remote channel, whichever way this unmounts — toggling
      // off, changing container, or closing the panel.
      void window.kopru.invoke('docker:follow-stop', { profileId, containerId: container.id })
    }
  }, [following, profileId, container.id])

  const visible = useMemo(() => {
    if (search === '') return lines
    const needle = search.toLowerCase()
    return lines.filter((line) => line.toLowerCase().includes(needle))
  }, [lines, search])

  useEffect(() => {
    if (following) bottomRef.current?.scrollIntoView()
  }, [visible.length, following])

  return (
    <div className="logs">
      <header className="logs__bar">
        <strong>{container.name}</strong>
        <input
          className="logs__search"
          placeholder="Loglarda ara…"
          value={search}
          onChange={(e) => { setSearch(e.target.value) }}
        />
        <label className="checkbox">
          <input
            type="checkbox"
            checked={following}
            onChange={(e) => { setFollowing(e.target.checked) }}
          />
          Canlı takip
        </label>
        <button type="button" disabled title="Faz 6’da gelecek">Claude’a gönder</button>
        <button type="button" onClick={onClose}>Kapat</button>
      </header>

      {error !== null && <p className="error">{error}</p>}

      <div className="logs__body">
        <pre>{visible.join('\n')}</pre>
        <div ref={bottomRef} />
      </div>

      <footer className="logs__meta">
        {search === ''
          ? `${String(lines.length)} satır`
          : `${String(visible.length)} / ${String(lines.length)} satır eşleşti`}
      </footer>
    </div>
  )
}
