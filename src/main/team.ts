import { execFile } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { kitOf } from '../core/agents/registry'
import type { VersionFloor } from '../core/agents/types'
import { withoutEscapes } from '../core/agents/versions'
import type { Start } from '../core/command'
import { controlPaths, writeTextAtomic } from '../core/control/files'
import { log } from '../core/log'
import type { WorkCounts } from '../core/orchestration/counts'
import { agentPaths } from '../core/paths'
import type { Agent } from '../core/sessions/lines'
import type { TeamAgent, TeamInput } from '../core/team/block'
import { teamText } from '../core/team/input'
import {
  afterStartRecord,
  delivered,
  type PaneTeam,
  postWithTries,
  TeamSettle,
  type TeamText,
  teamPost,
} from '../core/team/posts'
import { forgetRecorded, readRecorded, writeRecorded } from '../core/team/recorded'
import { foundFor, listSkills } from '../core/team/skills'
import { mainKitOf } from './agents/registry'
import type { TeamOutcome } from './agents/types'
import { skillsPluginDir } from './control'

// A stored skill the session can load, by name, and its SKILL.md.
export type FoundFiles = ReadonlyMap<string, string>

import { addNotice } from './projects'

// Main's side of the team block: (1) what a pane's session holds from its start, (2) the file a
// start delivers, (3) telling a change; what differs per agent is asked of its kit. What a
// session's facts are is the window's state: `setTeamSource` gives it.

export interface TeamSource {
  // The session's input now, null when it is in no project with the mode on.
  input(pane: string, found: FoundFiles): TeamInput | null
  // The pane's agent and session, null once the pane is gone or has no session of its own yet.
  session(pane: string): { readonly agent: Agent; readonly sessionId: string } | null
  // The orchestrator's counts, which close every text Menkar sends it.
  counts(sessionId: string): WorkCounts | undefined
}

interface Held {
  team: PaneTeam
  // Started below the floor or without its file: never posted, for its life.
  readonly outside: boolean
  // The stored skills it can load, as found at its start or at the last "Configure role…" save: a
  // recompute rescans no disk.
  found: FoundFiles
  // What was last recorded for its session, for an agent that records.
  recorded?: { readonly session: string; readonly text: string }
  // A post was delivered since its last turn end: that turn end reads its transcript.
  posted: boolean
  // Told and held by the agent's teller until the session can be handed it: what it then holds.
  holding?: { readonly current: TeamText | null } | undefined
  posting: boolean
  again: boolean
}

let source: TeamSource | null = null
const held = new Map<string, Held>()
const settle = new TeamSettle((pane) => void recompute(pane), {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as NodeJS.Timeout),
})

export function setTeamSource(s: TeamSource): void {
  source = s
}

// ---------------------------------------------------------------- the parts and the CLI

let parts: Promise<{ common: string; part: Map<string, string> }> | null = null

async function partText(agent: TeamAgent): Promise<{ common: string; part: string }> {
  parts ??= readFile(join(skillsPluginDir(), 'team', 'common.md'), 'utf8').then((common) => ({
    common,
    part: new Map(),
  }))
  const loaded = await parts
  let part = loaded.part.get(agent.part)
  if (part === undefined) {
    part = await readFile(join(skillsPluginDir(), 'team', agent.part), 'utf8')
    loaded.part.set(agent.part, part)
  }
  return { common: loaded.common, part }
}

const VERSION_WAIT_MS = 5000
const versions = new Map<string, Promise<string | null>>()
let toldOld = false

function versionOf(cli: string, floor: VersionFloor): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      cli,
      ['--version'],
      // A CLI that ignores SIGTERM (an interactive shell) would hold the start waiting on it.
      { timeout: VERSION_WAIT_MS, killSignal: 'SIGKILL', env: { ...process.env, NO_COLOR: '1' } },
      (error, stdout) => {
        if (error) {
          log.warn('the agent CLI did not say its version', { cli, error })
          resolve(null)
        } else resolve(floor.read(withoutEscapes(stdout)))
      },
    )
  })
}

