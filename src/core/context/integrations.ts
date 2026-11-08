import { copyFile, mkdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileStamp, now } from '../clock'
import { t } from '../i18n'
import { agentPaths } from '../paths'
import { contextFiles } from './files'
import {
  isJsonObject,
  type JsonObject,
  jsonEqual,
  statuslineObject,
  writeAtomic,
  writeSessionSettings,
} from './settings'

// What Menkar may add to Claude Code's own settings, one piece at a time, each turned on by the
// user and removable on its own. Today one piece: Menkar's statusline in every Claude session,
// including the ones started outside Menkar. Turning it on keeps a dated copy of the file and
// records what it wrote and what it replaced; turning it off puts that back, only if the file still
// holds what Menkar wrote.

// A change refused; its message is our own sentence for the user.
export class IntegrationError extends Error {}

async function readSettings(): Promise<JsonObject> {
  const path = agentPaths().claudeSettings
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw new IntegrationError(t('integrations.unreadable', { path }))
  }
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new IntegrationError(t('integrations.notJson', { path }))
  }
  if (!isJsonObject(value)) throw new IntegrationError(t('integrations.notObject', { path }))
  return value
}

async function readRecord(): Promise<JsonObject> {
  try {
    const value: unknown = JSON.parse(await readFile(contextFiles.integrationsRecord(), 'utf8'))
    return isJsonObject(value) ? value : {}
  } catch {
    return {} // no record yet, or one that cannot be read: nothing installed
  }
}

const writeJson = (path: string, data: JsonObject) =>
  writeAtomic(path, `${JSON.stringify(data, null, 2)}\n`)

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  )
}

// On if and only if an install is recorded and the file still holds exactly what it wrote. A file
// that cannot be read reads as off.
export async function statuslineInstalled(): Promise<boolean> {
  const entry = (await readRecord()).statusline
  if (!isJsonObject(entry)) return false
  try {
    return jsonEqual((await readSettings()).statusLine, entry.installed)
  } catch (error) {
    if (error instanceof IntegrationError) return false
    throw error
  }
}

export async function installStatusline(statuslineCommand: string): Promise<void> {
  const path = agentPaths().claudeSettings
  const settings = await readSettings()
  const ours = statuslineObject(statuslineCommand)
  if (jsonEqual(settings.statusLine, ours) && (await statuslineInstalled())) return
  if (await exists(path)) {
    const backups = contextFiles.settingsBackups()
    await mkdir(backups, { recursive: true })
    await copyFile(path, join(backups, `settings-${fileStamp(now())}.json`))
  }
  const previous = settings.statusLine
  const entry: JsonObject = {
    installed: ours,
    // Never "restore" Menkar's own statusline on removal.
    previous: previous === undefined || jsonEqual(previous, ours) ? null : previous,
  }
  settings.statusLine = ours
  await writeJson(path, settings)
  await writeJson(contextFiles.integrationsRecord(), { ...(await readRecord()), statusline: entry })
  await writeSessionSettings(statuslineCommand)
}

export async function removeStatusline(statuslineCommand: string): Promise<void> {
  const path = agentPaths().claudeSettings
  const record = await readRecord()
  const entry = record.statusline
  if (!isJsonObject(entry)) return
  const settings = await readSettings()
  if (!jsonEqual(settings.statusLine, entry.installed)) {
    throw new IntegrationError(t('integrations.changed', { path }))
  }
  const previous = entry.previous
  if (previous === undefined || previous === null) delete settings.statusLine
  else settings.statusLine = previous
  await writeJson(path, settings)
  delete record.statusline
  await writeJson(contextFiles.integrationsRecord(), record)
  await writeSessionSettings(statuslineCommand)
}
