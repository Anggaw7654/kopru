import { useSettingsStore } from '../../stores/settings.js'
import type { ThemeChoice } from '../../stores/settings.js'

const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: 'Sisteme uy' },
  { value: 'dark', label: 'Koyu' },
  { value: 'light', label: 'Açık' },
]

export function SettingsPanel(): React.JSX.Element {
  const { theme, setTheme, terminalFontSize, setTerminalFontSize, setOpen } = useSettingsStore()

  return (
    <div className="modal-backdrop" onClick={() => { setOpen(false) }}>
      <div className="modal modal--wide" onClick={(e) => { e.stopPropagation() }}>
        <h3>Ayarlar</h3>

        <h4>Görünüm</h4>
        <div className="row">
          {THEMES.map((option) => (
            <button
              key={option.value}
              type="button"
              className={theme === option.value ? 'view-switch--active' : ''}
              onClick={() => { setTheme(option.value) }}
            >
              {option.label}
            </button>
          ))}
        </div>

        <h4>Terminal</h4>
        <label>
          Yazı boyutu
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
        <p className="hint">Yeni açılan terminal sekmelerinde geçerli olur.</p>

        <h4>Pencere</h4>
        <button type="button" onClick={() => void window.kopru.invoke('window:new')}>
          Yeni pencere aç
        </button>
        <p className="hint">
          Oturumlar ana süreçte yaşadığı için ikinci pencere aynı bağlantıları görür.
          Birini kapatmak oturumları sonlandırmaz.
        </p>

        <h4>Sunucuya özel ayarlar</h4>
        <p className="hint">
          İzleme aralığı, eşikler ve izlenen servisler her sunucu için ayrıdır —
          İzleme sekmesindeki <strong>Ayarlar</strong> düğmesinden değiştirin.
          PostgreSQL bağlantısı ise profil düzenleme ekranındadır.
        </p>

        <div className="row">
          <button type="button" onClick={() => { setOpen(false) }}>Kapat</button>
        </div>
      </div>
    </div>
  )
}