// Read once per binary, by its path and mtime: an update replaces the file.
async function flagsAllowed(cli: string, floor: VersionFloor | null): Promise<boolean> {
  if (!floor) return true
  let key = cli
  try {
    key = `${cli}\0${(await stat(cli)).mtimeMs}`
  } catch (error) {
    log.warn('the agent CLI could not be looked at', { cli, error })
  }
  let read = versions.get(key)
  if (!read) {
    read = versionOf(cli, floor)
    versions.set(key, read)
  }
  const version = await read
  if (version === null) return false
  if (floor.accepts(version)) return true
  if (!toldOld) {
    toldOld = true
    addNotice({ key: floor.notice, params: { version, floor: floor.version } })
  }
  return false
}

// ---------------------------------------------------------------- (1) and (2): a pane's start

export interface TeamStart {
  readonly pane: string
  readonly agent: Agent
  readonly cli: string
  readonly cwd: string | null
  readonly start: Start
  // The input, null when the tab's project is not in the mode.
  readonly input: (found: FoundFiles) => TeamInput | null
}

async function foundSkills(cwd: string | null): Promise<FoundFiles> {
  const user = agentPaths().claudeSkills
  const listed = await listSkills({ folders: cwd ? [cwd] : [], user })
  const found = new Map<string, string>()
  // The nearest of a name comes first, and is the one loaded.
  for (const s of foundFor(cwd ?? '', listed)) if (!found.has(s.name)) found.set(s.name, s.file)
  return found
}

// The file the command names, written before the command is built: a missing one stops Claude at
// once. Undefined when the pane starts without the team.
export async function startTeam(start: TeamStart): Promise<string | undefined> {
  const agent = kitOf(start.agent).team
  if (!agent) return undefined
  const found = await foundSkills(start.cwd)
  const input = start.input(found)
  const recorded =
    agent.records && start.start.kind === 'resume' ? await readRecorded(start.start.id) : null
  const keep = (started: TeamText | null, outside: boolean) => {
    const team: PaneTeam = { started, held: agent.heldAtStart(start.start, started, recorded) }
    held.set(start.pane, { team, outside, found, posted: false, posting: false, again: false })
  }
  // What it recorded may be older than its facts now: told once it can be.
  if (agent.records) settle.trigger(start.pane)
  if (!input) {
    keep(null, false)
    return undefined
  }
  if (!(await flagsAllowed(start.cli, agent.floor))) {
    log.warn('a pane starts without its team block: the agent CLI is too old', {
      pane: start.pane,
    })
    keep(null, true)
    return undefined
  }
  try {
    const { common, part } = await partText(agent)
    const text = teamText(input, agent, common, part)
    const dir = controlPaths().team
    await writeTextAtomic(dir, `${start.pane}.md`, text.block)
    keep(agent.startedWith ? agent.startedWith(start.start, text) : text, false)
    return join(dir, `${start.pane}.md`)
  } catch (error) {
    log.warn('a pane starts without its team block: its file was not written', {
      pane: start.pane,
      error,
    })
    keep(null, true)
    return undefined
  }
}

// "Configure role…" saved: what the pane's session can load is found again, then recomputed.
export async function teamFoundChanged(pane: string, cwd: string | null): Promise<void> {
  if (!held.has(pane)) return
  const found = await foundSkills(cwd)
  const h = held.get(pane)
  if (!h) return
  h.found = found
  settle.trigger(pane)
}

// Menkar's own skills are named with its plugin's prefix, as a block names them.
const OWN_PREFIX = 'menkar:'
const OWN_NAME = /^[a-z0-9][a-z0-9-]*$/

// A skill's file, for a session given its skills' text through Menkar's MCP: one of Menkar's own,
// or one of those found for the pane's session; null for any other name, an unknown one of Menkar's
// own included.
export async function skillFile(pane: string, name: string): Promise<string | null> {
  if (name.startsWith(OWN_PREFIX)) {
    const own = name.slice(OWN_PREFIX.length)
    if (!OWN_NAME.test(own)) return null
    const file = join(skillsPluginDir(), 'skills', own, 'SKILL.md')
    try {
      return (await stat(file)).isFile() ? file : null
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        log.warn("one of Menkar's skills could not be looked at", { pane, name, error })
      return null
    }
  }
  return held.get(pane)?.found.get(name) ?? null
}

export function forgetTeam(pane: string): void {
  held.delete(pane)
  settle.forget(pane)
}

