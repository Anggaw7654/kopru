import { useEffect } from 'react'
import type { Shortcut } from '@shared/types/files.js'
import { useProfileStore } from '../../stores/profiles.js'
import { usePrompt } from '../../components/PromptDialog.js'
import { useT } from '../../stores/dil.js'

interface Props {
  profileId: string
  shortcuts: Shortcut[]
  currentPath: string
  onNavigate: (path: string) => void
}

/** ⌘1–⌘9 jump to the first nine; beyond that the number would not fit a key. */
const HOTKEY_LIMIT = 9

function newId(): string {
  return crypto.randomUUID()
}

export function ShortcutList({
  profileId, shortcuts, currentPath, onNavigate,
}: Props): React.JSX.Element {
  const t = useT()
  const reloadProfiles = useProfileStore((s) => s.load)
  const [ask, promptDialog] = usePrompt()

  /**
   * Written through main and re-read from the profile store — the list is never
   * mirrored in component state, so there is one source of truth and a failed
   * write cannot leave the UI showing a shortcut that was not saved.
   */
  const persist = (next: Shortcut[]): void => {
    window.kopru
      .invoke('fs:set-shortcuts', { profileId, shortcuts: next })
      .then(() => reloadProfiles())
      .catch((error: unknown) => {
        window.alert(error instanceof Error ? error.message : String(error))
      })
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!event.metaKey || event.shiftKey || event.altKey) return
      const index = Number(event.key) - 1
      if (Number.isNaN(index) || index < 0 || index >= HOTKEY_LIMIT) return
      const target = shortcuts[index]
      if (!target) return
      event.preventDefault()
      onNavigate(target.path)
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey) }
  }, [shortcuts, onNavigate])

  const add = (): void => {
    if (currentPath === '') return
    if (shortcuts.some((s) => s.path === currentPath)) {
      window.alert(t('Bu klasör zaten kısayollarda.'))
      return
    }
    const suggested = currentPath.split('/').filter(Boolean).at(-1) ?? currentPath
    void ask({
      title: t('Kısayol adı'),
      detail: currentPath,
      defaultValue: suggested,
      confirmLabel: 'Ekle',
    }).then((label) => {
      if (label === null) return
      persist([...shortcuts, { id: newId(), label, path: currentPath }])
    })
  }

  const rename = (shortcut: Shortcut): void => {
    void ask({
      title: 'Yeni ad',
      detail: shortcut.path,
      defaultValue: shortcut.label,
    }).then((label) => {
      if (label === null) return
      persist(shortcuts.map((s) => (s.id === shortcut.id ? { ...s, label } : s)))
    })
  }

  const move = (index: number, delta: number): void => {
    const target = index + delta
    if (target < 0 || target >= shortcuts.length) return
    const next = [...shortcuts]
    const [moved] = next.splice(index, 1)
    if (moved) next.splice(target, 0, moved)
    persist(next)
  }

  return (
    <>
      {promptDialog}
      <h4 className="side-head">
        {t('Kısayollar')}
        <button type="button" onClick={add} title={t('Bu klasörü ekle: {yol}', { yol: currentPath })}>+</button>
      </h4>

      {shortcuts.length === 0 && (
        <p className="hint">
          {t('Bir proje klasörüne gidip')} <strong>+</strong> {t('deyin; bir daha aramanız gerekmez.')}
        </p>
      )}

      {shortcuts.map((shortcut, index) => (
        <div
          key={shortcut.id}
          className={`shortcut ${shortcut.path === currentPath ? 'shortcut--active' : ''}`}
        >
          <button
            type="button"
            className="shortcut__go"
            onClick={() => { onNavigate(shortcut.path) }}
            title={shortcut.path}
          >
            {index < HOTKEY_LIMIT && <kbd>⌘{String(index + 1)}</kbd>}
            <span>{shortcut.label}</span>
          </button>

          <div className="shortcut__tools">
            <button type="button" title={t('Yukarı taşı')} onClick={() => { move(index, -1) }}>↑</button>
            <button type="button" title={t('Aşağı taşı')} onClick={() => { move(index, 1) }}>↓</button>
            <button type="button" title={t('Yeniden adlandır')} onClick={() => { rename(shortcut) }}>✎</button>
            <button
              type="button"
              title={t('Kısayolu kaldır')}
              onClick={() => {
                // Only the bookmark goes; say so, because "sil" next to a folder
                // name reads like it deletes the folder.
                if (!window.confirm(t('“{ad}” kısayolu kaldırılacak.\n\nKlasörün kendisi silinmez.', { ad: shortcut.label }))) return
                persist(shortcuts.filter((s) => s.id !== shortcut.id))
              }}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </>
  )
}
