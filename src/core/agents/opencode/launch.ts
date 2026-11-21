import { shellQuote } from '../../command'
import type { Launcher, Namer } from '../types'

// The title is given when Menkar creates the session on its server, before the TUI starts.
export const namer: Namer = { atStart: () => null }

// The TUI attaches to the session Menkar made or resumes on its own server, through the pane's
// proxy (`ctx.server`); the server's password is in the environment main gives the pane. Without
// `--server` it would attach to the user's own shared service. A first prompt is handed to the
// session before the TUI starts: given as its `--prompt`, a /new would submit it again.
export const launch: Launcher = {
  plan(start, ctx) {
    if (start.kind === 'fork') throw new Error('OpenCode sessions are not forked')
    if (ctx.server === undefined || start.id === undefined)
      throw new Error('an OpenCode TUI attaches only to a session on Menkar’s server')
    return {
      words: [shellQuote(ctx.cli), '--server', shellQuote(ctx.server), '-s', shellQuote(start.id)],
      env: ctx.env,
    }
  },
}
