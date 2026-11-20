import { join } from 'node:path'
import { shellQuote } from '../../command'
import { PANE_ENV } from '../../context/statusline'
import type { LaunchContext, Launcher, LaunchFile, Namer } from '../types'
import { readUserConfig, tomlString } from './config'

// Codex takes no name at start.
export const namer: Namer = { atStart: () => null }

// The program Codex runs at each turn's end, among those Menkar ships.
export const NOTIFY_PROGRAM = 'codex-notify.js'
// The user's own `notify` argv as JSON, for that program to run after its own work: Menkar's `-c`
// replaces the user's for the session.
export const CHAIN_FILE = 'codex-notify-chain.json'

// `-c notify=[…]`, its argv a TOML array. Through env(1) so Electron runs the program as Node
// without ELECTRON_RUN_AS_NODE in Codex's environment, where every command its shell runs would
// inherit it.
function notify(ctx: LaunchContext): { words: string[]; files: LaunchFile[] } {
  const pane = ctx.env[PANE_ENV]
  if (!ctx.execPath || !ctx.programs || !ctx.paneFiles || !pane) return { words: [], files: [] }
  const chain = join(ctx.paneFiles, CHAIN_FILE)
  const argv = [
    '/usr/bin/env',
    'ELECTRON_RUN_AS_NODE=1',
    ctx.execPath,
    join(ctx.programs, NOTIFY_PROGRAM),
    '--pane',
    pane,
    '--chain-file',
    chain,
  ]
  return {
    words: ['-c', shellQuote(`notify=[${argv.map(tomlString).join(',')}]`)],
    files: [
      { path: chain, text: async () => JSON.stringify((await readUserConfig()).notify ?? []) },
    ],
  }
}

export const launch: Launcher = {
  plan(start, ctx) {
    const words: string[] = [shellQuote(ctx.cli)]
    switch (start.kind) {
      case 'new':
        // On a resume the thread keeps its own model: a `-m` there would switch it.
        if (start.model) words.push('-m', shellQuote(start.model))
        break
      case 'resume':
        words.push('resume')
        break
      case 'fork':
        throw new Error('Codex sessions are not forked')
    }
    if (ctx.filesFolder) words.push('--add-dir', shellQuote(ctx.filesFolder))
    const { words: notifyWords, files } = notify(ctx)
    words.push(...notifyWords)
    if (start.kind === 'resume') words.push(shellQuote(start.id))
    // After `--`, so a prompt that starts with `-` is not read as an option. Double quotes keep it
    // one argument whatever it holds.
    if (ctx.promptFile) words.push('--', `"$(cat ${shellQuote(ctx.promptFile)})"`)
    return { words, env: ctx.env, files }
  },
}
