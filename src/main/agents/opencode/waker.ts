import { wakeText } from '../../../core/control/post'
import { log } from '../../../core/log'
import type { Waker } from '../types'
import { answered, call, type Running } from './server'

// OpenCode's own way into a running session: a message put in its durable inbox on Menkar's
// server. Queued, it waits for the running step to end, and behind a pending permission, which
// nothing it carries can answer; an idle session takes it as a turn at once. No keystroke reaches
// the terminal, so a half-typed message stays in the composer.
export function inboxWaker(server: () => Promise<Running> | null): Waker {
  return {
    wake: async (sessionId, text, counts) => {
      const running = server()
      if (running === null) return 'no session'
      const answer = await call(
        await running,
        'POST',
        `/api/session/${encodeURIComponent(sessionId)}/prompt`,
        { text: wakeText(text, counts), delivery: 'queue' },
      )
      if (answered(answer)) return 'posted'
      if (answer.status === 404) return 'no session'
      log.warn("OpenCode's inbox refused a message", { session: sessionId, status: answer.status })
      throw new Error(`OpenCode's inbox answered ${answer.status}`)
    },
    release: null,
  }
}
