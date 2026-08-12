import { useState } from 'react'
import type { AuthType, Profile, ProfileInput } from '@shared/types/profile.js'
import type { PostgresConfig } from '@shared/types/postgres.js'
import { DEFAULT_POSTGRES } from '@shared/types/postgres.js'
import { useProfileStore } from '../../stores/profiles.js'
import { useT } from '../../stores/dil.js'

interface Props {
  editing: Profile | null
  onDone: () => void
}

export function ProfileForm({ editing, onDone }: Props): React.JSX.Element {
  const t = useT()
  const save = useProfileStore((s) => s.save)
  const [name, setName] = useState(editing?.name ?? '')
  const [host, setHost] = useState(editing?.host ?? '')
  const [port, setPort] = useState(String(editing?.port ?? 22))
  const [username, setUsername] = useState(editing?.username ?? '')
  const [authType, setAuthType] = useState<AuthType>(editing?.authType ?? 'key')
  const [privateKeyPath, setPrivateKeyPath] = useState(editing?.privateKeyPath ?? '')
  const [password, setPassword] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [autoConnect, setAutoConnect] = useState(editing?.autoConnect ?? false)
  const [pg, setPg] = useState<PostgresConfig>(editing?.postgres ?? DEFAULT_POSTGRES)
  const [pgPassword, setPgPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: React.SyntheticEvent): Promise<void> => {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const input: ProfileInput = {
        name: name.trim(),
        host: host.trim(),
        port: Number(port),
        username: username.trim(),
        authType,
        autoConnect,
        postgres: pg,
      }
      if (editing) input.id = editing.id
      if (authType === 'key' && privateKeyPath.trim()) input.privateKeyPath = privateKeyPath.trim()
      // Empty means "don't touch what's stored"; the user clears a secret by
      // switching auth type, not by blanking a field they never opened.
      if (authType === 'password' && password) input.password = password
      if (authType === 'key' && passphrase) input.passphrase = passphrase
      if (pg.enabled && pgPassword) input.postgresPassword = pgPassword

      await save(input)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="profile-form" onSubmit={(e) => void submit(e)}>
      <h2>{editing ? t('Sunucuyu düzenle') : t('Yeni sunucu')}</h2>

      <label>
        {t('Ad')}
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
          }}
          required
          placeholder={t('Üretim sunucusu')}
        />
      </label>

      <div className="row">
        <label className="grow">
          Adres
          <input
            value={host}
            onChange={(e) => {
              setHost(e.target.value)
            }}
            required
            placeholder="ornek.sunucu.com"
          />
        </label>
        <label className="port">
          Port
          <input
            value={port}
            onChange={(e) => {
              setPort(e.target.value)
            }}
            required
            inputMode="numeric"
          />
        </label>
      </div>

      <label>
        {t('Kullanıcı adı')}
        <input
          value={username}
          onChange={(e) => {
            setUsername(e.target.value)
          }}
          required
        />
      </label>

      <label>
        {t('Kimlik doğrulama')}
        <select
          value={authType}
          onChange={(e) => {
            setAuthType(e.target.value as AuthType)
          }}
        >
          <option value="key">{t('Anahtar dosyası')}</option>
          <option value="password">Parola</option>
          <option value="agent">ssh-agent</option>
        </select>
      </label>

      {authType === 'key' && (
        <>
          <label>
            {t('Anahtar dosyası yolu')}
            <input
              value={privateKeyPath}
              onChange={(e) => {
                setPrivateKeyPath(e.target.value)
              }}
              placeholder="/Users/siz/.ssh/id_ed25519"
              required
            />
          </label>
          <label>
            {t('Anahtar parolası')}{' '}
            {editing?.hasPassphrase && <em>{t('(kayıtlı — boş bırakırsanız korunur)')}</em>}
            <input
              type="password"
              value={passphrase}
              onChange={(e) => {
                setPassphrase(e.target.value)
              }}
            />
          </label>
        </>
      )}

      {authType === 'password' && (
        <label>
          Parola {editing?.hasPassword && <em>{t('(kayıtlı — boş bırakırsanız korunur)')}</em>}
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
            }}
          />
        </label>
      )}

      <label className="checkbox">
        <input
          type="checkbox"
          checked={autoConnect}
          onChange={(e) => {
            setAutoConnect(e.target.checked)
          }}
        />
        {t('Uygulama açılınca otomatik bağlan')}
      </label>

      <h4>PostgreSQL</h4>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={pg.enabled}
          onChange={(e) => { setPg({ ...pg, enabled: e.target.checked }) }}
        />
        {t('Bu sunucuda PostgreSQL paneli açık')}
      </label>

      {pg.enabled && (
        <>
          <p className="hint">
            {t('Adres sunucunun kendi bakışıyla girilir. Tünel SSH üzerinden kurulur; bilgisayarınızda hiçbir port açılmaz.')}
          </p>
          <div className="row">
            <label className="grow">
              Adres
              <input value={pg.host} onChange={(e) => { setPg({ ...pg, host: e.target.value }) }} />
            </label>
            <label className="port">
              Port
              <input value={String(pg.port)} inputMode="numeric"
                onChange={(e) => { setPg({ ...pg, port: Number(e.target.value) || 5432 }) }} />
            </label>
          </div>
          <label>
            {t('Veritabanı')}
            <input value={pg.database} onChange={(e) => { setPg({ ...pg, database: e.target.value }) }} />
          </label>
          <label>
            {t('Kullanıcı')}
            <input value={pg.user} onChange={(e) => { setPg({ ...pg, user: e.target.value }) }} />
          </label>
          <label>
            Parola {editing?.postgres.hasPassword === true && <em>{t('(kayıtlı — boş bırakırsanız korunur)')}</em>}
            <input type="password" value={pgPassword}
              onChange={(e) => { setPgPassword(e.target.value) }} />
          </label>
          <label>
            {t('Sorgu zaman aşımı (saniye)')}
            <input type="number" min={5} value={String(pg.statementTimeoutMs / 1000)}
              onChange={(e) => {
                setPg({ ...pg, statementTimeoutMs: Math.max(5, Number(e.target.value)) * 1000 })
              }} />
          </label>
        </>
      )}

      {error !== null && <p className="error">{error}</p>}

      <div className="row">
        <button type="submit" disabled={busy}>
          {busy ? t('Kaydediliyor…') : t('Kaydet')}
        </button>
        <button type="button" onClick={onDone}>
          {t('Vazgeç')}
        </button>
      </div>
    </form>
  )
}
