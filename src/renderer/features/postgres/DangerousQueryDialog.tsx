import type { DangerAssessment, DangerKind } from '@shared/types/postgres.js'
import { useT } from '../../stores/dil.js'

interface Props {
  assessment: DangerAssessment
  sql: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * User-facing warning copy. Each line names what is about to happen in plain
 * language, because "bu sorgu tehlikeli" tells the person clicking nothing they
 * can act on.
 */
const KIND_LABEL: Record<DangerKind, string> = {
  drop: 'Nesne siliniyor — yapı ve içindeki tüm veri gider.',
  truncate: 'Tablo boşaltılıyor — geri alınamaz, tetikleyiciler çalışmaz.',
  'unfiltered-delete': 'Koşulsuz silme — tablodaki TÜM satırlar gider.',
  'unfiltered-update': 'Koşulsuz güncelleme — tablodaki TÜM satırlar değişir.',
  alter: 'Yapı değişikliği — kolon türü veya kısıtlar değişebilir.',
}

export function DangerousQueryDialog({
  assessment,
  sql,
  onConfirm,
  onCancel,
}: Props): React.JSX.Element {
  const t = useT()
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal modal--danger"
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <h3>{t('Bu sorgu veri kaybettirebilir')}</h3>

        {assessment.kinds.length === 0 ? (
          <p className="error">
            {t('Sorgu incelenemedi. Ne yapacağı doğrulanamadığı için onayınız isteniyor.')}
          </p>
        ) : (
          <ul className="danger-list">
            {assessment.kinds.map((kind) => (
              <li key={kind}>{t(KIND_LABEL[kind])}</li>
            ))}
          </ul>
        )}

        <p className="prune-size">
          {t('Etkilenecek satır:')}{' '}
          <strong>
            {assessment.estimatedRows === null
              ? t('bilinmiyor')
              : `~${assessment.estimatedRows.toLocaleString()}`}
          </strong>
          {assessment.estimatedRows !== null && (
            <em className="hint"> {t('(planlayıcı tahmini, kesin sayı değil)')}</em>
          )}
        </p>

        <pre className="danger-sql">{sql}</pre>

        <div className="row">
          <button type="button" className="danger" onClick={onConfirm}>
            {t('Anladım, çalıştır')}
          </button>
          <button type="button" onClick={onCancel}>
            {t('Vazgeç')}
          </button>
        </div>
      </div>
    </div>
  )
}
