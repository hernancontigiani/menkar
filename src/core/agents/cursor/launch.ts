import { shellQuote } from '../../command'
import type { Launcher, Namer } from '../types'

export const namer: Namer = { atStart: () => null }

export const launch: Launcher = {
  plan(start, ctx) {
    const args: string[] = [ctx.cli]
    switch (start.kind) {
      case 'new':
        break
      case 'resume':
        args.push('--resume', start.id)
        break
      case 'fork':
        args.push('--resume', start.source, '--fork-session', '--session-id', start.id)
        break
    }
    return { words: args.map(shellQuote), env: ctx.env }
  },
}
