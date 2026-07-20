import { useState } from 'react'
import type { AuthType, Profile, ProfileInput } from '@shared/types/profile.js'
import { useProfileStore } from '../../stores/profiles.js'

interface Props {
  editing: Profile | null
  onDone: () => void
}

export function ProfileForm({ editing, onDone }: Props): React.JSX.Element {
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
      }
      if (editing) input.id = editing.id
      if (authType === 'key' && privateKeyPath.trim()) input.privateKeyPath = privateKeyPath.trim()
      // Empty means "don't touch what's stored"; the user clears a secret by
      // switching auth type, not by blanking a field they never opened.
      if (authType === 'password' && password) input.password = password
      if (authType === 'key' && passphrase) input.passphrase = passphrase

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
      <h2>{editing ? 'Sunucuyu düzenle' : 'Yeni sunucu'}</h2>

      <label>
        Ad
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
          }}
          required
          placeholder="Üretim sunucusu"
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
        Kullanıcı adı
        <input
          value={username}
          onChange={(e) => {
            setUsername(e.target.value)
          }}
          required
        />
      </label>

      <label>
        Kimlik doğrulama
        <select
          value={authType}
          onChange={(e) => {
            setAuthType(e.target.value as AuthType)
          }}
        >
          <option value="key">Anahtar dosyası</option>
          <option value="password">Parola</option>
          <option value="agent">ssh-agent</option>
        </select>
      </label>

      {authType === 'key' && (
        <>
          <label>
            Anahtar dosyası yolu
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
            Anahtar parolası{' '}
            {editing?.hasPassphrase && <em>(kayıtlı — boş bırakırsanız korunur)</em>}
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
          Parola {editing?.hasPassword && <em>(kayıtlı — boş bırakırsanız korunur)</em>}
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
        Uygulama açılınca otomatik bağlan
      </label>

      {error !== null && <p className="error">{error}</p>}

      <div className="row">
        <button type="submit" disabled={busy}>
          {busy ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        <button type="button" onClick={onDone}>
          Vazgeç
        </button>
      </div>
    </form>
  )
}
