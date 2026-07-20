import { useCallback, useEffect, useRef, useState } from 'react'
import type { DirEntry, OpenFileResult } from '@shared/types/files.js'
import type { Profile } from '@shared/types/profile.js'
import { useFileStore } from '../../stores/files.js'
import { useTransferStore } from '../../stores/transfers.js'
import { useTerminalStore } from '../../stores/terminal.js'
import { Breadcrumb } from './Breadcrumb.js'
import { QuickLook } from './QuickLook.js'
import { PermissionsDialog } from './PermissionsDialog.js'
import { MonacoEditor } from './MonacoEditor.js'
import { TransferQueue } from './TransferQueue.js'
import { ShortcutList } from './ShortcutList.js'
import { useContextStore } from '../../stores/context.js'
import { formatDateTime, formatMode, formatSize } from './format.js'

interface Props {
  profile: Profile
}

interface MenuState {
  x: number
  y: number
  entry: DirEntry
}

function parentOf(path: string): string {
  if (path === '/') return '/'
  const trimmed = path.replace(/\/+$/, '')
  const index = trimmed.lastIndexOf('/')
  return index <= 0 ? '/' : trimmed.slice(0, index)
}

export function FileBrowser({ profile }: Props): React.JSX.Element {
  const profileId = profile.id
  const store = useFileStore()
  const { path, entries, selected, loading, error, showHidden, recents } = store
  const setTransfersOpen = useTransferStore((s) => s.setOpen)
  const addTerminalTab = useTerminalStore((s) => s.add)
  const addContext = useContextStore((s) => s.add)

  const [menu, setMenu] = useState<MenuState | null>(null)
  const [quickLook, setQuickLook] = useState<DirEntry | null>(null)
  const [permissions, setPermissions] = useState<DirEntry | null>(null)
  const [editing, setEditing] = useState<OpenFileResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  // Land in the user's home rather than / — that is where their work is.
  useEffect(() => {
    let cancelled = false
    // Blank the previous server's listing immediately: showing its files under
    // the new server's name for the duration of a round-trip is a lie the user
    // could act on.
    useFileStore.setState({ entries: [], path: '', selected: [], error: null, loading: true })
    void window.kopru
      .invoke('fs:home', { profileId })
      .then(({ path: home }) => {
        if (!cancelled) void store.navigate(profileId, home)
      })
      .catch(() => {
        if (!cancelled) void store.navigate(profileId, '/')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId])

  const fail = (err: unknown): void => {
    window.alert(err instanceof Error ? err.message : String(err))
  }

  const refresh = useCallback((): void => {
    void store.refresh(profileId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId])

  const activate = (entry: DirEntry): void => {
    if (entry.kind === 'directory') {
      void store.navigate(profileId, entry.path)
      return
    }
    window.kopru
      .invoke('fs:open', { profileId, path: entry.path })
      .then(setEditing)
      .catch(fail)
  }

  // Spacebar quick look, like Finder.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== ' ' || quickLook !== null || editing !== null) return
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return
      const entry = entries.find((e) => e.path === selected[0])
      if (!entry) return
      event.preventDefault()
      setQuickLook(entry)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [entries, selected, quickLook, editing])

  useEffect(() => {
    const close = (): void => {
      setMenu(null)
    }
    window.addEventListener('click', close)
    return () => {
      window.removeEventListener('click', close)
    }
  }, [])

  // Uploads land in the directory being viewed.
  const onDrop = (event: React.DragEvent): void => {
    event.preventDefault()
    setDragOver(false)
    const localPaths: string[] = []
    for (const file of Array.from(event.dataTransfer.files)) {
      // Electron exposes the real path here; a plain browser would not.
      const withPath = window.kopru.pathForFile(file)
      if (withPath) localPaths.push(withPath)
    }
    if (localPaths.length === 0) return
    setTransfersOpen(true)
    window.kopru
      .invoke('transfer:upload', { profileId, localPaths, destinationDir: path })
      .catch(fail)
  }

  const action = {
    download: (entry: DirEntry) => {
      window.kopru.invoke('transfer:download', { profileId, remotePaths: [entry.path] }).catch(fail)
    },
    rename: (entry: DirEntry) => {
      const next = window.prompt('Yeni ad:', entry.name)
      if (next === null || next === entry.name || next.trim() === '') return
      window.kopru
        .invoke('fs:rename', { profileId, from: entry.path, to: `${parentOf(entry.path)}/${next.trim()}`.replace('//', '/') })
        .then(refresh)
        .catch(fail)
    },
    remove: (entry: DirEntry) => {
      const targets = selected.length > 1 && selected.includes(entry.path) ? selected : [entry.path]
      const label = targets.length > 1 ? `${String(targets.length)} öğe` : entry.name
      if (!window.confirm(`${label} kalıcı olarak silinecek. Emin misiniz?\n\nBu işlem geri alınamaz.`)) return
      window.kopru.invoke('fs:delete', { profileId, paths: targets }).then(refresh).catch(fail)
    },
    compress: (entry: DirEntry) => {
      const targets = selected.length > 1 && selected.includes(entry.path) ? selected : [entry.path]
      const suggested = `${entry.name}.tar.gz`
      const name = window.prompt('Arşiv adı:', suggested)
      if (name === null || name.trim() === '') return
      window.kopru
        .invoke('fs:compress', { profileId, sources: targets, archivePath: `${path}/${name.trim()}`.replace('//', '/') })
        .then(refresh)
        .catch(fail)
    },
    extract: (entry: DirEntry) => {
      window.kopru
        .invoke('fs:extract', { profileId, archivePath: entry.path, destinationDir: path })
        .then(refresh)
        .catch(fail)
    },
    sendToClaude: (entry: DirEntry) => {
      if (entry.kind === 'directory') {
        addContext({
          kind: 'file',
          label: entry.path,
          content: entries.map((e) => `${e.kind === 'directory' ? 'd' : '-'} ${e.name}`).join('\n'),
        })
        return
      }
      window.kopru
        .invoke('fs:open', { profileId, path: entry.path })
        .then((file) => {
          addContext({
            kind: 'file',
            label: file.path,
            content: file.content,
            language: file.language,
            // The path drives whole-file redaction: a .env is secret even when
            // none of its lines look like one.
            sourcePath: file.path,
          })
        })
        .catch(fail)
    },
    openTerminal: (entry: DirEntry) => {
      const cwd = entry.kind === 'directory' ? entry.path : parentOf(entry.path)
      window.kopru
        .invoke('terminal:create', { profileId, cols: 80, rows: 24, cwd })
        .then((session) => {
          addTerminalTab({
            sessionId: session.sessionId,
            profileId: session.profileId,
            title: cwd.split('/').pop() || '/',
            restored: false,
          })
        })
        .catch(fail)
    },
  }

  if (editing) {
    return <MonacoEditor profileId={profileId} file={editing} onClose={() => { setEditing(null); refresh() }} />
  }

  return (
    <div className="files">
      <div className="files__toolbar">
        <button type="button" onClick={() => { void store.navigate(profileId, parentOf(path)) }}>↑</button>
        <Breadcrumb path={path} onNavigate={(p) => { void store.navigate(profileId, p) }} />
        <button type="button" onClick={refresh}>Yenile</button>
        <button type="button" onClick={() => { void store.toggleHidden(profileId) }}>
          {showHidden ? 'Gizlileri sakla' : 'Gizlileri göster'}
        </button>
        <button
          type="button"
          onClick={() => {
            const name = window.prompt('Klasör adı:')
            if (name === null || name.trim() === '') return
            window.kopru
              .invoke('fs:mkdir', { profileId, path: `${path}/${name.trim()}`.replace('//', '/') })
              .then(refresh)
              .catch(fail)
          }}
        >
          + Klasör
        </button>

      </div>

      <div className="files__body">
        <aside className="files__side">
          <ShortcutList
            profileId={profileId}
            shortcuts={profile.shortcuts}
            currentPath={path}
            onNavigate={(target) => { void store.navigate(profileId, target) }}
          />

          <h4>Son klasörler</h4>
          {recents.map((recent) => (
            <button key={recent} type="button" className="side-link" onClick={() => { void store.navigate(profileId, recent) }}>
              {recent.split('/').pop() || '/'}
            </button>
          ))}
        </aside>

        <div
          ref={listRef}
          className={`files__list ${dragOver ? 'files__list--drop' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => { setDragOver(false) }}
          onDrop={onDrop}
        >
          {error !== null && <div className="banner banner--error">{error}</div>}
          {loading && <p className="hint">Yükleniyor…</p>}

          <table className="file-table">
            <thead>
              <tr><th>Ad</th><th>Boyut</th><th>Değiştirilme</th><th>İzinler</th></tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.path}
                  className={selected.includes(entry.path) ? 'row--selected' : ''}
                  onClick={(e) => {
                    store.select(e.metaKey || e.shiftKey
                      ? selected.includes(entry.path)
                        ? selected.filter((p) => p !== entry.path)
                        : [...selected, entry.path]
                      : [entry.path])
                  }}
                  onDoubleClick={() => { activate(entry) }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    if (!selected.includes(entry.path)) store.select([entry.path])
                    setMenu({ x: e.clientX, y: e.clientY, entry })
                  }}
                >
                  <td>
                    {entry.kind === 'directory' ? '📁' : entry.kind === 'symlink' ? '🔗' : '📄'} {entry.name}
                  </td>
                  <td>{entry.kind === 'directory' ? '—' : formatSize(entry.size)}</td>
                  <td>{formatDateTime(entry.modified)}</td>
                  <td><code>{formatMode(entry.mode)}</code></td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && entries.length === 0 && <p className="hint">Bu klasör boş.</p>}
        </div>
      </div>

      <TransferQueue />

      {menu && (
        <div className="context-menu" style={{ left: menu.x, top: menu.y }} onClick={(e) => { e.stopPropagation() }}>
          <button type="button" onClick={() => { activate(menu.entry); setMenu(null) }}>Aç</button>
          <button type="button" onClick={() => { setQuickLook(menu.entry); setMenu(null) }}>Önizle</button>
          <button type="button" onClick={() => { action.download(menu.entry); setMenu(null) }}>Mac’e indir</button>
          <hr />
          <button type="button" onClick={() => { action.rename(menu.entry); setMenu(null) }}>Yeniden adlandır</button>
          <button type="button" onClick={() => { setPermissions(menu.entry); setMenu(null) }}>İzinler…</button>
          <button type="button" onClick={() => { action.compress(menu.entry); setMenu(null) }}>Sıkıştır…</button>
          {/\.(zip|tar|tar\.gz|tgz|tar\.bz2|tar\.xz)$/i.test(menu.entry.name) && (
            <button type="button" onClick={() => { action.extract(menu.entry); setMenu(null) }}>Buraya çıkart</button>
          )}
          <button type="button" onClick={() => { action.openTerminal(menu.entry); setMenu(null) }}>Terminalde aç</button>
          <button type="button" onClick={() => { action.sendToClaude(menu.entry); setMenu(null) }}>
            Claude’a gönder
          </button>
          <hr />
          <button type="button" className="danger" onClick={() => { action.remove(menu.entry); setMenu(null) }}>Sil</button>
        </div>
      )}

      {quickLook && (
        <QuickLook
          key={quickLook.path}
          profileId={profileId}
          entry={quickLook}
          onClose={() => { setQuickLook(null) }}
        />
      )}

      {permissions && (
        <PermissionsDialog
          entry={permissions}
          onClose={() => { setPermissions(null) }}
          onApply={(mode, recursive) => {
            window.kopru
              .invoke('fs:chmod', { profileId, path: permissions.path, mode, recursive })
              .then(refresh)
              .catch(fail)
            setPermissions(null)
          }}
        />
      )}
    </div>
  )
}
