import { create } from 'zustand'
import type { ConnectionSnapshot, HostKeyMismatch } from '@shared/types/connection.js'

interface ConnectionStore {
  byProfile: Record<string, ConnectionSnapshot>
  mismatch: HostKeyMismatch | null
  activeProfileId: string | null
  setActive: (profileId: string | null) => void
  apply: (snapshot: ConnectionSnapshot) => void
  setMismatch: (mismatch: HostKeyMismatch | null) => void
  hydrate: () => Promise<void>
  connect: (profileId: string) => Promise<void>
  disconnect: (profileId: string) => Promise<void>
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  byProfile: {},
  mismatch: null,
  activeProfileId: null,

  setActive: (activeProfileId) => {
    set({ activeProfileId })
  },

  apply: (snapshot) => {
    set((state) => ({ byProfile: { ...state.byProfile, [snapshot.profileId]: snapshot } }))
  },

  setMismatch: (mismatch) => {
    set({ mismatch })
  },

  hydrate: async () => {
    const snapshots = await window.kopru.invoke('connection:status')
    set({ byProfile: Object.fromEntries(snapshots.map((s) => [s.profileId, s])) })
  },

  connect: async (profileId) => {
    set({ mismatch: null, activeProfileId: profileId })
    await window.kopru.invoke('connection:connect', { profileId })
  },

  disconnect: async (profileId) => {
    await window.kopru.invoke('connection:disconnect', { profileId })
  },
}))
