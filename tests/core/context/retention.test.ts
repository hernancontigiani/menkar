// Transcript retention in ~/.claude/settings.json (2026-11-10): cleanupPeriodDays raised with the
// user's consent, put back on removal, every other key left as it was.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { contextFiles } from '../../../src/core/context/files'
import {
  CLAUDE_DEFAULT_CLEANUP_DAYS,
  IntegrationError,
  installRetention,
  installStatusline,
  RETENTION_DAYS,
  removeRetention,
  removeStatusline,
  retentionInstalled,
  retentionStatus,
  statuslineInstalled,
} from '../../../src/core/context/integrations'
import { agentPaths } from '../../../src/core/paths'

const COMMAND = "ELECTRON_RUN_AS_NODE=1 '/opt/Menkar/menkar' '/opt/Menkar/statusline.js'"
const settingsPath = () => agentPaths().claudeSettings

function userSettings(content: string | null) {
  mkdirSync(dirname(settingsPath()), { recursive: true })
  if (content === null) rmSync(settingsPath(), { force: true })
  else writeFileSync(settingsPath(), content)
}

const settings = () => JSON.parse(readFileSync(settingsPath(), 'utf8'))
const record = () => JSON.parse(readFileSync(contextFiles.integrationsRecord(), 'utf8'))
const backups = () =>
  existsSync(contextFiles.settingsBackups()) ? readdirSync(contextFiles.settingsBackups()) : []

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 10, 9, 30, 0))
  for (const path of [
    contextFiles.integrationsRecord(),
    contextFiles.settingsBackups(),
    contextFiles.chainedStatusline(),
    contextFiles.claudeSettings(),
  ]) {
    rmSync(path, { recursive: true, force: true })
  }
  userSettings(null)
})

afterEach(() => {
  vi.useRealTimers()
})

test('retention is ten years', () => {
  expect(RETENTION_DAYS).toBe(3650)
})

test('retention: off with no record, and reading it writes nothing', async () => {
  userSettings('{"cleanupPeriodDays": 3650}')
  expect(await retentionInstalled()).toBe(false)
  expect(existsSync(contextFiles.integrationsRecord())).toBe(false)
})

test('retention: on raises cleanupPeriodDays, backs the file up, keeps the other keys; off puts the old value back', async () => {
  userSettings('{"model":"opus","cleanupPeriodDays":30}')
  await installRetention()
  expect(settings()).toEqual({ model: 'opus', cleanupPeriodDays: 3650 })
  expect(record()).toEqual({ retention: { installed: 3650, previous: 30 } })
  expect(backups()).toEqual(['settings-20261110-093000.json'])
  expect(await retentionInstalled()).toBe(true)
  await removeRetention()
  expect(settings()).toEqual({ model: 'opus', cleanupPeriodDays: 30 })
  expect(record()).toEqual({})
  expect(await retentionInstalled()).toBe(false)
})

test('retention: with no key before, off deletes the key; with no file before, on creates it', async () => {
  await installRetention()
  expect(settings()).toEqual({ cleanupPeriodDays: 3650 })
  expect(record().retention).toEqual({ installed: 3650, previous: null })
  expect(backups()).toEqual([])
  await removeRetention()
  expect(settings()).toEqual({})
})

test('retention: a larger value already set is kept, never shortened', async () => {
  userSettings('{"cleanupPeriodDays":99999}')
  await installRetention()
  expect(settings()).toEqual({ cleanupPeriodDays: 99999 })
  expect(record().retention).toEqual({ installed: 99999, previous: 99999 })
  expect(await retentionInstalled()).toBe(true)
  await removeRetention()
  expect(settings()).toEqual({ cleanupPeriodDays: 99999 })
})

test('retention: a value the user changed since is not removed, with our sentence', async () => {
  userSettings('{"cleanupPeriodDays":30}')
  await installRetention()
  userSettings('{"cleanupPeriodDays":60}')
  expect(await retentionInstalled()).toBe(false)
  await expect(removeRetention()).rejects.toBeInstanceOf(IntegrationError)
  expect(settings()).toEqual({ cleanupPeriodDays: 60 })
  expect(record().retention).toEqual({ installed: 3650, previous: 30 })
})

test('retention and the status line keep each other in the file and in the record', async () => {
  userSettings('{"cleanupPeriodDays":30}')
  await installStatusline(COMMAND)
  await installRetention()
  expect(Object.keys(record()).sort()).toEqual(['retention', 'statusline'])
  await removeStatusline(COMMAND)
  expect(await retentionInstalled()).toBe(true)
  expect(settings()).toEqual({ cleanupPeriodDays: 3650 })
  await installStatusline(COMMAND)
  await removeRetention()
  expect(await statuslineInstalled()).toBe(true)
  expect(Object.keys(record())).toEqual(['statusline'])
  expect(settings().cleanupPeriodDays).toBe(30)
})

test('retention: an unreadable file refuses, with our sentence', async () => {
  userSettings('not json')
  await expect(installRetention()).rejects.toBeInstanceOf(IntegrationError)
  expect(readFileSync(settingsPath(), 'utf8')).toBe('not json')
})

test('retention status: an absent key is not a value from the file, it is Claude Code default', async () => {
  userSettings('{"model":"opus"}')
  expect(await retentionStatus()).toEqual({ kind: 'unset', defaultDays: 30 })
  userSettings(null)
  expect(await retentionStatus()).toEqual({
    kind: 'unset',
    defaultDays: CLAUDE_DEFAULT_CLEANUP_DAYS,
  })
})

test.each([45, 7])('retention status: a present value, %i, is the one shown', async (days) => {
  userSettings(JSON.stringify({ cleanupPeriodDays: days }))
  expect(await retentionStatus()).toEqual({ kind: 'days', days, by: 'user', on: false })
})

test('retention status: on shows the value Menkar set; a larger value of the user stays theirs', async () => {
  userSettings('{"cleanupPeriodDays":30}')
  await installRetention()
  expect(await retentionStatus()).toEqual({ kind: 'days', days: 3650, by: 'menkar', on: true })
  await removeRetention()
  userSettings('{"cleanupPeriodDays":99999}')
  await installRetention()
  expect(await retentionStatus()).toEqual({ kind: 'days', days: 99999, by: 'user', on: true })
})

test('retention status: a file that is not JSON, or a value that is not a number, is unreadable, and nothing is written', async () => {
  userSettings('{"cleanupPeriodDays":')
  expect(await retentionStatus()).toEqual({ kind: 'unreadable', path: settingsPath() })
  expect(readFileSync(settingsPath(), 'utf8')).toBe('{"cleanupPeriodDays":')
  userSettings('{"cleanupPeriodDays":"forever"}')
  expect(await retentionStatus()).toEqual({ kind: 'unreadable', path: settingsPath() })
})
