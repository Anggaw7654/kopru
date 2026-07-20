import { create } from 'zustand'

export type ThemeChoice = 'system' | 'dark' | 'light'

interface SettingsStore {
  theme: ThemeChoice
  terminalFontSize: number
  open: boolean
  setTheme: (theme: ThemeChoice) => void
  setTerminalFontSize: (size: number) => void
  setOpen: (open: boolean) => void
}

const THEME_KEY = 'kopru.theme'
const FONT_KEY = 'kopru.terminalFontSize'

function readTheme(): ThemeChoice {
  const raw = localStorage.getItem(THEME_KEY)
  return raw === 'dark' || raw === 'light' || raw === 'system' ? raw : 'system'
}

/** Resolves 'system' against the OS preference and stamps the root element. */
export function applyTheme(choice: ThemeChoice): void {
  const dark =
    choice === 'dark' ||
    (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset['theme'] = dark ? 'dark' : 'light'
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  theme: readTheme(),
  terminalFontSize: Number(localStorage.getItem(FONT_KEY)) || 13,
  open: false,

  setTheme: (theme) => {
    localStorage.setItem(THEME_KEY, theme)
    applyTheme(theme)
    set({ theme })
  },

  setTerminalFontSize: (terminalFontSize) => {
    localStorage.setItem(FONT_KEY, String(terminalFontSize))
    set({ terminalFontSize })
  },

  setOpen: (open) => {
    set({ open })
  },
}))
