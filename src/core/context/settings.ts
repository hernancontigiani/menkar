import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { agentPaths } from '../paths'
import { contextFiles } from './files'
import { SESSION_START_ARG, START_SOURCES, TURN_END_ARG } from './statusline'

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
  return typeof command === 'string' && command.trim() !== '' ? command : null
}

// Writes the two files a Claude session Menkar starts needs — its `--settings` file holding
// Menkar's statusline, its hooks and its MCP rules, and the command that statusline chains to — each only when it changed, and
// returns the path to pass as `--settings <path>`. Called before each Claude command line runs, so
// a statusline that moved, or a changed own statusline, heals on the next command.
export async function writeSessionSettings(statuslineCommand: string): Promise<string> {
  const settings = contextFiles.claudeSettings()
  await writeIfChanged(
    settings,
    `${JSON.stringify(
      {
        statusLine: statuslineObject(statuslineCommand),
        hooks: { ...sessionStartHooks(statuslineCommand), ...turnEndHooks(statuslineCommand) },
        // Menkar's own MCP tools run without a prompt: they only act on Menkar's tabs.
        permissions: { allow: ['mcp__menkar'] },
        // Menkar wakes a session it started through Claude Code's messaging; without this a
        // session that bypasses prompts would hold each message behind a card.
        crossSessionInbound: 'accept',
      },
      null,
      2,
    )}\n`,
  )
  const chained = await chainedCommand(statuslineCommand)
  await writeIfChanged(
    contextFiles.chainedStatusline(),
    `{"command": ${JSON.stringify(chained)}}\n`,
  )
  return settings
}

// A POSIX shell word: the value in single quotes, any single quote closed, escaped and reopened.
export function shellQuote(value: string): string {
  return /^[\w@%+=:,./-]+$/.test(value) ? value : `'${value.replaceAll("'", `'"'"'`)}'`
}
