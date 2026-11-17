import { shellQuote } from '../../command'
import type { Launcher, Namer } from '../types'
import { mcp } from './mcp'
import { team } from './team'

export const namer: Namer = { atStart: (name) => ['-n', name] }

export const launch: Launcher = {
  plan(start, ctx) {
    const args: string[] = [ctx.cli]
    switch (start.kind) {
      case 'new':
        if (start.id) args.push('--session-id', start.id)
        if (start.name) args.push(...(namer.atStart(start.name) ?? []))
        if (start.model) args.push('--model', start.model)
        if (ctx.remoteControl) args.push(`--remote-control=${ctx.remoteControl}`)
        break
      case 'resume':
        args.push('--resume', start.id)
        if (ctx.remoteControl) args.push(`--remote-control=${ctx.remoteControl}`)
        break
      case 'fork':
        args.push('--resume', start.source, '--fork-session', '--session-id', start.id)
        break
    }
    const words = args.map(shellQuote)
    // Before --mcp-config, which takes every word up to the next option: after it the prompt would be
    // read as one more value. Double quotes keep it one argument whatever it holds.
    if (ctx.promptFile) words.push(`"$(cat '${ctx.promptFile.replaceAll("'", `'"'"'`)}')"`)
    words.push(...mcp.words(ctx))
    if (ctx.settings) words.push('--settings', shellQuote(ctx.settings))
    if (ctx.teamFile) words.push(...team.atStart(start, ctx.teamFile))
    return { words, env: ctx.env }
  },
}
