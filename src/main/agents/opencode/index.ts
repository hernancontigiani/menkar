import { descriptor, SESSION_META } from '../../../core/agents/opencode/descriptor'
import { writeTurnEnd } from '../../../core/agents/shared/turn-end'
import { controlPaths } from '../../../core/control/files'
import { log } from '../../../core/log'
import type { MainAgentKit, Waker } from '../types'
import { OpenCodePreparer, serverConfig } from './prepare'
import { OpenCodeProxies } from './proxy'
import { OpenCodeServer } from './server'
import { inboxWaker } from './waker'

const server = new OpenCodeServer({ command: descriptor.command, config: serverConfig })

export const proxies = new OpenCodeProxies({
  onSession: (pane, sessionId, previous, created) =>
    preparer.moved(pane, sessionId, previous, created),
})

// A turn's end read from the server's events becomes the pane's turn-end record, as every agent's.
const preparer = new OpenCodePreparer({
  server,
  proxies,
  turnEnded: (pane, sessionId) => {
    try {
      writeTurnEnd(controlPaths().turnEnds, pane, sessionId)
    } catch (error) {
      log.warn("an OpenCode turn's end could not be recorded", { pane, error })
    }
  },
})

const inbox = inboxWaker(() => server.running())

// A wake into a session another server runs too may start a second turn there at once (D9).
const waker: Waker = {
  wake: (sessionId, text, counts) => {
    void preparer.otherServer(sessionId, 'wake')
    return inbox.wake(sessionId, text, counts)
  },
}

export const mainKit: MainAgentKit = {
  settings: null,
  team: preparer.team,
  remote: null,
  waker,
  inbox: null,
  bind: null,
  namer: null,
  callers: {
    meta: SESSION_META,
    paneOf: (sessionId) => proxies.paneOf(sessionId),
  },
  prepare: preparer,
  runs: preparer.runs,
}
