import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

// `build.externalizeDeps` (electron-vite 5) replaces the old
// externalizeDepsPlugin: runtime deps like ssh2 stay external instead of being
// bundled, which is required for anything touching Node built-ins.
export default defineConfig({
  main: {
    resolve: { alias: { '@shared': resolve('src/shared') } },
    build: { externalizeDeps: true, rollupOptions: { input: resolve('src/main/index.ts') } },
  },
  preload: {
    resolve: { alias: { '@shared': resolve('src/shared') } },
    build: { externalizeDeps: true, rollupOptions: { input: resolve('src/preload/index.ts') } },
  },
  renderer: {
    root: resolve('src/renderer'),
    plugins: [react()],
    resolve: {
      alias: { '@shared': resolve('src/shared'), '@renderer': resolve('src/renderer') },
    },
    build: { rollupOptions: { input: resolve('src/renderer/index.html') } },
  },
})
