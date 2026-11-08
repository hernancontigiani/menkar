import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          // Usage passes run on a worker thread, which loads its own file.
          'usage-worker': resolve('src/main/usage-worker.ts'),
          'classifier-worker': resolve('src/main/classifier-worker.ts'),
          // Claude Code runs the statusline as a program of its own, through Electron's binary.
          statusline: resolve('src/core/context/statusline.ts'),
        },
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: resolve('src/preload/index.ts'),
        // A sandboxed preload cannot be an ES module.
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    root: resolve('src/renderer'),
    build: {
      rollupOptions: { input: resolve('src/renderer/index.html') },
    },
  },
})
