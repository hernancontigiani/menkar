import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { log } from '../../../core/log'
import { agentPaths } from '../../../core/paths'
import {
  type BridgeState,
  bridgeState,
  findAgentPid,
  type ProcReader,
  procStartOf,
} from '../../../core/remote/live'
import type { Remote, RemotePane } from '../types'

// Read from Claude Code's per-process registry (read only), for the `claude` process under the
// pane's shell.

// A registry file that did not read as expected is logged once per pid, not on every pass.
const reported = new Set<number>()

async function children(pid: number): Promise<number[]> {
  try {
    const tasks = await readdir(`/proc/${pid}/task`)
    const found: number[] = []
    for (const task of tasks) {
      const text = await readFile(`/proc/${pid}/task/${task}/children`, 'utf8').catch(() => '')
      for (const child of text.trim().split(/\s+/))
        if (/^\d+$/.test(child)) found.push(Number(child))
    }
    return found
  } catch {
    return [] // the process is gone
  }
}

// The finder is pure and synchronous; the tree under a pane's shell is read first, a few levels
// deep, and handed to it.
async function procSnapshot(root: number): Promise<ProcReader> {
  const tree = new Map<number, number[]>()
  const argv = new Map<number, string[]>()
  let level = [root]
  for (let depth = 0; depth < 3 && level.length > 0; depth += 1) {
    const next: number[] = []
    for (const pid of level) {
      const kids = await children(pid)
      tree.set(pid, kids)
      for (const kid of kids) {
        const raw = await readFile(`/proc/${kid}/cmdline`, 'utf8').catch(() => '')
        argv.set(kid, raw.split('\0').filter(Boolean))
        next.push(kid)
      }
    }
    level = next
  }
  return { children: (pid) => tree.get(pid) ?? [], argv: (pid) => argv.get(pid) ?? [] }
}

async function live(pane: RemotePane): Promise<BridgeState> {
  const shellPid = pane.shellPid()
  const sessionId = pane.sessionId()
  const pid = findAgentPid(shellPid, 'claude', await procSnapshot(shellPid))
  if (pid === null) return 'unknown'
  const stat = await readFile(`/proc/${pid}/stat`, 'utf8').catch(() => '')
  let json: unknown
  try {
    json = JSON.parse(await readFile(join(agentPaths().claudeSessions, `${pid}.json`), 'utf8'))
  } catch (error) {
    if (!reported.has(pid)) {
      reported.add(pid)
      log.info('remote control state unreadable; the icon follows the app list', { pid, error })
    }
    return 'unknown'
  }
  const state = bridgeState(json, { pid, sessionId, procStart: procStartOf(stat) })
  if (state === 'unknown' && !reported.has(pid)) {
    reported.add(pid)
    log.info('remote control state not as expected; the icon follows the app list', { pid })
  }
  return state
}

export const remote: Remote = { folder: () => agentPaths().claudeSessions, live }
