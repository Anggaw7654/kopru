import { useEffect, useState } from 'react'
import type { MonitorConfig } from '@shared/types/metrics.js'
import type { Profile } from '@shared/types/profile.js'
import { useProfileStore } from '../../stores/profiles.js'

interface Props {
  profile: Profile
  onClose: () => void
}

export function MonitorSettings({ profile, onClose }: Props): React.JSX.Element {
  const save = useProfileStore((s) => s.save)
  const [config, setConfig] = useState<MonitorConfig>(profile.monitor)
  const [units, setUnits] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.kopru
      .invoke('monitor:list-units', { profileId: profile.id })
      .then(({ units: list }) => { setUnits(list) })
      .catch((err: unknown) => { setError(err instanceof Error ? err.message : String(err)) })
  }, [profile.id])

  const patch = (partial: Partial<MonitorConfig>): void => {
    setConfig((current) => ({ ...current, ...partial }))
  }

  const toggleService = (unit: string): void => {
    patch({
      services: config.services.includes(unit)
        ? config.services.filter((s) => s !== unit)
        : [...config.services, unit],
    })
  }

  const apply = async (): Promise<void> => {
    const input = {
      id: profile.id,
      name: profile.name,
      host: profile.host,
      port: profile.port,
      username: profile.username,
      authType: profile.authType,
      autoConnect: profile.autoConnect,
      monitor: config,
      ...(profile.privateKeyPath !== undefined ? { privateKeyPath: profile.privateKeyPath } : {}),
    }
    await save(input)
    onClose()
  }

  const visible = units.filter((u) => u.includes(filter.toLowerCase()))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => { e.stopPropagation() }}>
        <h3>İzleme ayarları — {profile.name}</h3>

        <label>
          Ölçüm aralığı (saniye)
          <input
            type="number"
            min={2}
            value={String(config.intervalMs / 1000)}
            onChange={(e) => { patch({ intervalMs: Math.max(2, Number(e.target.value)) * 1000 }) }}
          />
        </label>

        <h4>Eşikler</h4>
        <div className="row">
          <label>Disk %<input type="number" value={String(config.thresholds.diskPercent)}
            onChange={(e) => { patch({ thresholds: { ...config.thresholds, diskPercent: Number(e.target.value) } }) }} /></label>
          <label>Bellek %<input type="number" value={String(config.thresholds.memPercent)}
            onChange={(e) => { patch({ thresholds: { ...config.thresholds, memPercent: Number(e.target.value) } }) }} /></label>
          <label>Çekirdek başı yük<input type="number" step="0.1" value={String(config.thresholds.loadPerCore)}
            onChange={(e) => { patch({ thresholds: { ...config.thresholds, loadPerCore: Number(e.target.value) } }) }} /></label>
        </div>

        <h4>nginx (isteğe bağlı)</h4>
        <label>
          Erişim logu yolu — boş bırakılırsa ölçülmez
          <input
            value={config.nginxLogPath ?? ''}
            placeholder="/var/log/nginx/access.log"
            onChange={(e) => {
              const value = e.target.value.trim()
              setConfig((c) => {
                const next = { ...c }
                if (value === '') delete next.nginxLogPath
                else next.nginxLogPath = value
                return next
              })
            }}
          />
        </label>

        <label className="checkbox">
          <input type="checkbox" checked={config.postgres}
            onChange={(e) => { patch({ postgres: e.target.checked }) }} />
          PostgreSQL bağlantı sayısını ölç (sunucuda parolasız psql erişimi gerekir)
        </label>

        <h4>İzlenecek servisler ({String(config.services.length)} seçili)</h4>
        {error !== null && <p className="error">{error}</p>}
        <input placeholder="Servis ara…" value={filter}
          onChange={(e) => { setFilter(e.target.value.toLowerCase()) }} />
        <div className="unit-list">
          {visible.length === 0 && <p className="hint">Servis bulunamadı.</p>}
          {visible.map((unit) => (
            <label key={unit} className="checkbox">
              <input type="checkbox" checked={config.services.includes(unit)}
                onChange={() => { toggleService(unit) }} />
              {unit}
            </label>
          ))}
        </div>

        <div className="row">
          <button type="button" onClick={() => void apply()}>Kaydet</button>
          <button type="button" onClick={onClose}>Vazgeç</button>
        </div>
        <p className="hint">
          Değişiklikler bağlantı yeniden kurulduğunda ya da yeniden bağlandığınızda geçerli olur.
        </p>
      </div>
    </div>
  )
}
