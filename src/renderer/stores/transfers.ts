import { create } from 'zustand'
import type { Transfer } from '@shared/types/files.js'

interface TransferStore {
  items: Transfer[]
  open: boolean
  apply: (transfer: Transfer) => void
  hydrate: () => Promise<void>
  setOpen: (open: boolean) => void
  cancel: (id: string) => Promise<void>
  clearFinished: () => Promise<void>
}

export const useTransferStore = create<TransferStore>((set, get) => ({
  items: [],
  open: false,

  apply: (transfer) => {
    set((state) => {
      const index = state.items.findIndex((t) => t.id === transfer.id)
      if (index === -1) return { items: [...state.items, transfer], open: true }
      const items = [...state.items]
      items[index] = transfer
      return { items }
    })
  },

  hydrate: async () => {
    set({ items: await window.kopru.invoke('transfer:list') })
  },

  setOpen: (open) => {
    set({ open })
  },

  cancel: async (id) => {
    await window.kopru.invoke('transfer:cancel', { id })
  },

  clearFinished: async () => {
    await window.kopru.invoke('transfer:clear-finished')
    await get().hydrate()
  },
}))
