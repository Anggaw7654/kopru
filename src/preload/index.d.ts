import type { KopruApi } from '../shared/ipc.js'

declare global {
  interface Window {
    kopru: KopruApi
  }
}

export {}
