import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '../stores/dil.js'

interface PromptOptions {
  title: string
  /** Secondary line, e.g. the full path being acted on. */
  detail?: string
  defaultValue?: string
  confirmLabel?: string
}

interface PromptState extends PromptOptions {
  resolve: (value: string | null) => void
}

/**
 * Electron does not implement `window.prompt` — it is a hard no-op that logs
 * "prompt() is and will not be supported" and returns undefined. Every feature
 * built on it (new folder, rename, compress, add shortcut) silently did
 * nothing, with no error to notice.
 *
 * Returns an `ask()` that resolves to the entered string, or null when
 * cancelled, plus the element to render.
 */
export function usePrompt(): [
  (options: PromptOptions) => Promise<string | null>,
  React.JSX.Element | null,
] {
  const [state, setState] = useState<PromptState | null>(null)

  const ask = useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setState({ ...options, resolve })
      }),
    [],
  )

  const finish = useCallback((value: string | null) => {
    setState((current) => {
      current?.resolve(value)
      return null
    })
  }, [])

  const element = state ? <PromptDialog state={state} onFinish={finish} /> : null
  return [ask, element]
}

function PromptDialog({
  state,
  onFinish,
}: {
  state: PromptState
  onFinish: (value: string | null) => void
}): React.JSX.Element {
  const t = useT()
  const [value, setValue] = useState(state.defaultValue ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Focus and select so typing replaces the suggestion, matching the native
    // prompt this stands in for.
    const input = inputRef.current
    if (!input) return
    input.focus()
    input.select()
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onFinish(null)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [onFinish])

  const submit = (event: React.SyntheticEvent): void => {
    event.preventDefault()
    const trimmed = value.trim()
    onFinish(trimmed === '' ? null : trimmed)
  }

  return (
    <div
      className="modal-backdrop"
      onClick={() => {
        onFinish(null)
      }}
    >
      <form
        className="modal prompt"
        onClick={(e) => {
          e.stopPropagation()
        }}
        onSubmit={submit}
      >
        <h3>{state.title}</h3>
        {state.detail !== undefined && <p className="prompt__detail">{state.detail}</p>}

        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
          }}
        />

        <div className="row">
          <button type="submit" disabled={value.trim() === ''}>
            {state.confirmLabel ?? 'Tamam'}
          </button>
          <button
            type="button"
            onClick={() => {
              onFinish(null)
            }}
          >
            {t('Vazgeç')}
          </button>
        </div>
      </form>
    </div>
  )
}
