import { useState } from 'react'
import type { Profile } from '@shared/types/profile.js'
import { useProfileStore } from '../../stores/profiles.js'
import { useConnectionStore } from '../../stores/connection.js'
import { ProfileForm } from './ProfileForm.js'
import { useSettingsStore } from '../../stores/settings.js'

const STATE_LABEL: Record<string, string> = {
  disconnected: 'Bağlı değil',
  connecting: 'Bağlanıyor…',
  connected: 'Bağlı',
  reconnecting: 'Yeniden bağlanıyor…',
  error: 'Hata',
}

export function ProfileList(): React.JSX.Element {
  const { profiles, remove } = useProfileStore()
  const { byProfile, activeProfileId, connect, disconnect, setActive } = useConnectionStore()
  const [editing, setEditing] = useState<Profile | null>(null)
  const [creating, setCreating] = useState(false)
  const openSettings = useSettingsStore((s) => s.setOpen)

  if (creating || editing) {
    return (
      <ProfileForm
        editing={editing}
        onDone={() => {
          setCreating(false)
          setEditing(null)
        }}
      />
    )
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__head">
        <h1>Köprü</h1>
        <button type="button" title="Ayarlar" onClick={() => { openSettings(true) }}>⚙</button>
        <button
          type="button"
          onClick={() => {
            setCreating(true)
          }}
        >
          + Sunucu
        </button>
      </div>

      {profiles.length === 0 && <p className="hint">Henüz sunucu eklenmedi.</p>}

      <ul className="profile-list">
        {profiles.map((profile) => {
          const snapshot = byProfile[profile.id]
          const state = snapshot?.state ?? 'disconnected'
          return (
            <li
              key={profile.id}
              className={`profile ${profile.id === activeProfileId ? 'profile--active' : ''}`}
              onClick={() => {
                setActive(profile.id)
              }}
            >
              <div className="profile__row">
                <span className={`dot dot--${state}`} />
                <strong>{profile.name}</strong>
              </div>
              <span className="profile__meta">
                {profile.username}@{profile.host}:{profile.port}
              </span>
              <span className={`profile__state profile__state--${state}`}>
                {STATE_LABEL[state] ?? state}
                {snapshot?.attempt ? ` (${String(snapshot.attempt)}. deneme)` : ''}
              </span>
              {snapshot?.message !== undefined && (
                <span className="profile__message">{snapshot.message}</span>
              )}

              <div className="profile__actions">
                {state === 'connected' || state === 'reconnecting' ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      void disconnect(profile.id)
                    }}
                  >
                    Kes
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      void connect(profile.id)
                    }}
                  >
                    Bağlan
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditing(profile)
                  }}
                >
                  Düzenle
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (
                      window.confirm(
                        `“${profile.name}” profilini silmek istediğinize emin misiniz?`,
                      )
                    ) {
                      void remove(profile.id)
                    }
                  }}
                >
                  Sil
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
