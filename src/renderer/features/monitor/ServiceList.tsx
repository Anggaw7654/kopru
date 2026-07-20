import { useState } from 'react'
import type { ServiceStatus } from '@shared/types/metrics.js'

interface Props {
  profileId: string
  services: ServiceStatus[]
}

export function ServiceList({ profileId, services }: Props): React.JSX.Element {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const restart = async (unit: string): Promise<void> => {
    if (!window.confirm(`${unit} servisi yeniden başlatılacak.\n\nDevam edilsin mi?`)) return
    setBusy(unit)
    setError(null)
    try {
      await window.kopru.invoke('monitor:restart-service', { profileId, unit })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  if (services.length === 0) {
    return <p className="hint">İzlenecek servis seçilmedi. Ayarlar’dan ekleyin.</p>
  }

  return (
    <div className="services">
      {error !== null && <p className="error">{error}</p>}
      {services.map((service) => (
        <div key={service.unit} className="service">
          <span className={`dot ${service.active ? 'dot--connected' : 'dot--error'}`} />
          <strong>{service.unit}</strong>
          <span className="service__state">{service.state}</span>
          <button type="button" disabled={busy === service.unit} onClick={() => void restart(service.unit)}>
            {busy === service.unit ? 'Başlatılıyor…' : 'Yeniden başlat'}
          </button>
        </div>
      ))}
    </div>
  )
}
