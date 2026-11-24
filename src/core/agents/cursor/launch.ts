import { shellQuote } from '../../command'
import type { Launcher, LaunchFile } from '../types'
import { mcp, type PluginHooks, pluginFiles, pluginFolder } from './mcp'
import { preCompact, sessionStart } from './team'

export const launch: Launcher = {
  plan(start, ctx) {
    const words: string[] = [shellQuote(ctx.cli)]
    switch (start.kind) {
      case 'new':
        if (start.id) words.push('--new-session-id', shellQuote(start.id))
        if (start.model) words.push('--model', shellQuote(start.model))
        // Not on a resume: Cursor's grant lasts one process, and there it raises a trust box each
        // time, stalling every wake. The team block names the folder instead.
        if (ctx.filesFolder) words.push('--add-dir', shellQuote(ctx.filesFolder))
        break
      case 'resume':
        words.push('--resume', shellQuote(start.id))
        break
      case 'fork':
        throw new Error('Cursor sessions are not forked')
    }
    const files: LaunchFile[] = []
    const folder = pluginFolder(ctx)
    if (folder) {
      let hooks: PluginHooks = {}
      if (ctx.teamFile) {
        hooks = preCompact(ctx)
        if (start.kind === 'new') {
          const delivery = sessionStart(folder, ctx.teamFile)
          files.push(delivery.file)
          hooks = { ...delivery.hooks, ...hooks }
        }
      }
      files.push(...pluginFiles(ctx, folder, hooks))
      words.push(...mcp.words(ctx))
    }
    // After `--`, so a prompt that starts with `-` is not read as an option. Double quotes keep it
    // one argument whatever it holds.
    if (ctx.promptFile) words.push('--', `"$(cat ${shellQuote(ctx.promptFile)})"`)
    return files.length > 0 ? { words, env: ctx.env, files } : { words, env: ctx.env }
  },
}
