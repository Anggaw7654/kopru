import { create } from 'zustand'
import type { DirEntry } from '@shared/types/files.js'

const FAVORITES_KEY = 'kopru.favorites'
const RECENTS_KEY = 'kopru.recents'
const MAX_RECENTS = 8

function readList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

interface FileStore {
  path: string
  entries: DirEntry[]
  selected: string[]
  loading: boolean
  error: string | null
  showHidden: boolean
  view: 'list' | 'columns'
  favorites: string[]
  recents: string[]

  navigate: (profileId: string, path: string) => Promise<void>
  refresh: (profileId: string) => Promise<void>
  select: (paths: string[]) => void
  toggleHidden: (profileId: string) => Promise<void>
  setView: (view: 'list' | 'columns') => void
  toggleFavorite: (path: string) => void
}

export const useFileStore = create<FileStore>((set, get) => ({
  path: '',
  entries: [],
  selected: [],
  loading: false,
  error: null,
  showHidden: false,
  view: 'list',
  favorites: readList(FAVORITES_KEY),
  recents: readList(RECENTS_KEY),

  navigate: async (profileId, path) => {
    set({ loading: true, error: null })
    try {
      const result = await window.kopru.invoke('fs:list', {
        profileId,
        path,
        showHidden: get().showHidden,
      })
      const recents = [path, ...get().recents.filter((p) => p !== path)].slice(0, MAX_RECENTS)
      localStorage.setItem(RECENTS_KEY, JSON.stringify(recents))
      set({ path: result.path, entries: result.entries, selected: [], loading: false, recents })
    } catch (error) {
      // Keep the previous listing on screen: replacing it with an empty view
      // loses the user's place for what is often a transient permission error.
      set({ error: error instanceof Error ? error.message : String(error), loading: false })
    }
  },

  refresh: async (profileId) => {
    const { path, navigate } = get()
    if (path) await navigate(profileId, path)
  },

  select: (selected) => {
    set({ selected })
  },

  toggleHidden: async (profileId) => {
    set({ showHidden: !get().showHidden })
    await get().refresh(profileId)
  },

  setView: (view) => {
    set({ view })
  },

  toggleFavorite: (path) => {
    const favorites = get().favorites.includes(path)
      ? get().favorites.filter((p) => p !== path)
      : [...get().favorites, path]
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites))
    set({ favorites })
  },
}))
