import { create } from 'zustand'
import type { Profile, ProfileInput } from '@shared/types/profile.js'

interface ProfileStore {
  profiles: Profile[]
  loading: boolean
  error: string | null
  load: () => Promise<void>
  save: (input: ProfileInput) => Promise<Profile>
  remove: (id: string) => Promise<void>
}

export const useProfileStore = create<ProfileStore>((set, get) => ({
  profiles: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      set({ profiles: await window.kopru.invoke('profiles:list'), loading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), loading: false })
    }
  },

  save: async (input) => {
    const saved = await window.kopru.invoke('profiles:save', input)
    await get().load()
    return saved
  },

  remove: async (id) => {
    await window.kopru.invoke('profiles:delete', { id })
    await get().load()
  },
}))
