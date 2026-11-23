// Cursor's turn hooks for the sessions Menkar starts: the entries the user accepted in
// ~/.cursor/hooks.json run it at each prompt, each reply and each turn's end, with the event's JSON
// on stdin. Those entries run in every Cursor session, outside Menkar too, so it acts only in a
// pane this Menkar started, and exits at once anywhere else. Cursor waits for a hook before going
// on, so it never waits for anything itself, and whatever goes wrong it prints nothing and exits 0:
// a hook that fails or answers late is skipped, never shown.
//
// What it keeps is Menkar's own: one line per prompt and per turn's end in the hook log (times,
// ids, tokens; never the text, never the account's email Cursor sends with every event), the turn-
// end record main reads, and the prompt's text only while the classifier is on.
import { appendFileSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { classifySince } from '../../classifier/settings'
import { now } from '../../clock'
import { controlPaths } from '../../control/files'
import { FLAVOR_ENV, flavor } from '../../flavor'
import { appDirs } from '../../paths'
import { statePath } from '../../state'
import { writeTurnEnd } from '../shared/turn-end'

export const HOOK_LOG = 'cursor-turns.jsonl'
// The prompts' text, one file per turn, apart from the log: removing it never rewrites a file the
// hooks append to.
export const PROMPTS_DIR = 'cursor-prompts'

// The keys of the log's lines, in the order written; the usage source reads these and no other.
export const PROMPT_KEYS = ['event', 'at', 'session_id', 'generation_id', 'origin'] as const
export const STOP_KEYS = [
  'event',
  'at',
  'session_id',
  'generation_id',
  'status',
  'loop_count',
  'model',
  'input_tokens',
  'output_tokens',
  'cache_read_tokens',
  'cache_write_tokens',
] as const

export interface HookPaths {
  // The hook log and the prompts' folder live in Menkar's cache folder.
  readonly cache: string
  readonly turnEnds: string
  readonly state: string
}

export const hookPaths = (): HookPaths => ({
  cache: appDirs().cache,
  turnEnds: controlPaths().turnEnds,
  state: statePath(),
})

// A turn Menkar's own message opened, not the human.
const MENKAR_POST = '[Menkar]'
const PANE = 'MENKAR_PANE'

const plainId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value)

// The pane this program may act for: one a Menkar of its own flavour started. A pane of the daily
// Menkar carries no flavour.
export function ownPane(env: NodeJS.ProcessEnv): string | null {
  const pane = env[PANE]
  if (!plainId(pane)) return null
  return (env[FLAVOR_ENV] || 'menkar') === flavor() ? pane : null
}

// Whether the classifier is on now, as the app's state says: the prompt's text is kept only then.
export function classifierOn(state: string): boolean {
  try {
    const value: unknown = JSON.parse(readFileSync(state, 'utf8'))
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
    return classifySince(value as Record<string, unknown>) !== null
  } catch {
    return false // no state yet, or one being replaced: off, so nothing is kept
  }
}

const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0

function append(cache: string, line: Record<string, unknown>): void {
  mkdirSync(cache, { recursive: true })
  appendFileSync(join(cache, HOOK_LOG), `${JSON.stringify(line)}\n`)
}

function keepPrompt(cache: string, generation: string, text: string): void {
  const dir = join(cache, PROMPTS_DIR)
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  const temporary = join(dir, `.tmp-${generation}-${process.pid}`)
  try {
    writeFileSync(temporary, text, { mode: 0o600 })
    renameSync(temporary, join(dir, `${generation}.txt`))
  } catch (error) {
    rmSync(temporary, { force: true })
    throw error
  }
}

function prompt(payload: Record<string, unknown>, paths: HookPaths): void {
  const { session_id: session, generation_id: generation, prompt: text } = payload
  if (!plainId(session) || !plainId(generation)) return
  const said = typeof text === 'string' ? text : ''
  const line: Record<(typeof PROMPT_KEYS)[number], unknown> = {
    event: 'prompt',
    at: now() / 1000,
    session_id: session,
    generation_id: generation,
    origin: said.trimStart().startsWith(MENKAR_POST) ? 'peer' : 'human',
  }
  append(paths.cache, line)
  if (said !== '' && classifierOn(paths.state)) keepPrompt(paths.cache, generation, said)
}

function stop(payload: Record<string, unknown>, pane: string, paths: HookPaths): void {
  const { session_id: session, generation_id: generation } = payload
  if (!plainId(session)) return
  const line: Record<(typeof STOP_KEYS)[number], unknown> = {
    event: 'stop',
    at: now() / 1000,
    session_id: session,
    generation_id: plainId(generation) ? generation : null,
    status: typeof payload.status === 'string' ? payload.status.slice(0, 40) : null,
    loop_count: count(payload.loop_count),
    model: typeof payload.model === 'string' ? payload.model.slice(0, 100) : null,
    input_tokens: count(payload.input_tokens),
    output_tokens: count(payload.output_tokens),
    cache_read_tokens: count(payload.cache_read_tokens),
    cache_write_tokens: count(payload.cache_write_tokens),
  }
  append(paths.cache, line)
  writeTurnEnd(paths.turnEnds, pane, session)
}

// One event; what Cursor is to read on stdout, '' for nothing.
export function runHook(
  stdin: string,
  env: NodeJS.ProcessEnv = process.env,
  paths: HookPaths = hookPaths(),
): string {
  const pane = ownPane(env)
  if (pane === null) return ''
  try {
    const payload: unknown = JSON.parse(stdin)
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return ''
    const event = (payload as Record<string, unknown>).hook_event_name
    if (event === 'beforeSubmitPrompt') prompt(payload as Record<string, unknown>, paths)
    else if (event === 'stop') stop(payload as Record<string, unknown>, pane, paths)
  } catch {
    // A bad payload or a full disk costs Menkar a record, never the user's turn.
  }
  return ''
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Outside a pane of its own, stdin is not even read.
  if (ownPane(process.env) !== null) {
    let stdin = ''
    try {
      stdin = readFileSync(0, 'utf8')
    } catch {
      // no stdin: nothing to record
    }
    const out = runHook(stdin)
    if (out) process.stdout.write(out)
  }
}
