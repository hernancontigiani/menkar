import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { agentPaths, projectSessionSettingsFile } from '../paths'
import { contextFiles } from './files'
import {
  inboxDir,
  PANE_ENV,
  PROMPT_SUBMIT_ARG,
  SESSION_START_ARG,
  START_SOURCES,
  TURN_END_ARG,
} from './statusline'

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }
export type JsonObject = { [key: string]: JsonValue }

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Equal as JSON values: key order does not matter.
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, i) => jsonEqual(value, b[i]))
  }
  if (isJsonObject(a) && isJsonObject(b)) {
    const keys = Object.keys(a)
    return (
      keys.length === Object.keys(b).length && keys.every((k) => k in b && jsonEqual(a[k], b[k]))
    )
  }
  return false
}

// Menkar's statusline as Claude Code's settings declare it.
export function statuslineObject(command: string): JsonObject {
  return { type: 'command', command }
}

// The SessionStart hook of the sessions Menkar starts: the statusline's own script notes a new
// session and a compaction, for the bar's cost since the last compaction. Only in `--settings`,
// never in ~/.claude/settings.json. Claude Code matches each entry against the start's `source`.
export function sessionStartHooks(statuslineCommand: string): JsonObject {
  const command = `${statuslineCommand} ${SESSION_START_ARG}`
  return {
    SessionStart: START_SOURCES.map((source) => ({
      matcher: source,
      hooks: [{ type: 'command', command }],
    })),
  }
}

// The Stop hook: the same script tells Menkar each turn's end in its pane.
export function turnEndHooks(statuslineCommand: string): JsonObject {
  return {
    Stop: [{ hooks: [{ type: 'command', command: `${statuslineCommand} ${TURN_END_ARG}` }] }],
  }
}

// The orchestrator's prompt hook. Declared in every session Menkar starts, since the orchestrator's
// mark can move to a running session, which never re-reads its settings; the guard keeps a pane
// with no inbox file from starting the program at all. Past its timeout Claude Code lets the prompt
// go on and discards the output.
export function promptSubmitHooks(statuslineCommand: string): JsonObject {
  const file = `${shellQuote(inboxDir())}/"$${PANE_ENV}".json`
  const command = `if [ -f ${file} ]; then ${statuslineCommand} ${PROMPT_SUBMIT_ARG}; fi`
  return { UserPromptSubmit: [{ hooks: [{ type: 'command', command, timeout: 5 }] }] }
}

async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return null // missing or unreadable: read as nothing
  }
}

async function readObject(path: string): Promise<JsonObject | null> {
  const text = await readText(path)
  if (text === null) return null
  try {
    const value: unknown = JSON.parse(text)
    return isJsonObject(value) ? value : null
  } catch {
    return null
  }
}

// The whole file or nothing: a `.tmp-` file in the same directory, renamed over the target.
export async function writeAtomic(path: string, text: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporary = join(dirname(path), `.tmp-${basename(path)}-${randomBytes(4).toString('hex')}`)
  try {
    await writeFile(temporary, text)
    await rename(temporary, path)
  } catch (error) {
    await rm(temporary, { force: true })
    throw error
  }
}

// Writes only when the content would change, so an unchanged file keeps its modification time.
export async function writeIfChanged(path: string, text: string): Promise<boolean> {
  if ((await readText(path)) === text) return false
  await writeAtomic(path, text)
  return true
}

// The user's own statusline command, which Menkar's statusline runs and shows instead of its own
// bar: the one the global install replaced, else the one `--settings` outranks in ~/.claude.
export async function chainedCommand(ownCommand: string): Promise<string | null> {
  const record = await readObject(contextFiles.integrationsRecord())
  const entry = record?.statusline
  let candidate: JsonValue | undefined = isJsonObject(entry) ? entry.previous : undefined
  if (candidate === undefined || candidate === null) {
    candidate = (await readObject(agentPaths().claudeSettings))?.statusLine
  }
  if (!isJsonObject(candidate) || jsonEqual(candidate, statuslineObject(ownCommand))) return null
  const command = candidate.command
  return typeof command === 'string' && command.trim() !== '' && !isMenkarStatusline(command)
    ? command
    : null
}

// Any Menkar's statusline, of either flavour, installed or a development build: chaining to it
// would log this Menkar's sessions into the other's files, or run the two in a loop.
function isMenkarStatusline(command: string): boolean {
  return (
    /(^|\s)ELECTRON_RUN_AS_NODE=1\s/.test(command) &&
    /\/out\/main\/statusline\.js'?(\s|$)/.test(command)
  )
}

// Writes the two files a Claude session Menkar starts needs — its `--settings` file holding
// Menkar's statusline, its hooks and its MCP rules, and the command that statusline chains to — each
// only when it changed, and returns the path to pass as `--settings <path>`. Called before each
// Claude command line runs, so a statusline that moved, or a changed own statusline, heals on the
// next command. A project's session gets a file of its own that also grants its files folder:
// `--add-dir` would stop the session at a trust dialog whose default answer exits.
export async function writeSessionSettings(
  statuslineCommand: string,
  project?: { readonly id: string; readonly folder: string },
): Promise<string> {
  // Menkar's own MCP tools run without a prompt: they only act on Menkar's tabs.
  const allow = ['mcp__menkar']
  const base: JsonObject = {
    statusLine: statuslineObject(statuslineCommand),
    hooks: {
      ...sessionStartHooks(statuslineCommand),
      ...turnEndHooks(statuslineCommand),
      ...promptSubmitHooks(statuslineCommand),
    },
    permissions: { allow },
    // Menkar wakes a session it started through Claude Code's messaging; without this a
    // session that bypasses prompts would hold each message behind a card.
    crossSessionInbound: 'accept',
  }
  const asText = (value: JsonObject) => `${JSON.stringify(value, null, 2)}\n`
  const settings = contextFiles.claudeSettings()
  await writeIfChanged(settings, asText(base))
  const chained = await chainedCommand(statuslineCommand)
  await writeIfChanged(
    contextFiles.chainedStatusline(),
    `{"command": ${JSON.stringify(chained)}}\n`,
  )
  if (!project) return settings
  const own = projectSessionSettingsFile(project.id)
  await writeIfChanged(
    own,
    asText({
      ...base,
      permissions: { allow, additionalDirectories: [project.folder] },
    }),
  )
  return own
}

// A POSIX shell word: the value in single quotes, any single quote closed, escaped and reopened.
export function shellQuote(value: string): string {
  return /^[\w@%+=:,./-]+$/.test(value) ? value : `'${value.replaceAll("'", `'"'"'`)}'`
}
