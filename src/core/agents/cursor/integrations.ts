import { randomBytes } from 'node:crypto'
import {
  chmod,
  copyFile,
  mkdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileStamp, now } from '../../clock'
import { shellQuote } from '../../command'
import { contextFiles } from '../../context/files'
import { IntegrationError } from '../../context/integrations'
import { isJsonObject, type JsonObject, type JsonValue } from '../../context/settings'
import { flavorFacts } from '../../flavor'
import { t } from '../../i18n'
import { appDirs } from '../../paths'
import type { IntegrationContext, IntegrationItem, IntegrationItems } from '../types'
import { cursorConfigDir } from './config-dir'
import { addToArray, holds, parseSpans, removeFromArray, ShapeError } from './json-text'

// What Menkar may add to Cursor's own configuration, two pieces each turned on by the user and
// removable on its own (decision 1.140): its turn hooks in hooks.json, which run in every Cursor
// session, outside Menkar too, and the allow entries that spare its tools' approval card in
// cli-config.json. Each change edits the file's text in place, so the rest of it keeps its bytes,
// keeps the file's mode, writes through a symlink to its target, and keeps a dated copy first.
// What was added is recorded in Menkar's own data, and removing finds it by value and takes out
// only that: Cursor rewrites cli-config.json at each start, in its own layout, and drops any key it
// does not know, so nothing of Menkar's can be marked inside it.

// The program Cursor's hooks run, among those Menkar ships.
export const HOOK_PROGRAM = 'cursor-hook.js'

// The turn hooks a plugin's own hooks need beside them in the user's file to run at all; a plugin's
// sessionStart runs without one.
export const HOOK_EVENTS = ['beforeSubmitPrompt', 'stop', 'afterAgentResponse'] as const

// The key of Menkar's server in each pane's plugin folder.
export const SERVER_KEY = 'menkar'

// Cursor names a plugin's server after the plugin folder's basename, so every pane's folder shares
// one, and one set of allow entries covers them all. Each flavour's differs, so removing one
// flavour's entries never takes the other's.
export const pluginFolderName = (): string => flavorFacts().dirName

export const serverName = (): string => `plugin-${pluginFolderName()}-${SERVER_KEY}`

// Cursor reads hooks.json from the home's .cursor whatever its config folder is.
const hooksFile = (): string => join(homedir(), '.cursor', 'hooks.json')

const configFile = (): string => join(cursorConfigDir(), 'cli-config.json')

// Cursor waits for a hook before going on, and skips one that fails; a hung program then costs a
// turn this many seconds per event. An entry never fails closed, which would stop the turn.
export const HOOK_TIMEOUT = 3

// What Cursor's hook entries run: Electron's binary as Node, through env(1) so the variable does
// not reach anything else Cursor starts.
export function hookCommand(ctx: IntegrationContext): string {
  return ['/usr/bin/env', 'ELECTRON_RUN_AS_NODE=1', ctx.execPath, join(ctx.programs, HOOK_PROGRAM)]
    .map(shellQuote)
    .join(' ')
}

interface Entry {
  readonly path: readonly string[]
  readonly item: JsonValue
}

interface Recorded {
  readonly path: string[]
  readonly item: JsonValue
  readonly created: number
}

interface Record {
  readonly file: string
  // The text Menkar created the file with, when the file was not there: removing deletes the file
  // only while it still holds exactly that.
  readonly createdAs: string | null
  readonly entries: Recorded[]
}

interface Piece {
  readonly key: string
  readonly file: () => string
  // The text to create a missing file with; null refuses, the file being Cursor's to create.
  readonly missing: string | null
  readonly entries: (ctx: IntegrationContext) => readonly Entry[]
}

const recordFile = (): string => join(appDirs().data, 'cursor-integrations.json')

async function readRecords(): Promise<JsonObject> {
  try {
    const value: unknown = JSON.parse(await readFile(recordFile(), 'utf8'))
    return isJsonObject(value) ? value : {}
  } catch {
    return {} // no record yet, or one that cannot be read: nothing installed
  }
}

function recordOf(records: JsonObject, key: string): Record | null {
  const value = records[key]
  if (!isJsonObject(value) || typeof value.file !== 'string' || !Array.isArray(value.entries))
    return null
  return value as unknown as Record
}

async function writeRecord(key: string, record: Record | null): Promise<void> {
  const records = await readRecords()
  if (record) records[key] = record as unknown as JsonValue
  else delete records[key]
  await writeWhole(recordFile(), `${JSON.stringify(records, null, 2)}\n`, 0o644)
}

async function writeWhole(path: string, text: string, mode: number): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporary = join(dirname(path), `.tmp-${basename(path)}-${randomBytes(4).toString('hex')}`)
  try {
    await writeFile(temporary, text, { mode })
    await chmod(temporary, mode)
    await rename(temporary, path)
  } catch (error) {
    await rm(temporary, { force: true })
    throw error
  }
}

