// The statusline integration in ~/.claude/settings.json: on, off, refused, with backups and the
// record (docs/spec/context.md, CTX-31 to CTX-39). Everything else in the user's file is asserted
// unchanged by invariance.
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname } from 'node:path'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { contextFiles } from '../../../src/core/context/files'
import {
  IntegrationError,
  installStatusline,
  removeStatusline,
  statuslineInstalled,
} from '../../../src/core/context/integrations'
import { agentPaths } from '../../../src/core/paths'

const COMMAND = "ELECTRON_RUN_AS_NODE=1 '/opt/Menkar/menkar' '/opt/Menkar/statusline.js'"
const OURS = { type: 'command', command: COMMAND }
const settingsPath = () => agentPaths().claudeSettings

function userSettings(content: string | null) {
  mkdirSync(dirname(settingsPath()), { recursive: true })
  if (content === null) rmSync(settingsPath(), { force: true })
  else writeFileSync(settingsPath(), content)
}

const settings = () => readFileSync(settingsPath(), 'utf8')
const record = () => JSON.parse(readFileSync(contextFiles.integrationsRecord(), 'utf8'))
const backups = () =>
  existsSync(contextFiles.settingsBackups())
    ? readdirSync(contextFiles.settingsBackups()).sort()
    : []

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 8, 14, 3, 21))
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

test('CTX-31 with no record the switch reads off, and reading it writes nothing under ~/.claude', async () => {
  userSettings('{"model": "opus"}')
  const before = settings()
  expect(await statuslineInstalled()).toBe(false)
  expect(settings()).toBe(before)
  expect(readdirSync(dirname(settingsPath()))).toEqual(['settings.json'])
})

test("CTX-32 turning it on backs the file up, keeps the user's keys, records what it replaced", async () => {
  const original = '{"model":"opus","statusLine":{"type":"command","command":"my-bar"}}'
  userSettings(original)
  await installStatusline(COMMAND)
  expect(backups()).toEqual(['settings-20261108-140321.json'])
  expect(
    readFileSync(`${contextFiles.settingsBackups()}/settings-20261108-140321.json`, 'utf8'),
  ).toBe(original)
  expect(settings()).toBe(`${JSON.stringify({ model: 'opus', statusLine: OURS }, null, 2)}\n`)
  expect(record()).toEqual({
    statusline: { installed: OURS, previous: { type: 'command', command: 'my-bar' } },
  })
  expect(readFileSync(contextFiles.chainedStatusline(), 'utf8')).toBe('{"command": "my-bar"}\n')
  expect(await statuslineInstalled()).toBe(true)
})

test("CTX-33 turning it off puts the user's statusline back and clears the record", async () => {
  userSettings('{"model":"opus","statusLine":{"type":"command","command":"my-bar"}}')
  await installStatusline(COMMAND)
  await removeStatusline(COMMAND)
  expect(JSON.parse(settings())).toEqual({
    model: 'opus',
    statusLine: { type: 'command', command: 'my-bar' },
  })
  expect(Object.keys(JSON.parse(settings()))).toEqual(['model', 'statusLine'])
  expect(record()).toEqual({})
  expect(await statuslineInstalled()).toBe(false)
})

test('CTX-34 with no settings file: no backup, a file with only the statusline, then {}', async () => {
  await installStatusline(COMMAND)
  expect(backups()).toEqual([])
  expect(JSON.parse(settings())).toEqual({ statusLine: OURS })
  await removeStatusline(COMMAND)
  expect(settings()).toBe('{}\n')
})

test('CTX-35 a statusline edited by hand reads off; turning on installs again over the edit', async () => {
  userSettings('{"statusLine":{"type":"command","command":"my-bar"}}')
  await installStatusline(COMMAND)
  userSettings('{"statusLine":{"type":"command","command":"edited"}}')
  expect(await statuslineInstalled()).toBe(false)
  vi.setSystemTime(new Date(2026, 10, 8, 15, 0, 0))
  await installStatusline(COMMAND)
  expect(backups()).toHaveLength(2)
  expect(record().statusline.previous).toEqual({ type: 'command', command: 'edited' })
})

test('CTX-36 turning off a statusline the user changed since is refused, the file untouched', async () => {
  userSettings('{"statusLine":{"type":"command","command":"my-bar"}}')
  await installStatusline(COMMAND)
  const edited = '{"statusLine":{"type":"command","command":"edited"}}'
  userSettings(edited)
  await expect(removeStatusline(COMMAND)).rejects.toThrow(
    `The status line in ${settingsPath()} changed since it was installed; it was left as it is.`,
  )
  expect(settings()).toBe(edited)
})

test.each([
  ['{"a":', 'is not valid JSON; it was left as it is.'],
  ['[1]', 'does not hold a JSON object; it was left as it is.'],
])(
  'CTX-37 a settings file holding %s is refused with no backup and no change',
  async (content, message) => {
    userSettings(content)
    const error = await installStatusline(COMMAND).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(IntegrationError)
    expect((error as Error).message).toBe(`${settingsPath()} ${message}`)
    expect(settings()).toBe(content)
    expect(backups()).toEqual([])
    expect(await statuslineInstalled()).toBe(false)
  },
)

test('CTX-37 an unreadable settings file is refused', async () => {
  userSettings('{}')
  chmodSync(settingsPath(), 0o000)
  try {
    await expect(installStatusline(COMMAND)).rejects.toThrow(`${settingsPath()} could not be read.`)
  } finally {
    chmodSync(settingsPath(), 0o600)
  }
})

test("CTX-38 Menkar's statusline already there and no record: previous is null, off removes it", async () => {
  userSettings(JSON.stringify({ statusLine: OURS }))
  await installStatusline(COMMAND)
  expect(record().statusline.previous).toBeNull()
  await removeStatusline(COMMAND)
  expect(JSON.parse(settings())).toEqual({})
})

test('CTX-39 two installs within one second share the backup name; the second replaces it', async () => {
  userSettings('{"statusLine":{"type":"command","command":"first"}}')
  await installStatusline(COMMAND)
  userSettings('{"statusLine":{"type":"command","command":"second"}}')
  await installStatusline(COMMAND)
  expect(backups()).toEqual(['settings-20261108-140321.json'])
  expect(
    JSON.parse(
      readFileSync(`${contextFiles.settingsBackups()}/settings-20261108-140321.json`, 'utf8'),
    ),
  ).toEqual({ statusLine: { type: 'command', command: 'second' } })
})

test('the record keeps keys it does not know', async () => {
  mkdirSync(dirname(contextFiles.integrationsRecord()), { recursive: true })
  writeFileSync(contextFiles.integrationsRecord(), '{"hooks": {"x": 1}}')
  await installStatusline(COMMAND)
  await removeStatusline(COMMAND)
  expect(record()).toEqual({ hooks: { x: 1 } })
})

test('turning it on twice in a row changes nothing the second time', async () => {
  userSettings('{"model":"opus"}')
  await installStatusline(COMMAND)
  const once = settings()
  vi.setSystemTime(new Date(2026, 10, 8, 16, 0, 0))
  await installStatusline(COMMAND)
  expect(settings()).toBe(once)
  expect(backups()).toHaveLength(1)
})
