import { create } from 'zustand'

export interface TerminalTab {
  sessionId: string
  profileId: string
  title: string
  /** True after a reconnect replaced the pty, until the user types in it. */
  restored: boolean
}

interface TerminalStore {
  tabs: TerminalTab[]
  activeSessionId: string | null
  add: (tab: TerminalTab) => void
  remove: (sessionId: string) => void
  setActive: (sessionId: string) => void
  markRestored: (sessionId: string, restored: boolean) => void
}

export const useTerminalStore = create<TerminalStore>((set) => ({
  tabs: [],
  activeSessionId: null,

  add: (tab) => {
    set((state) => ({ tabs: [...state.tabs, tab], activeSessionId: tab.sessionId }))
  },

  remove: (sessionId) => {
    set((state) => {
      const tabs = state.tabs.filter((t) => t.sessionId !== sessionId)
      const activeSessionId =
        state.activeSessionId === sessionId
          ? (tabs.at(-1)?.sessionId ?? null)
          : state.activeSessionId
      return { tabs, activeSessionId }
    })
  },

  setActive: (activeSessionId) => {
    set({ activeSessionId })
  },

  markRestored: (sessionId, restored) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.sessionId === sessionId ? { ...t, restored } : t)),
    }))
  },
}))
