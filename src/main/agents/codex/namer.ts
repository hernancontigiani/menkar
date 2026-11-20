import { spawn } from 'node:child_process'
import { type FSWatcher, watch } from 'node:fs'
import { join } from 'node:path'
import { NameIndex } from '../../../core/agents/codex/catalog'
import { codexHome } from '../../../core/agents/codex/config'
import { descriptor } from '../../../core/agents/codex/descriptor'
import { readRange } from '../../../core/agents/shared/jsonl'
import { log } from '../../../core/log'
import { withoutSessionEnv } from '../../../core/sessionenv'
import type { AfterNamer, NameOutcome } from '../types'

// Codex's server answers in well under a second; past this the call is given up.
export const NAME_WAIT_MS = 10_000

// Codex requires a client name and version; the version says nothing Codex acts on.
const CLIENT = { name: 'menkar', version: '1' }

// Codex's answer for a thread with no rollout yet, and for an unknown id alike.
const NO_ROLLOUT = 'no rollout found'

interface Reply {
  readonly id?: unknown
  readonly result?: unknown
  readonly error?: { readonly message?: unknown }
}

// One `thread/name/set` through a server of Codex's own on the same home: Codex writes the name
// into its index and its database, which a running TUI never re-reads. `--disable plugins` keeps
// the server from syncing Codex's plugin marketplace over the network. The process ends once its
// input is closed, whatever it answered, so the answer is read, never the exit status.
function setName(threadId: string, name: string): Promise<'named' | 'no session'> {
  return new Promise((resolve, reject) => {
    const child = spawn(descriptor.command, ['app-server', '--disable', 'plugins'], {
      env: withoutSessionEnv(process.env),
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: NAME_WAIT_MS,
    })
    let settled = false
    const settle = (outcome: 'named' | 'no session' | Error) => {
      if (settled) return
      settled = true
      child.stdin.end()
      if (outcome instanceof Error) reject(outcome)
      else resolve(outcome)
    }
    const send = (message: object) => child.stdin.write(`${JSON.stringify(message)}\n`)
    let pending = ''
    child.stdout.on('data', (chunk: Buffer) => {
      pending += chunk.toString('utf8')
      const lines = pending.split('\n')
      pending = lines.pop() ?? ''
      for (const line of lines) {
        let reply: Reply
        try {
          reply = JSON.parse(line) as Reply
        } catch {
          continue // not a message of the protocol
        }
        if (reply.id === 1 && reply.result !== undefined) {
          send({ method: 'initialized' })
          send({ id: 2, method: 'thread/name/set', params: { threadId, name } })
        } else if (reply.id === 1 || reply.id === 2) {
          const message = String(reply.error?.message ?? '')
          if (reply.id === 2 && reply.result !== undefined) settle('named')
          else if (message.startsWith(NO_ROLLOUT)) settle('no session')
          else settle(new Error(`codex app-server refused: ${message}`))
        }
      }
    })
    child.on('error', (error) => settle(error))
    child.on('close', (code) =>
      settle(new Error(`codex app-server ended with ${code ?? 'a signal'}`)),
    )
    send({ id: 1, method: 'initialize', params: { clientInfo: CLIENT } })
  })
}

async function nameOf(threadId: string): Promise<string | null> {
  const index = new NameIndex()
  await index.refresh(join(codexHome(), 'session_index.jsonl'), readRange)
  return index.name(threadId)
}

const pad = (n: number) => String(n).padStart(2, '0')

// The folders a new rollout appears in, for a session started at `since`: Codex names the day's
// folder after the session's start, in local time. A folder not made yet is watched from its
// parent, and taken up once it appears.
function rolloutFolders(since: number): string[] {
  const d = new Date(since)
  const home = codexHome()
  const sessions = join(home, 'sessions')
  const year = join(sessions, String(d.getFullYear()))
  const month = join(year, pad(d.getMonth() + 1))
  return [home, sessions, year, month, join(month, pad(d.getDate()))]
}

export const namer: AfterNamer = {
  after: async (sessionId, name): Promise<NameOutcome> => {
    if ((await nameOf(sessionId)) === name) return 'kept'
    const outcome = await setName(sessionId, name)
    if (outcome === 'no session')
      log.info('a Codex thread to name has no rollout', { session: sessionId })
    return outcome
  },

  watch: (since, changed) => {
    const watchers = new Map<string, FSWatcher>()
    let closed = false
    const arm = () => {
      if (closed) return
      for (const folder of rolloutFolders(since)) {
        if (watchers.has(folder)) continue
        try {
          const watcher = watch(folder, { persistent: false }, () => {
            arm()
            changed()
          })
          watcher.on('error', () => watchers.delete(folder))
          watchers.set(folder, watcher)
        } catch {
          // Not made yet: its parent's watch takes it up.
        }
      }
    }
    arm()
    return () => {
      if (closed) return
      closed = true
      for (const watcher of watchers.values()) watcher.close()
    }
  },
}
