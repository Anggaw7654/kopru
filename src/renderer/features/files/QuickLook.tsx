import { useEffect, useState } from 'react'
import type { DirEntry, PreviewResult } from '@shared/types/files.js'
import { formatSize } from './format.js'
import { useT } from '../../stores/dil.js'

interface Props {
  profileId: string
  entry: DirEntry
  onClose: () => void
}

/** Mounted with a `key` of the file path, so a new file gets fresh state
 *  instead of the previous file's content flashing while the next loads. */
export function QuickLook({ profileId, entry, onClose }: Props): React.JSX.Element {
  const t = useT()
  const [result, setResult] = useState<PreviewResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    window.kopru
      .invoke('fs:preview', { profileId, path: entry.path })
      .then((value) => {
        if (!cancelled) setResult(value)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [profileId, entry.path])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' || event.key === ' ') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="quicklook" onClick={(e) => { e.stopPropagation() }}>
        <header>
          <strong>{entry.name}</strong>
          <span>{formatSize(entry.size)}</span>
        </header>

        <div className="quicklook__body">
          {error !== null && <p className="error">{error}</p>}
          {error === null && result === null && <p className="hint">{t('Yükleniyor…')}</p>}

          {result?.kind === 'text' && <pre>{result.content}</pre>}

          {result?.kind === 'log' && (
            <>
              <p className="hint">
                {result.truncatedBytes
                  ? t('Dosyanın son 256 KB’ı gösteriliyor.')
                  : t('Son {n} satır gösteriliyor.', { n: result.lineCount })}
              </p>
              <pre>{result.content}</pre>
            </>
          )}

          {result?.kind === 'image' && <img src={result.dataUrl} alt={entry.name} />}
          {result?.kind === 'binary' && (
            <p className="hint">{t('İkili dosya, önizlenemiyor ({boyut}).', { boyut: formatSize(result.size) })}</p>
          )}
          {result?.kind === 'too-large' && (
            <p className="hint">{t('Önizleme için çok büyük ({boyut}).', { boyut: formatSize(result.size) })}</p>
          )}
          {result?.kind === 'directory' && (
            <p className="hint">{t('Klasör — {n} öğe.', { n: result.entryCount })}</p>
          )}
        </div>
      </div>
    </div>
  )
}
