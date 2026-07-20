import { create } from 'zustand'
import type { MetricSnapshot } from '@shared/types/metrics.js'

interface MonitorStore {
  byProfile: Record<string, MetricSnapshot[]>
  apply: (snapshot: MetricSnapshot) => void
  hydrate: (profileId: string) => Promise<void>
  latest: (profileId: string) => MetricSnapshot | undefined
}

const LIMIT = 180

export const useMonitorStore = create<MonitorStore>((set, get) => ({
  byProfile: {},

  apply: (snapshot) => {
    set((state) => {
      const existing = state.byProfile[snapshot.profileId] ?? []
      const next = [...existing, snapshot]
      if (next.length > LIMIT) next.shift()
      return { byProfile: { ...state.byProfile, [snapshot.profileId]: next } }
    })
  },

  hydrate: async (profileId) => {
    const { snapshots } = await window.kopru.invoke('monitor:history', { profileId })
    set((state) => ({ byProfile: { ...state.byProfile, [profileId]: snapshots } }))
  },

  latest: (profileId) => {
    const list = get().byProfile[profileId]
    return list?.at(-1)
  },
}))
