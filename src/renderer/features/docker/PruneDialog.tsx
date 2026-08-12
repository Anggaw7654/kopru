import { useEffect, useState } from 'react'
import type { PrunePreview, PruneTarget } from '@shared/types/docker.js'
import { formatSize } from '../files/format.js'
import { useT } from '../../stores/dil.js'

interface Props {
  profileId: string
  target: PruneTarget
  onDone: (reclaimedBytes: number) => void
  onClose: () => void
}

const LABEL: Record<PruneTarget, string> = {
  image: 'Kullanılmayan görüntüler',
  container: 'Durmuş konteynerler',
  volume: 'Bağlı olmayan volume’ler',
  network: 'Kullanılmayan ağlar',
  buildcache: 'Derleme önbelleği',
}

export function PruneDialog({ profileId, target, onDone, onClose }: Props): React.JSX.Element {
  const t = useT()
  const [preview, setPreview] = useState<PrunePreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    window.kopru
      .invoke('docker:prune-preview', { profileId, target })
      .then(setPreview)
      .catch((err: unknown) => { setError(err instanceof Error ? err.message : String(err)) })
  }, [profileId, target])

  const confirm = async (): Promise<void> => {
    setBusy(true)
    try {
      const result = await window.kopru.invoke('docker:prune', { profileId, target })
      onDone(result.reclaimedBytes)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  const isVolume = target === 'volume'

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--danger" onClick={(e) => { e.stopPropagation() }}>
        <h3>{t('{tur} silinecek', { tur: t(LABEL[target]) })}</h3>

        {error !== null && <p className="error">{error}</p>}
        {preview === null && error === null && <p className="hint">{t('Hesaplanıyor…')}</p>}

        {preview && (
          <>
            <p className="prune-size">
              {t('Geri kazanılacak alan:')} <strong>{formatSize(preview.reclaimableBytes)}</strong>
            </p>

            {isVolume && preview.items.length > 0 && (
              <p className="error">
                Volume’ler veri tutar. Aşağıdakiler bir konteynere bağlı değil, ama
                içlerinde veritabanı ya da yüklenmiş dosyalar olabilir. Bu işlem
                <strong> {t('geri alınamaz')}</strong>.
              </p>
            )}

            {preview.items.length === 0 ? (
              <p className="hint">{t('Silinecek bir şey yok.')}</p>
            ) : (
              <>
                <p className="hint">{String(preview.items.length)} öğe silinecek:</p>
                <ul className="prune-list">
                  {preview.items.slice(0, 50).map((item) => <li key={item}>{item}</li>)}
                  {preview.items.length > 50 && (
                    <li className="hint">…ve {String(preview.items.length - 50)} tane daha</li>
                  )}
                </ul>
              </>
            )}
          </>
        )}

        <div className="row">
          <button
            type="button"
            className="danger"
            disabled={busy || preview === null || preview.items.length === 0}
            onClick={() => void confirm()}
          >
            {busy ? 'Siliniyor…' : 'Kalıcı olarak sil'}
          </button>
          <button type="button" onClick={onClose}>{t('Vazgeç')}</button>
        </div>
      </div>
    </div>
  )
}
