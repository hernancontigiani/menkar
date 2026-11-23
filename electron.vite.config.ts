import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import { resolveBuildFlavor } from './src/core/flavor'

// Which Menkar this build is (src/core/flavor.ts): the branch decides unless MENKAR_FLAVOR_BUILD
// says, so a build in the multi-agent worktree is a sandbox by default.
const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
  cwd: import.meta.dirname,
  encoding: 'utf8',
}).trim()
const flavor = resolveBuildFlavor(process.env.MENKAR_FLAVOR_BUILD, branch)
const define = { __MENKAR_FLAVOR__: JSON.stringify(flavor) }
// out/main/flavor.txt: what scripts/package.mjs reads, so a package never holds the other
// flavour's code.
const flavorFile = {
  name: 'menkar-flavor',
  generateBundle(this: {
    emitFile(file: { type: 'asset'; fileName: string; source: string }): string
  }) {
    this.emitFile({ type: 'asset', fileName: 'flavor.txt', source: `${flavor}\n` })
  },
}

export default defineConfig({
  main: {
    define,
    plugins: [flavorFile],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          // Usage passes run on a worker thread, which loads its own file.
          'usage-worker': resolve('src/main/usage-worker.ts'),
          'classifier-worker': resolve('src/main/classifier-worker.ts'),
          'usage-query-worker': resolve('src/main/usage-query-worker.ts'),
          'activity-worker': resolve('src/main/activity-worker.ts'),
          // Claude Code runs the statusline as a program of its own, through Electron's binary.
          statusline: resolve('src/core/context/statusline.ts'),
          // Menkar's MCP server, which Claude Code starts for each session Menkar starts, the same way.
          'mcp-server': resolve('src/core/control/server.ts'),
          // Codex's notify program for the sessions Menkar starts, the same way.
          'codex-notify': resolve('src/core/agents/codex/notify.ts'),
          // Cursor's turn hooks, which the user's ~/.cursor/hooks.json runs, the same way.
          'cursor-hook': resolve('src/core/agents/cursor/hooks.ts'),
          // OpenCode's database read on a worker thread: its SQLite is synchronous.
          'opencode-db': resolve('src/core/agents/opencode/db-worker.ts'),
        },
      },
    },
  },
  preload: {
    define,
    build: {
      rollupOptions: {
        input: resolve('src/preload/index.ts'),
        // A sandboxed preload cannot be an ES module.
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    define,
    root: resolve('src/renderer'),
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          // Preferences, About and the Usage window: child windows with pages of their own.
          settings: resolve('src/renderer/settings.html'),
          usage: resolve('src/renderer/usage.html'),
        },
      },
    },
  },
})
