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
import type { RetentionStatus } from './types'

// What Menkar may add to Claude Code's own settings, one piece at a time, each turned on by the
// user and removable on its own: Menkar's statusline in every Claude session, including the ones
// started outside Menkar, and a longer transcript retention. Turning it on keeps a dated copy of the file and
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

// A dated byte copy of the user's file before Menkar changes it.
async function backUp(path: string): Promise<void> {
  if (!(await exists(path))) return
  const backups = contextFiles.settingsBackups()
  await mkdir(backups, { recursive: true })
  await copyFile(path, join(backups, `settings-${fileStamp(now())}.json`))
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
  await backUp(path)
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

// Transcript retention: Claude Code deletes a transcript 30 days after its last change unless
// cleanupPeriodDays says otherwise. Ten years reads as "keep them" and stays an ordinary number;
// 0 does not mean forever there.
export const RETENTION_DAYS = 3650

export async function retentionInstalled(): Promise<boolean> {
  const entry = (await readRecord()).retention
  if (!isJsonObject(entry)) return false
  try {
    return jsonEqual((await readSettings()).cleanupPeriodDays, entry.installed)
  } catch (error) {
    if (error instanceof IntegrationError) return false
    throw error
  }
}

// A larger value the user already set is kept: turning retention on never shortens it.
export async function installRetention(): Promise<void> {
  const path = agentPaths().claudeSettings
  const settings = await readSettings()
  if (await retentionInstalled()) return
  const previous = settings.cleanupPeriodDays
  const ours = typeof previous === 'number' && previous > RETENTION_DAYS ? previous : RETENTION_DAYS
  await backUp(path)
  settings.cleanupPeriodDays = ours
  await writeJson(path, settings)
  await writeJson(contextFiles.integrationsRecord(), {
    ...(await readRecord()),
    retention: { installed: ours, previous: previous === undefined ? null : previous },
  })
}

export async function removeRetention(): Promise<void> {
  const path = agentPaths().claudeSettings
  const record = await readRecord()
  const entry = record.retention
  if (!isJsonObject(entry)) return
  const settings = await readSettings()
  if (!jsonEqual(settings.cleanupPeriodDays, entry.installed)) {
    throw new IntegrationError(t('integrations.retentionChanged', { path }))
  }
  const previous = entry.previous
  if (previous === undefined || previous === null) delete settings.cleanupPeriodDays
  else settings.cleanupPeriodDays = previous
  await writeJson(path, settings)
  delete record.retention
  await writeJson(contextFiles.integrationsRecord(), record)
}

// Claude Code's documented default for cleanupPeriodDays, which applies while the key is absent.
// It is never shown as if it came from the file.
export const CLAUDE_DEFAULT_CLEANUP_DAYS = 30

// How long Claude Code keeps transcripts now, read from its settings and never written.
export async function retentionStatus(): Promise<RetentionStatus> {
  const path = agentPaths().claudeSettings
  let settings: JsonObject
  try {
    settings = await readSettings()
  } catch (error) {
    if (error instanceof IntegrationError) return { kind: 'unreadable', path }
    throw error
  }
  const days = settings.cleanupPeriodDays
  if (days === undefined) return { kind: 'unset', defaultDays: CLAUDE_DEFAULT_CLEANUP_DAYS }
  if (typeof days !== 'number' || !Number.isFinite(days)) return { kind: 'unreadable', path }
  const on = await retentionInstalled()
  const entry = (await readRecord()).retention
  const ours = on && isJsonObject(entry) && !jsonEqual(entry.previous, entry.installed)
  return { kind: 'days', days, by: ours ? 'menkar' : 'user', on }
}
