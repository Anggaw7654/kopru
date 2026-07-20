import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebglAddon } from '@xterm/addon-webgl'
import '@xterm/xterm/css/xterm.css'

interface Props {
  sessionId: string
  visible: boolean
}

export function TerminalPane({ sessionId, visible }: Props): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const term = new Terminal({
      fontFamily: 'SFMono-Regular, Menlo, monospace',
      fontSize: 13,
      scrollback: 10_000,
      cursorBlink: true,
      allowProposedApi: true,
      theme: { background: '#1a1b26', foreground: '#c0caf5', cursor: '#c0caf5' },
    })
    const fit = new FitAddon()
    const search = new SearchAddon()
    term.loadAddon(fit)
    term.loadAddon(search)
    term.open(host)

    // WebGL is a large win on heavy output but is unavailable in some VMs and
    // can be lost on GPU reset; fall back to canvas rather than blanking.
    try {
      const webgl = new WebglAddon()
      webgl.onContextLoss(() => {
        webgl.dispose()
      })
      term.loadAddon(webgl)
    } catch {
      // canvas renderer stays in place
    }

    termRef.current = term
    fitRef.current = fit
    fit.fit()

    const offData = window.kopru.on('terminal:data', (payload) => {
      if (payload.sessionId === sessionId) term.write(payload.chunk)
    })
    const offExit = window.kopru.on('terminal:exit', (payload) => {
      if (payload.sessionId === sessionId) {
        term.write('\r\n\x1b[33m[Köprü] Oturum kapandı.\x1b[0m\r\n')
      }
    })
    const offRestored = window.kopru.on('terminal:restored', (payload) => {
      if (payload.sessionId === sessionId) {
        term.write(
          '\r\n\x1b[36m[Köprü] Bağlantı yenilendi — bu sekmede yeni bir oturum açıldı.\x1b[0m\r\n',
        )
      }
    })

    const inputDisposable = term.onData((data) => {
      window.kopru.send('terminal:write', { sessionId, data })
    })

    const resize = (): void => {
      fit.fit()
      window.kopru.send('terminal:resize', { sessionId, cols: term.cols, rows: term.rows })
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)

    return () => {
      observer.disconnect()
      inputDisposable.dispose()
      offData()
      offExit()
      offRestored()
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [sessionId])

  // A hidden pane has zero size, so xterm can't measure; refit when it returns.
  useEffect(() => {
    if (!visible) return
    const id = requestAnimationFrame(() => {
      fitRef.current?.fit()
      const term = termRef.current
      if (term)
        window.kopru.send('terminal:resize', { sessionId, cols: term.cols, rows: term.rows })
      term?.focus()
    })
    return () => {
      cancelAnimationFrame(id)
    }
  }, [visible, sessionId])

  return (
    <div ref={hostRef} className="terminal-pane" style={{ display: visible ? 'block' : 'none' }} />
  )
}
