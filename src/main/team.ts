import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { controlPaths, writeTextAtomic } from '../core/control/files'
import { type PostOutcome, postToSession } from '../core/control/post'
import { log } from '../core/log'
import type { WorkCounts } from '../core/orchestration/counts'
import { agentPaths } from '../core/paths'
import type { Agent } from '../core/sessions/lines'
import type { TeamAgent, TeamInput } from '../core/team/block'
import { teamAgent } from '../core/team/block'
import { teamText } from '../core/team/input'
import {
  afterStartRecord,
  delivered,
  type PaneTeam,
  postWithTries,
  TeamSettle,
  type TeamText,
  teamAtStart,
  teamPost,
} from '../core/team/posts'
import { foundFor, listSkills } from '../core/team/skills'
import { claudeVersion, TEAM_FLOOR, teamFlagsAllowed } from '../core/team/version'
import { skillsPluginDir } from './control'
import { addNotice } from './projects'

// Main's side of the team block (plan 40): (1) what a pane's session holds from its start, (2) how
// a start delivers it for Claude (a file and two flags), (3) how a change is told (a post). What a
// session's facts are is the window's state: `setTeamSource` gives it.

export interface TeamSource {
  // The session's input now, null when it is in no project with the mode on.
  input(pane: string, found: (skill: string) => boolean): TeamInput | null
  // The pane's agent and session, null once the pane is gone or has no session yet.
  session(pane: string): { readonly agent: Agent; readonly sessionId: string } | null
  // The orchestrator's counts, which close every text Menkar sends it.
  counts(sessionId: string): WorkCounts | undefined
}

interface Held {
  team: PaneTeam
  // Started below the floor or without its file: never posted, for its life.
  readonly outside: boolean
  // The stored skills it can load, as found at its start: a recompute rescans no disk.
  readonly found: ReadonlySet<string>
  // A post was delivered since its last turn end: that turn end reads its transcript.
  posted: boolean
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

function versionOf(cli: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(cli, ['--version'], { timeout: VERSION_WAIT_MS }, (error, stdout) => {
      if (error) {
        log.warn('the agent CLI did not say its version', { cli, error })
        resolve(null)
      } else resolve(claudeVersion(stdout))
    })
  })
}

// Read once per binary, by its path and mtime: an update replaces the file.
async function flagsAllowed(cli: string): Promise<boolean> {
  let key = cli
  try {
    key = `${cli}\0${(await stat(cli)).mtimeMs}`
  } catch (error) {
    log.warn('the agent CLI could not be looked at', { cli, error })
  }
  let read = versions.get(key)
  if (!read) {
    read = versionOf(cli)
    versions.set(key, read)
  }
  const version = await read
  if (version === null) return false
  if (teamFlagsAllowed(version)) return true
  if (!toldOld) {
    toldOld = true
    addNotice({ key: 'team.oldClaude', params: { version, floor: TEAM_FLOOR } })
  }
  return false
}

// ---------------------------------------------------------------- (1) and (2): a pane's start

export interface TeamStart {
  readonly pane: string
  readonly agent: Agent
  readonly cli: string
  readonly cwd: string | null
  readonly fork: boolean
  // The input, null when the tab's project is not in the mode.
  readonly input: (found: (skill: string) => boolean) => TeamInput | null
}

async function foundSkills(cwd: string | null): Promise<Set<string>> {
  const user = agentPaths().claudeSkills
  const listed = await listSkills({ folders: cwd ? [cwd] : [], user })
  return new Set(foundFor(cwd ?? '', listed).map((s) => s.name))
}

// The file the command names, written before the command is built: a missing one stops Claude at
// once. Undefined when the pane starts without the team.
export async function startTeam(start: TeamStart): Promise<string | undefined> {
  const agent = teamAgent(start.agent)
  if (!agent) return undefined
  const found = await foundSkills(start.cwd)
  const input = start.input((skill) => found.has(skill))
  const keep = (team: PaneTeam, outside: boolean) =>
    held.set(start.pane, { team, outside, found, posted: false, posting: false, again: false })
  if (!input) {
    keep(teamAtStart(null, start.fork), false)
    return undefined
  }
  if (!(await flagsAllowed(start.cli))) {
    log.warn('a pane starts without its team block: the agent CLI is too old', {
      pane: start.pane,
    })
    keep(teamAtStart(null, start.fork), true)
    return undefined
  }
  try {
    const { common, part } = await partText(agent)
    const text = teamText(input, agent, common, part)
    const dir = controlPaths().team
    await writeTextAtomic(dir, `${start.pane}.md`, text.block)
    keep(teamAtStart(text, start.fork), false)
    return join(dir, `${start.pane}.md`)
  } catch (error) {
    log.warn('a pane starts without its team block: its file was not written', {
      pane: start.pane,
      error,
    })
    keep(teamAtStart(null, start.fork), true)
    return undefined
  }
}

export function forgetTeam(pane: string): void {
  held.delete(pane)
  settle.forget(pane)
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
  const agent = session ? teamAgent(session.agent) : null
  if (!session || !agent) return
  const found = h.found
  const input = s.input(pane, (skill) => found.has(skill))
  let current: TeamText | null = null
  if (input) {
    const { common, part } = await partText(agent)
    current = teamText(input, agent, common, part)
  }
  const text = teamPost(h.team.held, current)
  if (!text) return
  h.posting = true
  let outcome: PostOutcome | 'error' = 'error'
  try {
    outcome = await postWithTries(
      () =>
        postToSession(
          agentPaths().claudeSessions,
          session.sessionId,
          text,
          randomUUID(),
          s.counts(session.sessionId),
        ),
      sleep,
    )
  } catch (error) {
    log.warn('a team update could not be posted', { pane, error })
  } finally {
    h.posting = false
  }
  if (outcome === 'posted') {
    h.team = delivered(h.team, current)
    h.posted = true
    log.info('a team update was posted', { pane })
  } else if (outcome !== 'error') log.warn('a team update could not be posted', { pane, outcome })
  if (h.again) {
    h.again = false
    settle.trigger(pane)
  }
}

// Whether the pane was delivered a team post since its last turn end; the turn end clears it.
export function teamTurnEnded(pane: string): boolean {
  const h = held.get(pane)
  if (!h) return false
  const posted = h.posted
  h.posted = false
  return posted
}
