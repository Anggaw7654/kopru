import { useEffect, useMemo, useState } from 'react'
import type { MetricSnapshot } from '@shared/types/metrics.js'
import type { Profile } from '@shared/types/profile.js'
import { useMonitorStore } from '../../stores/monitor.js'
import { formatSize } from '../files/format.js'
import { MetricChart } from './MetricChart.js'
import { ServiceList } from './ServiceList.js'
import { MonitorSettings } from './MonitorSettings.js'
import { useT } from '../../stores/dil.js'

interface Props {
  profile: Profile
}

/** Stable identity: `?? []` inline would be a new array every render and would
 *  invalidate the chart memo on each tick. */
const NO_SNAPSHOTS: MetricSnapshot[] = []

function percent(used: number, total: number): number {
  return total > 0 ? (used / total) * 100 : 0
}

export function MonitorPanel({ profile }: Props): React.JSX.Element {
  const t = useT()
  const snapshots = useMonitorStore((s) => s.byProfile[profile.id]) ?? NO_SNAPSHOTS
  const hydrate = useMonitorStore((s) => s.hydrate)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    void hydrate(profile.id)
  }, [profile.id, hydrate])

  const latest = snapshots.at(-1)

  const chartData = useMemo(() => {
    // uPlot works in unix seconds.
    const timestamps = snapshots.map((s) => Math.floor(s.timestamp / 1000))
    return {
      timestamps,
      cpu: snapshots.map((s) => (s.error === undefined ? s.cpu.percent : null)),
      memory: snapshots.map((s) =>
        s.error === undefined && s.memory.totalBytes > 0
          ? percent(s.memory.totalBytes - s.memory.availableBytes, s.memory.totalBytes)
          : null,
      ),
      load: snapshots.map((s) => (s.error === undefined ? s.cpu.load1 : null)),
    }
  }, [snapshots])

  // Only the newest sample failing means the connection just dropped; a run of
  // good samples behind it is still worth drawing.
  const stale = latest?.error !== undefined

  if (!latest) {
    return (
      <div className="monitor">
        <div className="empty">Veri bekleniyor…</div>
      </div>
    )
  }

  const memoryUsedPercent = percent(
    latest.memory.totalBytes - latest.memory.availableBytes,
    latest.memory.totalBytes,
  )
  const primaryDisk = [...latest.disks].sort((a, b) => b.totalBytes - a.totalBytes)[0]

  return (
    <div className="monitor">
      <div className="monitor__bar">
        {stale && <span className="badge">{t('bağlantı yok — veri bekleniyor')}</span>}
        <span className="monitor__meta">
          {t('{cekirdek} çekirdek · {oturum} oturum', { cekirdek: latest.cpu.cores, oturum: latest.sessions.length })}
        </span>
        <button type="button" onClick={() => { setSettingsOpen(true) }}>{t('Ayarlar')}</button>
      </div>

      <div className="cards">
        <div className="card">
          <span className="card__label">CPU</span>
          <strong className={latest.cpu.percent !== null && latest.cpu.percent > 85 ? 'hot' : ''}>
            {latest.cpu.percent === null ? '—' : `%${latest.cpu.percent.toFixed(0)}`}
          </strong>
          <span className="card__sub">{t('yük {n}', { n: latest.cpu.load1.toFixed(2) })}</span>
        </div>

        <div className="card">
          <span className="card__label">{t('Bellek')}</span>
          <strong className={memoryUsedPercent > 85 ? 'hot' : ''}>
            %{memoryUsedPercent.toFixed(0)}
          </strong>
          <span className="card__sub">
            {formatSize(latest.memory.totalBytes - latest.memory.availableBytes)} /{' '}
            {formatSize(latest.memory.totalBytes)}
          </span>
        </div>

        <div className="card">
          <span className="card__label">Swap</span>
          <strong>
            {latest.memory.swapTotalBytes === 0
              ? 'yok'
              : `%${percent(latest.memory.swapUsedBytes, latest.memory.swapTotalBytes).toFixed(0)}`}
          </strong>
          <span className="card__sub">
            {latest.memory.swapTotalBytes === 0 ? '—' : formatSize(latest.memory.swapUsedBytes)}
          </span>
        </div>

        {primaryDisk && (
          <div className="card">
            <span className="card__label">Disk {primaryDisk.mount}</span>
            <strong className={percent(primaryDisk.usedBytes, primaryDisk.totalBytes) > 85 ? 'hot' : ''}>
              %{percent(primaryDisk.usedBytes, primaryDisk.totalBytes).toFixed(0)}
            </strong>
            <span className="card__sub">{t('{boyut} boş', { boyut: formatSize(primaryDisk.availableBytes) })}</span>
          </div>
        )}

        <div className="card">
          <span className="card__label">{t('SSH oturumu')}</span>
          <strong>{String(latest.sessions.length)}</strong>
          <span className="card__sub">
            {latest.sessions.map((s) => s.user).slice(0, 3).join(', ') || '—'}
          </span>
        </div>

        {latest.nginx && (
          <div className="card">
            <span className="card__label">{t('Tekil IP ({dk} dk)', { dk: latest.nginx.windowMinutes })}</span>
            <strong>
              {latest.nginx.partial ? `${t('en az')} ` : ''}{String(latest.nginx.uniqueIps)}
            </strong>
            <span className="card__sub">{latest.nginx.partial ? t('log penceresi yetmedi') : 'nginx'}</span>
          </div>
        )}

        {latest.docker?.installed === true && (
          <div className="card">
            <span className="card__label">Docker</span>
            <strong className={latest.docker.unhealthy > 0 ? 'hot' : ''}>
              {String(latest.docker.running)} / {String(latest.docker.total)}
            </strong>
            <span className="card__sub">
              {latest.docker.unhealthy > 0
                ? t('{n} konteyner sağlıksız', { n: latest.docker.unhealthy })
                : t('çalışan / toplam')}
            </span>
          </div>
        )}

        {latest.postgres && (
          <div className="card">
            <span className="card__label">PostgreSQL</span>
            <strong>{String(latest.postgres.connections)}</strong>
            <span className="card__sub">
              {latest.postgres.slowQueries > 0
                ? t('{n} yavaş sorgu', { n: latest.postgres.slowQueries })
                : t('bağlantı')}
            </span>
          </div>
        )}
      </div>

      <div className="charts">
        <MetricChart
          title={t('CPU kullanımı (son 15 dk)')}
          timestamps={chartData.timestamps}
          range={[0, 100]}
          unit="%"
          series={[{ label: 'CPU', values: chartData.cpu, color: '#7aa2f7' }]}
        />
        <MetricChart
          title={t('Bellek kullanımı (son 15 dk)')}
          timestamps={chartData.timestamps}
          range={[0, 100]}
          unit="%"
          series={[{ label: t('Bellek'), values: chartData.memory, color: '#9ece6a' }]}
        />
        <MetricChart
          title={t('Yük ortalaması (1 dk)')}
          timestamps={chartData.timestamps}
          series={[{ label: t('Yük'), values: chartData.load, color: '#e0af68' }]}
        />
      </div>

      {latest.disks.length > 1 && (
        <div className="disks">
          <h4>Diskler</h4>
          {latest.disks.map((disk) => (
            <div key={disk.mount} className="disk">
              <span>{disk.mount}</span>
              <div className="progress">
                <div style={{ width: `${String(percent(disk.usedBytes, disk.totalBytes))}%` }} />
              </div>
              <span className="card__sub">
                {formatSize(disk.usedBytes)} / {formatSize(disk.totalBytes)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="section">
        <h4>Servisler</h4>
        <ServiceList profileId={profile.id} services={latest.services} />
      </div>

      {settingsOpen && (
        <MonitorSettings profile={profile} onClose={() => { setSettingsOpen(false) }} />
      )}
    </div>
  )
}
