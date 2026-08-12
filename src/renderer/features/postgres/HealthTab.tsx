import { useCallback, useEffect, useState } from 'react'
import type { HealthReport } from '@shared/types/postgres.js'
import { formatSize } from '../files/format.js'
import { useT } from '../../stores/dil.js'

interface Props {
  profileId: string
  database: string
}

export function HealthTab({ profileId, database }: Props): React.JSX.Element {
  const t = useT()
  const [report, setReport] = useState<HealthReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback((): void => {
    window.kopru
      .invoke('pg:health', { profileId, database })
      .then(setReport)
      .catch((err: unknown) => { setError(err instanceof Error ? err.message : String(err)) })
  }, [profileId, database])

  useEffect(() => {
    load()
    const timer = setInterval(load, 5000)
    return () => { clearInterval(timer) }
  }, [load])

  const stopStatement = async (pid: number, hard: boolean): Promise<void> => {
    const question = hard
      ? t('{pid} numaralı oturum tamamen sonlandırılacak. Çalışan işlem geri alınır.\n\nDevam edilsin mi?', { pid })
      : t('{pid} numaralı oturumun çalışan sorgusu durdurulacak. Oturum açık kalır.\n\nDevam edilsin mi?', { pid })
    if (!window.confirm(question)) return
    try {
      await window.kopru.invoke('pg:cancel-query', { profileId, database, pid, terminate: hard })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (error !== null) return <div className="banner banner--error">{error}</div>
  if (report === null) return <p className="hint">{t('Yükleniyor…')}</p>

  const saturation = report.connections.max > 0
    ? (report.connections.used / report.connections.max) * 100
    : 0

  return (
    <div className="health">
      <div className="cards">
        <div className="card">
          <span className="card__label">{t('Bağlantı')}</span>
          <strong className={saturation > 80 ? 'hot' : ''}>
            {String(report.connections.used)} / {String(report.connections.max)}
          </strong>
          <span className="card__sub">%{saturation.toFixed(0)} doluluk</span>
        </div>
        <div className="card">
          <span className="card__label">Aktif oturum</span>
          <strong>{String(report.activity.filter((a) => a.state === 'active').length)}</strong>
          <span className="card__sub">{String(report.activity.length)} toplam</span>
        </div>
        <div className="card">
          <span className="card__label">Bekleyen</span>
          <strong className={report.activity.some((a) => a.waitEvent !== null) ? 'hot' : ''}>
            {String(report.activity.filter((a) => a.waitEvent !== null).length)}
          </strong>
          <span className="card__sub">{t('kilit / G-Ç beklemesi')}</span>
        </div>
      </div>

      <div className="section">
        <h4>Oturumlar</h4>
        <table className="file-table">
          <thead>
            <tr><th>PID</th><th>{t('Kullanıcı')}</th><th>Durum</th><th>{t('Süre')}</th><th>Bekleme</th><th>Sorgu</th><th /></tr>
          </thead>
          <tbody>
            {report.activity.map((row) => (
              <tr key={row.pid}>
                <td>{String(row.pid)}</td>
                <td>{row.user}</td>
                <td>{row.state}</td>
                <td className={row.durationSeconds > 30 ? 'hot' : ''}>
                  {row.durationSeconds > 0 ? `${row.durationSeconds.toFixed(1)} sn` : '—'}
                </td>
                <td>{row.waitEvent ?? '—'}</td>
                <td className="ellipsis" title={row.query}>{row.query}</td>
                <td className="actions">
                  <button type="button" onClick={() => void stopStatement(row.pid, false)}>
                    Sorguyu durdur
                  </button>
                  <button type="button" className="danger" onClick={() => void stopStatement(row.pid, true)}>
                    Oturumu kes
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {report.activity.length === 0 && <p className="hint">{t('Başka oturum yok.')}</p>}
      </div>

      <div className="section">
        <h4>{t('En yavaş sorgular')}</h4>
        {report.slowQueries === null ? (
          <pre className="note">{report.slowQueryNote}</pre>
        ) : (
          <table className="file-table">
            <thead>
              <tr><th>Sorgu</th><th>{t('Çağrı')}</th><th>Toplam</th><th>Ortalama</th></tr>
            </thead>
            <tbody>
              {report.slowQueries.map((row) => (
                <tr key={row.query}>
                  <td className="ellipsis" title={row.query}>{row.query}</td>
                  <td>{row.calls.toLocaleString('tr-TR')}</td>
                  <td>{(row.totalMs / 1000).toFixed(1)} sn</td>
                  <td>{row.meanMs.toFixed(1)} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section">
        <h4>{t('Şişkin tablolar')}</h4>
        {report.bloat.length === 0 ? <p className="hint">{t('Kayda değer şişkinlik yok.')}</p> : (
          <table className="file-table">
            <thead><tr><th>Tablo</th><th>{t('Ölü satır')}</th><th>{t('Canlı satır')}</th><th>Oran</th></tr></thead>
            <tbody>
              {report.bloat.map((row) => (
                <tr key={row.table}>
                  <td>{row.table}</td>
                  <td>{row.deadRows.toLocaleString('tr-TR')}</td>
                  <td>{row.liveRows.toLocaleString('tr-TR')}</td>
                  <td className={row.ratio > 0.2 ? 'hot' : ''}>%{(row.ratio * 100).toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section">
        <h4>{t('Hiç kullanılmayan indeksler')}</h4>
        {report.unusedIndexes.length === 0 ? <p className="hint">Yok.</p> : (
          <>
            <table className="file-table">
              <thead><tr><th>Tablo</th><th>{t('İndeks')}</th><th>Boyut</th></tr></thead>
              <tbody>
                {report.unusedIndexes.map((row) => (
                  <tr key={row.index}>
                    <td>{row.table}</td>
                    <td>{row.index}</td>
                    <td>{formatSize(row.sizeBytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="hint">
              {t('Sayaçlar son istatistik sıfırlamasından beri geçerlidir. Yeni eklenmiş bir indeks de burada görünebilir — silmeden önce bunu göz önünde bulundurun.')}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
