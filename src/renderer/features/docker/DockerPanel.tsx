import { useCallback, useEffect, useState } from 'react'
import type {
  ComposeProject, Container, ContainerStats, DiskUsageEntry, DockerAvailability, PruneTarget,
} from '@shared/types/docker.js'
import { useTerminalStore } from '../../stores/terminal.js'
import { formatSize } from '../files/format.js'
import { ContainerLogs } from './ContainerLogs.js'
import { PruneDialog } from './PruneDialog.js'

interface Props {
  profileId: string
}

type Tab = 'containers' | 'compose' | 'storage'

/** `docker stats` costs 1-2 s; ten seconds between rounds, panel-only. */
const STATS_INTERVAL_MS = 10_000

export function DockerPanel({ profileId }: Props): React.JSX.Element {
  const addTerminalTab = useTerminalStore((s) => s.add)

  const [availability, setAvailability] = useState<DockerAvailability | null>(null)
  const [tab, setTab] = useState<Tab>('containers')
  const [containers, setContainers] = useState<Container[]>([])
  const [stats, setStats] = useState<Record<string, ContainerStats>>({})
  const [projects, setProjects] = useState<ComposeProject[]>([])
  const [usage, setUsage] = useState<DiskUsageEntry[]>([])
  const [logsFor, setLogsFor] = useState<Container | null>(null)
  const [pruneTarget, setPruneTarget] = useState<PruneTarget | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const fail = (err: unknown): void => {
    setError(err instanceof Error ? err.message : String(err))
  }

  useEffect(() => {
    window.kopru.invoke('docker:availability', { profileId }).then(setAvailability).catch(fail)
  }, [profileId])

  const reloadContainers = useCallback((): void => {
    window.kopru.invoke('docker:containers', { profileId }).then(setContainers).catch(fail)
  }, [profileId])

  useEffect(() => {
    if (availability?.ok !== true) return
    reloadContainers()
  }, [availability, reloadContainers])

  // Expensive stats poll runs only while this panel is mounted (ADR 0011).
  useEffect(() => {
    if (availability?.ok !== true || tab !== 'containers') return

    let active = true
    const poll = (): void => {
      window.kopru
        .invoke('docker:stats', { profileId })
        .then((rows) => {
          if (!active) return
          setStats(Object.fromEntries(rows.map((row) => [row.id, row])))
        })
        .catch(() => {
          // Stats are decorative; a failure must not blank the container list.
        })
    }
    poll()
    const timer = setInterval(poll, STATS_INTERVAL_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [availability, profileId, tab])

  useEffect(() => {
    if (availability?.ok !== true) return
    if (tab === 'compose') {
      window.kopru.invoke('docker:compose-list', { profileId }).then(setProjects).catch(fail)
    } else if (tab === 'storage') {
      window.kopru.invoke('docker:disk-usage', { profileId }).then(setUsage).catch(fail)
    }
  }, [availability, profileId, tab])

  if (availability === null) {
    return <div className="empty">Docker denetleniyor…</div>
  }

  if (!availability.ok) {
    return (
      <div className="docker">
        <div className="docker__missing">
          <h3>Docker kullanılamıyor</h3>
          <pre>{availability.message}</pre>
        </div>
      </div>
    )
  }

  const containerAction = async (
    container: Container,
    action: 'start' | 'stop' | 'restart',
  ): Promise<void> => {
    const label = { start: 'başlatılacak', stop: 'durdurulacak', restart: 'yeniden başlatılacak' }[action]
    if (!window.confirm(`${container.name} konteyneri ${label}.\n\nDevam edilsin mi?`)) return
    setBusy(container.id)
    setError(null)
    try {
      await window.kopru.invoke('docker:container-action', { profileId, id: container.id, action })
      reloadContainers()
    } catch (err) {
      fail(err)
    } finally {
      setBusy(null)
    }
  }

  const openShell = (container: Container): void => {
    window.kopru
      .invoke('docker:shell-command', { containerId: container.id })
      .then(({ command }) =>
        window.kopru.invoke('terminal:create', { profileId, cols: 80, rows: 24 }).then((session) => {
          addTerminalTab({
            sessionId: session.sessionId,
            profileId: session.profileId,
            title: container.name,
            restored: false,
          })
          // The terminal channel already has a pty, which is what `docker exec
          // -it` needs — no second pty mechanism required.
          window.kopru.send('terminal:write', { sessionId: session.sessionId, data: `${command}\n` })
        }),
      )
      .catch(fail)
  }

  const composeAction = async (
    project: ComposeProject,
    action: 'up' | 'down' | 'restart' | 'apply',
  ): Promise<void> => {
    const label = {
      up: 'başlatılacak', down: 'durdurulup kaldırılacak',
      restart: 'yeniden başlatılacak', apply: 'durdurulup yeniden oluşturulacak',
    }[action]
    if (!window.confirm(`${project.name} projesi ${label}.\n\nDevam edilsin mi?`)) return
    setBusy(project.name)
    setError(null)
    try {
      if (action === 'apply') {
        await window.kopru.invoke('docker:compose-apply', { profileId, project: project.name })
      } else {
        await window.kopru.invoke('docker:compose-action', { profileId, project: project.name, action })
      }
      const list = await window.kopru.invoke('docker:compose-list', { profileId })
      setProjects(list)
      reloadContainers()
    } catch (err) {
      fail(err)
    } finally {
      setBusy(null)
    }
  }

  if (logsFor) {
    return (
      <ContainerLogs
        key={logsFor.id}
        profileId={profileId}
        container={logsFor}
        onClose={() => { setLogsFor(null) }}
      />
    )
  }

  return (
    <div className="docker">
      <div className="docker__tabs">
        <button type="button" className={tab === 'containers' ? 'view-switch--active' : ''}
          onClick={() => { setTab('containers') }}>Konteynerler</button>
        <button type="button" className={tab === 'compose' ? 'view-switch--active' : ''}
          onClick={() => { setTab('compose') }}>Compose</button>
        <button type="button" className={tab === 'storage' ? 'view-switch--active' : ''}
          onClick={() => { setTab('storage') }}>Depolama</button>
      </div>

      {error !== null && <div className="banner banner--error">{error}</div>}

      {tab === 'containers' && (
        <table className="file-table">
          <thead>
            <tr>
              <th>Ad</th><th>Görüntü</th><th>Durum</th><th>Portlar</th>
              <th>CPU</th><th>Bellek</th><th />
            </tr>
          </thead>
          <tbody>
            {containers.map((container) => {
              const stat = stats[container.id]
              return (
                <tr key={container.id}>
                  <td>
                    <span className={`dot ${
                      container.health === 'unhealthy' ? 'dot--error'
                      : container.running ? 'dot--connected' : 'dot--disconnected'
                    }`} />
                    {container.name}
                    {container.project !== undefined && <em className="tag">{container.project}</em>}
                  </td>
                  <td className="ellipsis">{container.image}</td>
                  <td>
                    {container.status}
                    {container.health === 'unhealthy' && <strong className="hot"> ⚠</strong>}
                  </td>
                  <td>
                    {container.ports.map((p) =>
                      p.hostPort === undefined
                        ? `${String(p.containerPort)}/${p.protocol}`
                        : `${String(p.hostPort)}→${String(p.containerPort)}`,
                    ).join(', ') || '—'}
                  </td>
                  <td>{stat ? `%${stat.cpuPercent.toFixed(1)}` : '—'}</td>
                  <td>{stat ? formatSize(stat.memoryUsedBytes) : '—'}</td>
                  <td className="actions">
                    {container.running ? (
                      <>
                        <button type="button" disabled={busy === container.id}
                          onClick={() => void containerAction(container, 'restart')}>Yeniden başlat</button>
                        <button type="button" disabled={busy === container.id}
                          onClick={() => void containerAction(container, 'stop')}>Durdur</button>
                        <button type="button" onClick={() => { openShell(container) }}>Kabuk</button>
                      </>
                    ) : (
                      <button type="button" disabled={busy === container.id}
                        onClick={() => void containerAction(container, 'start')}>Başlat</button>
                    )}
                    <button type="button" onClick={() => { setLogsFor(container) }}>Log</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {tab === 'containers' && containers.length === 0 && (
        <p className="hint">Konteyner yok.</p>
      )}

      {tab === 'compose' && (
        <>
          {availability.composeCommand === null && (
            <p className="hint">Bu sunucuda Docker Compose kurulu değil.</p>
          )}
          {projects.map((project) => (
            <div key={project.name} className="compose">
              <div className="compose__head">
                <strong>{project.name}</strong>
                <span className="card__sub">{project.status}</span>
              </div>
              <span className="card__sub ellipsis">{project.configFiles.join(', ') || '—'}</span>
              <div className="actions">
                <button type="button" disabled={busy === project.name}
                  onClick={() => void composeAction(project, 'up')}>Başlat</button>
                <button type="button" disabled={busy === project.name}
                  onClick={() => void composeAction(project, 'restart')}>Yeniden başlat</button>
                <button type="button" disabled={busy === project.name}
                  onClick={() => void composeAction(project, 'down')}>Durdur</button>
                <button type="button" disabled={busy === project.name}
                  title="down + up: dosyadaki değişikliklerin tamamı uygulanır"
                  onClick={() => void composeAction(project, 'apply')}>Değişikliği uygula</button>
              </div>
            </div>
          ))}
          {projects.length > 0 && (
            <p className="hint">
              Compose dosyasını düzenlemek için Dosyalar sekmesinden yukarıdaki yolu açın,
              sonra “Değişikliği uygula” deyin.
            </p>
          )}
        </>
      )}

      {tab === 'storage' && (
        <>
          <table className="file-table">
            <thead>
              <tr><th>Tür</th><th>Toplam</th><th>Etkin</th><th>Boyut</th><th>Geri kazanılabilir</th></tr>
            </thead>
            <tbody>
              {usage.map((row) => (
                <tr key={row.type}>
                  <td>{row.type}</td>
                  <td>{String(row.total)}</td>
                  <td>{String(row.active)}</td>
                  <td>{formatSize(row.sizeBytes)}</td>
                  <td>{formatSize(row.reclaimableBytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="actions prune-actions">
            <button type="button" className="danger" onClick={() => { setPruneTarget('image') }}>Görüntüleri temizle</button>
            <button type="button" className="danger" onClick={() => { setPruneTarget('container') }}>Durmuş konteynerleri temizle</button>
            <button type="button" className="danger" onClick={() => { setPruneTarget('network') }}>Ağları temizle</button>
            <button type="button" className="danger" onClick={() => { setPruneTarget('buildcache') }}>Derleme önbelleğini temizle</button>
            <button type="button" className="danger" onClick={() => { setPruneTarget('volume') }}>Volume’leri temizle</button>
          </div>
        </>
      )}

      {pruneTarget !== null && (
        <PruneDialog
          profileId={profileId}
          target={pruneTarget}
          onClose={() => { setPruneTarget(null) }}
          onDone={(reclaimed) => {
            setPruneTarget(null)
            window.alert(`${formatSize(reclaimed)} geri kazanıldı.`)
            window.kopru.invoke('docker:disk-usage', { profileId }).then(setUsage).catch(fail)
          }}
        />
      )}
    </div>
  )
}
