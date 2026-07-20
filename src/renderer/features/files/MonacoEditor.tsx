import { useEffect, useRef, useState } from 'react'
import type * as MonacoNamespace from 'monaco-editor'
import type { OpenFileResult, SaveFileResult } from '@shared/types/files.js'
import { formatDateTime } from './format.js'

interface Props {
  profileId: string
  file: OpenFileResult
  onClose: () => void
}

/**
 * Monaco is ~5 MB. Loading it with the app would triple the renderer bundle for
 * a feature most sessions never touch, so it is imported on first open and the
 * module handle cached for subsequent files.
 */
let monacoPromise: Promise<typeof MonacoNamespace> | null = null

function loadMonaco(): Promise<typeof MonacoNamespace> {
  monacoPromise ??= (async () => {
    // Monaco expects the host to supply its web workers. Without this it falls
    // back to running the language service on the main thread, which freezes
    // the UI on files of any size. Vite's ?worker suffix bundles each one.
    const [editorWorker, jsonWorker, cssWorker, htmlWorker, tsWorker] = await Promise.all([
      import('monaco-editor/esm/vs/editor/editor.worker?worker'),
      import('monaco-editor/esm/vs/language/json/json.worker?worker'),
      import('monaco-editor/esm/vs/language/css/css.worker?worker'),
      import('monaco-editor/esm/vs/language/html/html.worker?worker'),
      import('monaco-editor/esm/vs/language/typescript/ts.worker?worker'),
    ])

    self.MonacoEnvironment = {
      getWorker(_id: string, label: string): Worker {
        switch (label) {
          case 'json':
            return new jsonWorker.default()
          case 'css':
          case 'scss':
          case 'less':
            return new cssWorker.default()
          case 'html':
          case 'handlebars':
          case 'razor':
            return new htmlWorker.default()
          case 'typescript':
          case 'javascript':
            return new tsWorker.default()
          default:
            return new editorWorker.default()
        }
      },
    }

    return import('monaco-editor')
  })()
  return monacoPromise
}

export function MonacoEditor({ profileId, file, onClose }: Props): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<MonacoNamespace.editor.IStandaloneCodeEditor | null>(null)
  const [status, setStatus] = useState<string | null>('Düzenleyici yükleniyor…')
  const [dirty, setDirty] = useState(false)
  const [modified, setModified] = useState(file.modified)
  const [saving, setSaving] = useState(false)

  // The ⌘S keybinding is registered on the Monaco instance once, so its closure
  // would freeze the first render's `save`. Route it through a ref that each
  // render refreshes *in an effect* — writing refs during render is not safe
  // under concurrent rendering.
  const saveRef = useRef<((force: boolean, useSudo: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    let disposed = false

    void loadMonaco().then((monaco) => {
      const host = hostRef.current
      if (disposed || !host) return

      const editor = monaco.editor.create(host, {
        value: file.content,
        language: file.language,
        // Matches the app theme; 'vs' is Monaco's light variant.
        theme: document.documentElement.dataset['theme'] === 'light' ? 'vs' : 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: 'SFMono-Regular, Menlo, monospace',
        readOnly: false,
        scrollBeyondLastLine: false,
      })
      editorRef.current = editor
      setStatus(null)

      editor.onDidChangeModelContent(() => {
        setDirty(true)
      })

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        void saveRef.current?.(false, false)
      })
    })

    return () => {
      disposed = true
      editorRef.current?.dispose()
      editorRef.current = null
    }
    // Intentionally mount-only: re-creating the editor on every render would
    // discard the user's cursor, undo stack and unsaved text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = async (force: boolean, useSudo: boolean): Promise<void> => {
    const editor = editorRef.current
    if (!editor || saving) return

    setSaving(true)
    setStatus('Kaydediliyor…')
    try {
      const result: SaveFileResult = await window.kopru.invoke('fs:save', {
        profileId,
        path: file.path,
        content: editor.getValue(),
        expectedModified: modified,
        force,
        useSudo,
      })

      if (result.ok) {
        setModified(result.modified)
        setDirty(false)
        setStatus(`Kaydedildi — ${formatDateTime(result.modified)}`)
        return
      }

      if (result.reason === 'conflict') {
        const proceed = window.confirm(
          'Bu dosya siz açtıktan sonra sunucuda değişti ' +
            `(${formatDateTime(result.serverModified)}).\n\n` +
            'Üzerine yazarsanız oradaki değişiklikler kaybolur. Devam edilsin mi?',
        )
        if (proceed) await save(true, useSudo)
        else setStatus('Kaydedilmedi.')
        return
      }

      if (result.reason === 'permission') {
        const proceed = window.confirm(
          'Bu dosyaya yazma izniniz yok.\n\nYönetici (sudo) olarak kaydedilsin mi?',
        )
        if (proceed) await save(force, true)
        else setStatus('Kaydedilmedi — izin yok.')
        return
      }

      if (result.reason === 'sudo-cancelled') setStatus('Kaydedilmedi — parola girilmedi.')
      else setStatus(`Kaydedilemedi: ${result.message}`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    saveRef.current = save
  })

  const close = (): void => {
    if (dirty && !window.confirm('Kaydedilmemiş değişiklikler var. Yine de kapatılsın mı?')) return
    onClose()
  }

  return (
    <div className="editor">
      <header className="editor__bar">
        <strong>
          {file.path}
          {dirty && ' •'}
        </strong>
        {file.readOnlyForUser && <span className="badge">yazma izni yok — sudo gerekir</span>}
        <span className="editor__status">{status}</span>
        <button type="button" disabled={saving} onClick={() => void save(false, false)}>
          Kaydet (⌘S)
        </button>
        <button type="button" onClick={close}>Kapat</button>
      </header>
      <div ref={hostRef} className="editor__host" />
    </div>
  )
}
