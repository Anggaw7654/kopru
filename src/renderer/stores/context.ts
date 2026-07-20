import { create } from 'zustand'
import type { ContextItem, ContextKind } from '@shared/types/context.js'
import { redact } from '@shared/redact.js'

/** Per item, so one enormous log cannot crowd out everything else. */
const ITEM_CHAR_LIMIT = 60_000

interface ContextStore {
  items: ContextItem[]
  open: boolean
  setOpen: (open: boolean) => void
  /** Redacts before storing — raw text never enters the store. */
  add: (input: {
    kind: ContextKind
    label: string
    content: string
    language?: string
    sourcePath?: string
  }) => void
  remove: (id: string) => void
  clear: () => void
}

export const useContextStore = create<ContextStore>((set) => ({
  items: [],
  open: false,

  setOpen: (open) => {
    set({ open })
  },

  add: ({ kind, label, content, language, sourcePath }) => {
    let text = content
    let truncated = false
    if (text.length > ITEM_CHAR_LIMIT) {
      // Keep the tail: for logs and command output the end is where the failure
      // is, and that is what the user is asking about.
      text = text.slice(-ITEM_CHAR_LIMIT)
      truncated = true
    }

    const result = redact(text, sourcePath)
    const item: ContextItem = {
      id: crypto.randomUUID(),
      kind,
      label,
      content: truncated
        ? `…(başı kırpıldı, son ${String(ITEM_CHAR_LIMIT)} karakter)\n${result.text}`
        : result.text,
      redactions: result.redactions,
      addedAt: Date.now(),
      ...(language !== undefined ? { language } : {}),
    }
    set((state) => ({ items: [...state.items, item], open: true }))
  },

  remove: (id) => {
    set((state) => ({ items: state.items.filter((item) => item.id !== id) }))
  },

  clear: () => {
    set({ items: [] })
  },
}))
