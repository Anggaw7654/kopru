import { useEffect, useRef, useState } from 'react'
import type * as MonacoNamespace from 'monaco-editor'
import type { DangerAssessment, QueryResult } from '@shared/types/postgres.js'
import { usePostgresStore } from '../../stores/postgres.js'
import { useContextStore } from '../../stores/context.js'
import { DataGrid } from './DataGrid.js'
import { DangerousQueryDialog } from './DangerousQueryDialog.js'

interface Props {
  profileId: string
  database: string
}

/** Shared with the file editor: Monaco is ~5 MB and loads on first use only. */
let monacoPromise: Promise<typeof MonacoNamespace> | null = null
function loadMonaco(): Promise<typeof MonacoNamespace> {
  monacoPromise ??= import('monaco-editor')
  return monacoPromise
}

export function SqlEditor({ profileId, database }: Props): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<MonacoNamespace.editor.IStandaloneCodeEditor | null>(null)
  const runRef = useRef<(() => void) | null>(null)

  const { writeMode, setWriteMode, history, pushHistory } = usePostgresStore()
  const addContext = useContextStore((s) => s.add)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [plan, setPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('')
  const [pending, setPending] = useState<{ sql: string; assessment: DangerAssessment } | null>(null)

  useEffect(() => {
    let disposed = false
    void loadMonaco().then((monaco) => {
      const host = hostRef.current
      if (disposed || !host) return
      const editor = monaco.editor.create(host, {
        value: 'select now();',
        language: 'sql',
        // Matches the app theme; 'vs' is Monaco's light variant.
        theme: document.documentElement.dataset['theme'] === 'light' ? 'vs' : 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: 'SFMono-Regular, Menlo, monospace',
        scrollBeyondLastLine: false,
      })
      editorRef.current = editor
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        runRef.current?.()
      })
    })
    return () => {
      disposed = true
      editorRef.current?.dispose()
      editorRef.current = null
    }
  }, [])

  const selectedOrAll = (): string => {
    const editor = editorRef.current
    if (!editor) return ''
    const selection = editor.getSelection()
    const model = editor.getModel()
    if (selection && model && !selection.isEmpty()) return model.getValueInRange(selection)
    return editor.getValue()
  }

  const runSql = async (sql: string): Promise<void> => {
    setBusy(true)
    setError(null)
    setPlan(null)
    try {
      const value = await window.kopru.invoke('pg:query', {
        profileId, database, sql, readOnly: !writeMode,
      })
      if (value.blockedByReadOnly === true) {
        setError(
          'Salt-okunur mod açık; PostgreSQL bu ifadeyi reddetti. ' +
            'Yazmak için üstteki anahtarı açın.',
        )
        setResult(null)
        return
      }
      setResult(value)
      setFilter('')
      pushHistory(sql)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setResult(null)
    } finally {
      setBusy(false)
    }
  }

  const run = (): void => {
    const sql = selectedOrAll().trim()
    if (sql === '') return

    // In read-only mode the engine is the boundary, so the dialog would only be
    // noise; in write mode it is the last checkpoint before data changes.
    if (!writeMode) {
      void runSql(sql)
      return
    }

    setBusy(true)
    window.kopru
      .invoke('pg:assess', { profileId, database, sql, readOnly: false })
      .then((assessment) => {
        setBusy(false)
        if (assessment.dangerous) setPending({ sql, assessment })
        else void runSql(sql)
      })
      .catch(() => {
        setBusy(false)
        // If the assessment itself fails, ask anyway rather than run blind.
        setPending({ sql, assessment: { dangerous: true, kinds: [], estimatedRows: null } })
      })
  }
  // Monaco's ⌘⏎ binding is registered once, so its closure would freeze the
  // first render's `run`. Refresh through a ref in an effect — writing refs
  // during render is unsafe under concurrent rendering.
  useEffect(() => {
    runRef.current = run
  })

  const explain = (): void => {
    const sql = selectedOrAll().trim()
    if (sql === '') return
    setBusy(true)
    setError(null)
    window.kopru
      .invoke('pg:explain', { profileId, database, sql, readOnly: true })
      .then(({ plan: text }) => { setPlan(text); setResult(null) })
      .catch((err: unknown) => { setError(err instanceof Error ? err.message : String(err)) })
      .finally(() => { setBusy(false) })
  }

  return (
    <div className="sql">
      <header className="sql__bar">
        <button type="button" disabled={busy} onClick={run}>
          {busy ? 'Çalışıyor…' : 'Çalıştır (⌘⏎)'}
        </button>
        <button type="button" disabled={busy} onClick={explain}>EXPLAIN ANALYZE</button>
        <button
          type="button"
          onClick={() => {
            const sql = selectedOrAll().trim()
            if (sql === '') return
            addContext({ kind: 'sql', label: `${database} sorgusu`, content: sql, language: 'sql' })
            if (plan !== null) {
              addContext({ kind: 'sql', label: 'EXPLAIN ANALYZE çıktısı', content: plan })
            }
            // Row data is deliberately not attached — the schema and the plan
            // are what an optimisation question needs.
          }}
        >
          Claude’a gönder
        </button>

        <label className={`checkbox write-toggle ${writeMode ? 'write-toggle--on' : ''}`}>
          <input
            type="checkbox"
            checked={writeMode}
            onChange={(e) => {
              if (e.target.checked &&
                  !window.confirm(
                    'Yazma modu açılacak. Bu modda sorgularınız veriyi kalıcı olarak ' +
                    'değiştirebilir.\n\nDevam edilsin mi?',
                  )) return
              setWriteMode(e.target.checked)
            }}
          />
          {writeMode ? 'YAZMA MODU' : 'Salt okunur'}
        </label>
      </header>

      <div ref={hostRef} className="sql__editor" />

      {history.length > 0 && (
        <details className="sql__history">
          <summary>Sorgu geçmişi ({String(history.length)})</summary>
          {history.map((entry) => (
            <button
              key={entry}
              type="button"
              className="side-link"
              onClick={() => { editorRef.current?.setValue(entry) }}
            >
              {entry.slice(0, 120)}
            </button>
          ))}
        </details>
      )}

      <div className="sql__result">
        {error !== null && <div className="banner banner--error">{error}</div>}
        {plan !== null && <pre className="plan">{plan}</pre>}
        {result !== null && (
          result.fields.length > 0
            ? <DataGrid result={result} filter={filter} onFilterChange={setFilter} />
            : <p className="hint">
                {result.command} — {String(result.rowCount)} satır etkilendi
                ({String(result.durationMs)} ms)
              </p>
        )}
      </div>

      {pending && (
        <DangerousQueryDialog
          assessment={pending.assessment}
          sql={pending.sql}
          onCancel={() => { setPending(null) }}
          onConfirm={() => {
            const sql = pending.sql
            setPending(null)
            void runSql(sql)
          }}
        />
      )}
    </div>
  )
}
