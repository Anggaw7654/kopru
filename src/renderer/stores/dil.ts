import { create } from 'zustand'
import { cevir, type Dil } from '@shared/i18n.js'
import '@shared/i18n-en.js'

/**
 * Interface language.
 *
 * Default comes from the OS locale: a Turkish machine gets Turkish, everyone
 * else gets English. The explicit choice is persisted, and once made it wins —
 * a user who picked English does not get flipped back by their locale.
 *
 * The main process needs the same language for its native dialogs and error
 * messages, so every change is pushed across the IPC boundary.
 */
const ANAHTAR = 'kopru.dil'

function baslangic(): Dil {
  const kayitli = localStorage.getItem(ANAHTAR)
  if (kayitli === 'tr' || kayitli === 'en') return kayitli
  return navigator.language.toLowerCase().startsWith('tr') ? 'tr' : 'en'
}

interface DilStore {
  dil: Dil
  ayarla: (dil: Dil) => void
}

export const useDilStore = create<DilStore>((set) => ({
  dil: baslangic(),
  ayarla: (dil) => {
    localStorage.setItem(ANAHTAR, dil)
    document.documentElement.lang = dil
    window.kopru.send('dil:degisti', { dil })
    set({ dil })
  },
}))

/**
 * Translation hook.
 *
 * Subscribing to `dil` is what makes a language switch re-render the tree; a
 * plain module-level `t()` would keep the old strings until something else
 * happened to re-render.
 */
export function useT(): (kaynak: string, degerler?: Record<string, string | number>) => string {
  const dil = useDilStore((s) => s.dil)
  return (kaynak, degerler) => cevir(dil, kaynak, degerler)
}

/** Startup: apply the language to <html lang> and tell main about it. */
export function dilBaslat(): void {
  const dil = useDilStore.getState().dil
  document.documentElement.lang = dil
  window.kopru.send('dil:degisti', { dil })
}