// The file's real path (a symlinked dotfile is written at its target), its text and mode; null
// text when it does not exist.
async function readTarget(
  path: string,
): Promise<{ path: string; text: string | null; mode: number }> {
  let real = path
  try {
    real = await realpath(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      throw new IntegrationError(t('integrations.unreadable', { path }))
  }
  try {
    const [text, info] = await Promise.all([readFile(real, 'utf8'), stat(real)])
    return { path: real, text, mode: info.mode & 0o7777 }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return { path: real, text: null, mode: 0o644 }
    throw new IntegrationError(t('integrations.unreadable', { path }))
  }
}

function checkJson(text: string, path: string): void {
  try {
    if (parseSpans(text).kind !== 'object')
      throw new IntegrationError(t('integrations.notObject', { path }))
  } catch (error) {
    if (error instanceof IntegrationError) throw error
    throw new IntegrationError(t('integrations.notJson', { path }))
  }
}

async function backUp(path: string, key: string): Promise<void> {
  const backups = contextFiles.settingsBackups()
  await mkdir(backups, { recursive: true })
  await copyFile(path, join(backups, `${key}-${fileStamp(now())}.json`))
}

function holdsAll(text: string, entries: readonly Recorded[]): boolean {
  try {
    return entries.every((e) => holds(text, e.path, e.item))
  } catch {
    return false // a file that is no longer JSON holds nothing of Menkar's
  }
}

async function isOn(piece: Piece): Promise<boolean> {
  const record = recordOf(await readRecords(), piece.key)
  if (!record) return false
  try {
    const { text } = await readTarget(record.file)
    return text !== null && holdsAll(text, record.entries)
  } catch (error) {
    if (error instanceof IntegrationError) return false
    throw error
  }
}

// Takes out what the record says Menkar added and is still there; the rest of the text is kept.
function withdraw(text: string, record: Record): string {
  let result = text
  for (const entry of [...record.entries].reverse())
    result = removeFromArray(result, entry.path, entry.item, entry.created)
  return result
}

async function install(piece: Piece, ctx: IntegrationContext): Promise<void> {
  if (await isOn(piece)) return
  const target = await readTarget(piece.file())
  const shown = piece.file()
  let text = target.text
  let createdAs: string | null = null
  if (text === null) {
    if (piece.missing === null)
      throw new IntegrationError(t('integrations.cursorNoFile', { path: shown }))
    text = createdAs = piece.missing
  } else {
    checkJson(text, shown)
    await backUp(target.path, piece.key)
  }
  const previous = recordOf(await readRecords(), piece.key)
  if (previous && previous.file === target.path) {
    text = withdraw(text, previous)
    createdAs = previous.createdAs
  }
  const entries: Recorded[] = []
  try {
    for (const entry of piece.entries(ctx)) {
      const added = addToArray(text, entry.path, entry.item)
      text = added.text
      if (added.added)
        entries.push({ path: [...entry.path], item: entry.item, created: added.created })
    }
  } catch (error) {
    if (error instanceof ShapeError)
      throw new IntegrationError(t('integrations.cursorShape', { path: shown, key: error.message }))
    throw error
  }
  await writeWhole(target.path, text, target.mode)
  await writeRecord(piece.key, { file: target.path, createdAs, entries })
}

async function remove(piece: Piece): Promise<void> {
  const record = recordOf(await readRecords(), piece.key)
  if (!record) return
  const target = await readTarget(record.file)
  if (target.text !== null) {
    let left: string
    try {
      left = withdraw(target.text, record)
    } catch {
      throw new IntegrationError(t('integrations.notJson', { path: record.file }))
    }
    if (left !== target.text || record.createdAs !== null) await backUp(target.path, piece.key)
    if (record.createdAs !== null && left === record.createdAs) await rm(target.path)
    else if (left !== target.text) await writeWhole(target.path, left, target.mode)
  }
  await writeRecord(piece.key, null)
}

const HOOKS: Piece = {
  key: 'cursor-hooks',
  file: hooksFile,
  missing: `${JSON.stringify({ version: 1 }, null, 2)}\n`,
  entries: (ctx) => {
    const command = hookCommand(ctx)
    return HOOK_EVENTS.map((event) => ({
      path: ['hooks', event],
      item: { command, timeout: HOOK_TIMEOUT },
    }))
  },
}

const ALLOW: Piece = {
  key: 'cursor-allow',
  file: configFile,
  missing: null,
  // One entry for every tool of Menkar's server, those added later included.
  entries: () => [{ path: ['permissions', 'allow'], item: `Mcp(${serverName()}:*)` }],
}

function item(
  piece: Piece,
  title: IntegrationItem['title'],
  subtitle: IntegrationItem['subtitle'],
): IntegrationItem {
  return {
    key: piece.key,
    title,
    subtitle,
    on: () => isOn(piece),
    set: (on, ctx) => (on ? install(piece, ctx) : remove(piece)),
  }
}

export const integrations: IntegrationItems = {
  title: 'integrations.cursorSettings',
  description: 'integrations.cursorSettingsDescription',
  items: [
    item(HOOKS, 'integrations.cursorHooks', 'integrations.cursorHooksSubtitle'),
    item(ALLOW, 'integrations.cursorAllow', 'integrations.cursorAllowSubtitle'),
  ],
}
