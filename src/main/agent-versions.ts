import { execFile } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { app, BrowserWindow, ipcMain } from 'electron'
import { descriptorOf } from '../core/agents/descriptors'
import { AGENT_IDS, type AgentId, parseAgentId } from '../core/agents/ids'
import {
  type AgentVersionView,
  hiddenVersions,
  readVersion,
  standingOf,
  withHiddenVersion,
} from '../core/agents/versions'
import { now } from '../core/clock'
import { log } from '../core/log'
import { findOnPath } from '../core/sessions/installed'
import type { InvokeChannel, InvokeChannels } from '../shared/ipc'
import { sessions } from './sessions'

// Each agent's installed version, read with `--version` off the UI path: at start, and again when
// a window gains focus and an agent's executable was installed, removed or replaced since.

const VERSION_WAIT_MS = 5000
const LOOK_AGAIN_MS = 60_000

interface Read {
  // The executable's path and mtime when read; null when it was not found.
  readonly key: string | null
  readonly version: string | null
}

const read = new Map<AgentId, Read>()
let views: readonly AgentVersionView[] = []
let lastLook = Number.NEGATIVE_INFINITY
let looking: Promise<void> | null = null

function versionOf(cli: string, word: number): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      cli,
      ['--version'],
      // A CLI that ignores SIGTERM (an interactive shell) would hold the start waiting on it.
      { timeout: VERSION_WAIT_MS, killSignal: 'SIGKILL', env: { ...process.env, NO_COLOR: '1' } },
      (error, stdout) => {
        if (error) {
          log.warn('an agent CLI did not say its version', { cli, error })
          resolve(null)
        } else resolve(readVersion(stdout, word))
      },
    )
  })
}

async function keyOf(cli: string): Promise<string> {
  try {
    return `${cli}\0${(await stat(cli)).mtimeMs}`
  } catch (error) {
    log.warn('an agent CLI could not be looked at', { cli, error })
    return cli
  }
}

async function readAgent(agent: AgentId): Promise<boolean> {
  const cli = await findOnPath(descriptorOf(agent).command)
  const key = cli ? await keyOf(cli) : null
  const before = read.get(agent)
  if (before && before.key === key) return false
  read.set(agent, {
    key,
    version: cli ? await versionOf(cli, descriptorOf(agent).versionWord) : null,
  })
  return true
}

async function viewsNow(): Promise<readonly AgentVersionView[]> {
  const hidden = hiddenVersions(await sessions.currentState())
  return AGENT_IDS.map((agent) => {
    const { versions } = descriptorOf(agent)
    const r = read.get(agent)
    const installed = r?.version ?? null
    return {
      agent,
      installed,
      validated: versions.validated,
      floor: versions.floor,
      standing: standingOf(installed, (r?.key ?? null) !== null, versions),
      hidden: installed !== null && hidden[agent] === installed,
    }
  })
}

function broadcast(): void {
  for (const window of BrowserWindow.getAllWindows())
    if (!window.isDestroyed()) window.webContents.send('agents:versions', views)
}

async function look(): Promise<void> {
  lastLook = now()
  let changed = false
  for (const agent of AGENT_IDS) if (await readAgent(agent)) changed = true
  if (!changed) return
  views = await viewsNow()
  log.info('agent versions read', {
    versions: views.map((v) => `${v.agent}=${v.installed ?? '-'}:${v.standing}`).join(' '),
  })
  broadcast()
}

function lookOnce(): Promise<void> {
  looking ??= look()
    .catch((error: unknown) => log.warn('agent versions could not be read', { error }))
    .finally(() => {
      looking = null
    })
  return looking
}

function handle<C extends InvokeChannel>(
  channel: C,
  handler: (request: InvokeChannels[C]['request']) => Promise<InvokeChannels[C]['response']>,
): void {
  ipcMain.handle(channel, (_event, request: InvokeChannels[C]['request']) => handler(request))
}

// The executables, by path and mtime, that refused the id a session was started with.
const refusedIds = new Set<string>()

// The agent's installed version as last read, read now when it was not yet; null for an executable
// that refused a session's id, so its next start lets it pick its own.
export async function installedVersion(agent: AgentId): Promise<string | null> {
  if (looking) await looking
  if (!read.has(agent))
    await readAgent(agent).catch((error: unknown) =>
      log.warn('an agent version could not be read', { agent, error }),
    )
  const r = read.get(agent)
  if (!r || (r.key !== null && refusedIds.has(r.key))) return null
  return r.version
}

export async function markIdRefused(agent: AgentId): Promise<void> {
  const cli = await findOnPath(descriptorOf(agent).command)
  if (cli) refusedIds.add(await keyOf(cli))
}

export function startAgentVersions(): void {
  handle('agents:versions', async () => {
    await (looking ?? Promise.resolve())
    return views
  })
  handle('agents:hide-version', async (request) => {
    const agent = parseAgentId(request?.agent)
    const version = agent ? read.get(agent)?.version : null
    if (agent && version) {
      await sessions.updateState((state) => withHiddenVersion(state, agent, version))
      views = await viewsNow()
      broadcast()
    }
    return views
  })
  app.on('browser-window-focus', () => {
    if (now() - lastLook >= LOOK_AGAIN_MS) void lookOnce()
  })
  void lookOnce()
}
