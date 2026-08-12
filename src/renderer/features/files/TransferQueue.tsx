import { useTransferStore } from '../../stores/transfers.js'
import { formatSize } from './format.js'
import { useT } from '../../stores/dil.js'

const STATE_LABEL: Record<string, string> = {
  queued: 'Sırada', running: 'Aktarılıyor', done: 'Bitti',
  error: 'Hata', cancelled: 'İptal edildi',
}

export function TransferQueue(): React.JSX.Element | null {
  const t = useT()
  const { items, open, setOpen, cancel, clearFinished } = useTransferStore()
  if (items.length === 0) return null

  const active = items.filter((t) => t.state === 'running' || t.state === 'queued').length

  return (
    <div className={`transfers ${open ? 'transfers--open' : ''}`}>
      <button type="button" className="transfers__toggle" onClick={() => { setOpen(!open) }}>
        {t('Aktarımlar')} {active > 0 ? t('({n} etkin)', { n: active }) : `(${String(items.length)})`}
        <span>{open ? '▾' : '▴'}</span>
      </button>

      {open && (
        <div className="transfers__body">
          {items.map((transfer) => {
            const percent = transfer.bytesTotal > 0
              ? Math.round((transfer.bytesDone / transfer.bytesTotal) * 100)
              : 0
            return (
              <div key={transfer.id} className="transfer">
                <div className="transfer__head">
                  <span>{transfer.direction === 'upload' ? '↑' : '↓'} {transfer.name}</span>
                  <span className={`transfer__state transfer__state--${transfer.state}`}>
                    {t(STATE_LABEL[transfer.state] ?? transfer.state)}
                  </span>
                </div>
                {transfer.state === 'running' && (
                  <>
                    <div className="progress"><div style={{ width: `${String(percent)}%` }} /></div>
                    <span className="transfer__meta">
                      {formatSize(transfer.bytesDone)} / {formatSize(transfer.bytesTotal)}
                    </span>
                  </>
                )}
                {transfer.error !== undefined && <span className="error">{transfer.error}</span>}
                {(transfer.state === 'running' || transfer.state === 'queued') && (
                  <button type="button" onClick={() => void cancel(transfer.id)}>{t('İptal')}</button>
                )}
              </div>
            )
          })}
          <button type="button" onClick={() => void clearFinished()}>Bitenleri temizle</button>
        </div>
      )}
    </div>
  )
}
