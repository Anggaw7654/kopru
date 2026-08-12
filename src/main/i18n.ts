import { cevir, type Dil } from '../shared/i18n.js'
import '../shared/i18n-en.js'
import { redactDilKaynagi } from '../shared/redact.js'

/**
 * Language for main-process text: native dialogs and the error messages that
 * reach the UI.
 *
 * Main has no DOM and no localStorage, so the renderer pushes its choice over
 * IPC at startup and on every change. Until that arrives the default is
 * Turkish — the same fallback the dictionary uses, so an early error is
 * readable rather than empty.
 */
let aktif: Dil = 'tr'

export function dilAyarla(dil: Dil): void {
  aktif = dil
}

// Maskeleme etiketi de aynı dili izler.
redactDilKaynagi(() => aktif)

export function dilAl(): Dil {
  return aktif
}

/** Translate a main-process string. Named `m` to stay short at call sites. */
export function m(kaynak: string, degerler?: Record<string, string | number>): string {
  return cevir(aktif, kaynak, degerler)
}
