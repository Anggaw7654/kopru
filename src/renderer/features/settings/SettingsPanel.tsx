import { useSettingsStore } from '../../stores/settings.js'
import type { ThemeChoice } from '../../stores/settings.js'
import { useDilStore, useT } from '../../stores/dil.js'
import { DILLER } from '@shared/i18n.js'

/** Etiketler sözlük anahtarıdır; metin `t()` ile çözülür. */
const TEMALAR: { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: 'Sisteme uy' },
  { value: 'dark', label: 'Koyu' },
  { value: 'light', label: 'Açık' },
]

/** Dil adları KENDİ dillerinde yazılır — bir kullanıcı anlamadığı bir
 *  arayüzde kendi dilini ararken 'Turkish' değil 'Türkçe' arar. */
const DIL_ADI: Record<string, string> = { tr: 'Türkçe', en: 'English' }

export function SettingsPanel(): React.JSX.Element {
  const { theme, setTheme, terminalFontSize, setTerminalFontSize, setOpen } = useSettingsStore()
  const { dil, ayarla: dilAyarla } = useDilStore()
  const t = useT()

  return (
    <div className="modal-backdrop" onClick={() => { setOpen(false) }}>
      <div className="modal modal--wide" onClick={(e) => { e.stopPropagation() }}>
        <h3>{t('Ayarlar')}</h3>

        <h4>{t('Dil')}</h4>
        <div className="row">
          {DILLER.map((secenek) => (
            <button
              key={secenek}
              type="button"
              className={dil === secenek ? 'view-switch--active' : ''}
              onClick={() => { dilAyarla(secenek) }}
            >
              {DIL_ADI[secenek]}
            </button>
          ))}
        </div>
        <p className="hint">{t('Ana süreçteki pencereler de bu dili kullanır.')}</p>

        <h4>{t('Görünüm')}</h4>
        <div className="row">
          {TEMALAR.map((option) => (
            <button
              key={option.value}
              type="button"
              className={theme === option.value ? 'view-switch--active' : ''}
              onClick={() => { setTheme(option.value) }}
            >
              {t(option.label)}
            </button>
          ))}
        </div>

        <h4>Terminal</h4>
        <label>
          {t('Yazı boyutu')}
          <input
            type="number"
            min={9}
            max={24}
            value={String(terminalFontSize)}
            onChange={(e) => {
              setTerminalFontSize(Math.min(24, Math.max(9, Number(e.target.value) || 13)))
            }}
          />
        </label>
        <p className="hint">{t('Yeni açılan terminal sekmelerinde geçerli olur.')}</p>

        <h4>{t('Pencere')}</h4>
        <button type="button" onClick={() => void window.kopru.invoke('window:new')}>
          {t('Yeni pencere aç')}
        </button>
        <p className="hint">
          {t('Oturumlar ana süreçte yaşadığı için ikinci pencere aynı bağlantıları görür. Birini kapatmak oturumları sonlandırmaz.')}
        </p>

        <h4>{t('Sunucuya özel ayarlar')}</h4>
        <p className="hint">
          {t('İzleme aralığı, eşikler ve izlenen servisler her sunucu için ayrıdır — İzleme sekmesindeki Ayarlar düğmesinden değiştirin. PostgreSQL bağlantısı ise profil düzenleme ekranındadır.')}
        </p>

        <div className="row">
          <button type="button" onClick={() => { setOpen(false) }}>{t('Kapat')}</button>
        </div>
      </div>
    </div>
  )
}