// The session is gone from the user's data: what it held is not kept for a resume.
export async function forgetSessionTeam(sessionId: string): Promise<void> {
  await forgetRecorded(sessionId).catch((error: unknown) => {
    log.warn('a recorded team block could not be removed', { sessionId, error })
  })
}

// Written when it changed: what a resume of the session will start from.
async function record(h: Held, sessionId: string): Promise<void> {
  const text = JSON.stringify(h.team.held)
  if (h.recorded?.session === sessionId && h.recorded.text === text) return
  try {
    await writeRecorded(sessionId, h.team.held)
    h.recorded = { session: sessionId, text }
  } catch (error) {
    log.warn('what a session holds of its team could not be recorded', { sessionId, error })
  }
}

// ---------------------------------------------------------------- (3): telling a change

// Something that can change facts happened: every pane recomputes, once changes settle.
export function teamChanged(): void {
  for (const pane of held.keys()) settle.trigger(pane)
}

export function teamPaneChanged(pane: string): void {
  if (held.has(pane)) settle.trigger(pane)
}

export function teamStartRecord(
  pane: string,
  recorded: 'clear' | 'compact' | 'resume',
  sameSession: boolean,
): void {
  const h = held.get(pane)
  if (!h) return
  h.team = afterStartRecord(h.team, recorded, sameSession)
  settle.trigger(pane)
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

async function recompute(pane: string): Promise<void> {
  const h = held.get(pane)
  const s = source
  if (!h || !s || h.outside) return
  if (h.posting) {
    h.again = true
    return
  }
  const session = s.session(pane)
  const agent = session ? kitOf(session.agent).team : null
  if (!session || !agent) return
  // Recorded even for an agent Menkar cannot tell yet: a resume starts from what it holds.
  if (agent.records) await record(h, session.sessionId)
  const teller = mainKitOf(session.agent).team
  if (!teller) return
  const input = s.input(pane, h.found)
  let current: TeamText | null = null
  if (input) {
    const { common, part } = await partText(agent)
    current = teamText(input, agent, common, part)
  }
  const text = teamPost(h.team.held, current)
  if (!text) {
    // The facts went back to what the session holds: what was held would tell it otherwise.
    if (h.holding) {
      h.holding = undefined
      teller.withdraw?.(pane)
    }
    return
  }
  h.posting = true
  let outcome: TeamOutcome | 'error' = 'error'
  const holding = { current }
  const whenHeld = { pane, delivered: () => void heldDelivered(pane, h, holding) }
  try {
    outcome = await postWithTries(
      () => teller.tell(session.sessionId, text, s.counts(session.sessionId), current, whenHeld),
      sleep,
    )
  } catch (error) {
    log.warn('a team update could not be posted', { pane, error })
  } finally {
    h.posting = false
  }
  if (outcome === 'held') {
    h.holding = holding
    log.info('a team update is held until the session can take it', { pane })
  } else if (outcome === 'stored') {
    h.team = delivered(h.team, current)
    log.info('a team update was stored', { pane })
  } else if (outcome === 'posted') {
    h.team = delivered(h.team, current)
    h.posted = true
    log.info('a team update was posted', { pane })
    if (agent.records) await record(h, session.sessionId)
  } else if (outcome !== 'error') log.warn('a team update could not be posted', { pane, outcome })
  if (h.again) {
    h.again = false
    settle.trigger(pane)
  }
}

// What a teller held was handed to the session: it holds those facts now, unless a later update
// took that one's place.
async function heldDelivered(
  pane: string,
  h: Held,
  holding: { readonly current: TeamText | null },
): Promise<void> {
  if (held.get(pane) !== h || h.holding !== holding) return
  h.holding = undefined
  h.team = delivered(h.team, holding.current)
  h.posted = true
  log.info('a held team update was handed over', { pane })
  const session = source?.session(pane)
  if (session && kitOf(session.agent).team?.records) await record(h, session.sessionId)
}

// Whether the pane was delivered a team post since its last turn end; the turn end clears it.
export function teamTurnEnded(pane: string): boolean {
  const h = held.get(pane)
  if (!h) return false
  const posted = h.posted
  h.posted = false
  return posted
}
