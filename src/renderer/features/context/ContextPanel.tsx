import { useState } from 'react'
import type { SystemSummary } from '@shared/types/context.js'
import { useContextStore } from '../../stores/context.js'
import { formatForClipboard } from './format.js'
import { useT } from '../../stores/dil.js'

interface Props {
  profileId: string | null
}

const KIND_ICON: Record<string, string> = {
  file: '📄', log: '📋', sql: '🗄', terminal: '⌨', system: '🖥', note: '✎',
}

export function ContextPanel({ profileId }: Props): React.JSX.Element | null {
  const t = useT()
  const { items, open, setOpen, remove, clear } = useContextStore()
  const [question, setQuestion] = useState('')
  const [includeSystem, setIncludeSystem] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  if (!open && items.length === 0) return null

  const totalRedactions = items.reduce(
    (sum, item) => sum + item.redactions.reduce((n, entry) => n + entry.count, 0),
    0,
  )

  const copy = async (): Promise<void> => {
    setStatus(null)
    let summary: SystemSummary | null = null

    if (includeSystem && profileId !== null) {
      try {
        summary = await window.kopru.invoke('context:system-summary', { profileId })
      } catch {
        // A missing summary is not worth blocking the copy the user asked for.
        summary = null
      }
    }

    const text = formatForClipboard(items, summary, question)
    try {
      await navigator.clipboard.writeText(text)
      setStatus(t('Kopyalandı — {n} karakter. Claude’a yapıştırabilirsiniz.', { n: text.length }))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t('Panoya kopyalanamadı.'))
    }
  }

  return (
    <div className={`ctx ${open ? 'ctx--open' : ''}`}>
      <button type="button" className="ctx__toggle" onClick={() => { setOpen(!open) }}>
        {t('Claude bağlamı ({n})', { n: items.length })}
        {totalRedactions > 0 && <em className="ctx__redacted">{t('{n} gizlendi', { n: totalRedactions })}</em>}
        <span>{open ? '▾' : '▴'}</span>
      </button>

      {open && (
        <div className="ctx__body">
          {items.length === 0 && (
            <p className="hint">
              {t('Dosya, log, SQL veya terminal çıktısında')} <strong>{t('“Claude’a gönder”')}</strong>
              {t('deyin; buraya birikir. Hazır olunca kopyalayıp kendi Claude’unuza yapıştırın.')}
            </p>
          )}

          {items.map((item) => (
            <div key={item.id} className="ctx__item">
              <div className="ctx__head">
                <button
                  type="button"
                  className="ctx__label"
                  onClick={() => { setExpanded(expanded === item.id ? null : item.id) }}
                >
                  {KIND_ICON[item.kind] ?? '•'} {item.label}
                  <em>{t('{n} kr', { n: item.content.length })}</em>
                </button>
                <button type="button" onClick={() => { remove(item.id) }}>✕</button>
              </div>

              {item.redactions.length > 0 && (
                <p className="ctx__warn">
                  {t('Çıkarıldı:')}{' '}
                  {item.redactions.map((r) => `${t(r.kind)} ×${String(r.count)}`).join(', ')}
                </p>
              )}

              {expanded === item.id && <pre className="ctx__preview">{item.content}</pre>}
            </div>
          ))}

          <textarea
            className="ctx__question"
            placeholder={t('Sorunuz (isteğe bağlı) — örn. “disk neden doluyor?”')}
            value={question}
            rows={2}
            onChange={(e) => { setQuestion(e.target.value) }}
          />

          <label className="checkbox">
            <input
              type="checkbox"
              checked={includeSystem}
              onChange={(e) => { setIncludeSystem(e.target.checked) }}
              disabled={profileId === null}
            />
            {t('Sunucu özetini de ekle (sistem, çalışma süresi, ölçümler — kimlik bilgisi yok)')}
          </label>

          <div className="row">
            <button type="button" onClick={() => void copy()} disabled={items.length === 0}>
              {t('Panoya kopyala')}
            </button>
            <button type="button" onClick={clear} disabled={items.length === 0}>{t('Temizle')}</button>
          </div>

          {status !== null && <p className="hint">{status}</p>}
        </div>
      )}
    </div>
  )
}
