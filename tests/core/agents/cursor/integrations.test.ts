// Cursor's two integrations items (decision 1.140): each turned on and off on its own, and the rest
// of the user's file keeps its bytes, asserted by invariance.
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  HOOK_EVENTS,
  HOOK_TIMEOUT,
  hookCommand,
  integrations,
  serverName,
} from '../../../../src/core/agents/cursor/integrations'
import { contextFiles } from '../../../../src/core/context/files'
import { IntegrationError } from '../../../../src/core/context/integrations'

const CTX = { execPath: '/opt/Menkar/menkar', programs: '/opt/Menkar/resources/app.asar/out/main' }
const dir = () => join(homedir(), '.cursor')
const hooksPath = () => join(dir(), 'hooks.json')
// The test setup sets XDG_CONFIG_HOME, so Cursor's config is read there.
const configDir = () => join(process.env.XDG_CONFIG_HOME ?? '', 'cursor')
const configPath = () => join(configDir(), 'cli-config.json')
const [hooks, allow] = integrations.items as [
  (typeof integrations.items)[number],
  (typeof integrations.items)[number],
]

const read = (path: string) => readFileSync(path, 'utf8')
const write = (path: string, text: string) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
}
const backups = () =>
  existsSync(contextFiles.settingsBackups()) ? readdirSync(contextFiles.settingsBackups()) : []

// A user's files as people write them: tabs, an odd key order, escapes, a number spelled their way.
const USER_HOOKS =
  '{\n\t"version": 1,\n\t"hooks": {\n\t\t"stop": [\n\t\t\t{ "command": "notify-send \\u0022done\\u0022" }\n\t\t]\n\t}\n}\n'
const USER_CONFIG =
  '{\r\n  "editor": {"vimMode": false},\r\n  "permissions": { "allow": ["Shell(ls)"], "deny": [] },\r\n  "version": 1.0\r\n}'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 23, 23, 59, 30))
  rmSync(dir(), { recursive: true, force: true })
  rmSync(configDir(), { recursive: true, force: true })
  rmSync(contextFiles.settingsBackups(), { recursive: true, force: true })
  rmSync(join(contextFiles.integrationsRecord(), '..', 'cursor-integrations.json'), { force: true })
})

afterEach(() => {
  vi.useRealTimers()
})

test('the hooks item adds one entry per turn event running the hook program, and removing it gives back every byte', async () => {
  write(hooksPath(), USER_HOOKS)
  expect(await hooks.on()).toBe(false)
  await hooks.set(true, CTX)
  expect(await hooks.on()).toBe(true)
  const added = JSON.parse(read(hooksPath()))
  expect(HOOK_EVENTS.length).toBe(3)
  for (const event of HOOK_EVENTS)
    expect(added.hooks[event]).toContainEqual({ command: hookCommand(CTX), timeout: HOOK_TIMEOUT })
  expect(added.hooks.stop[0]).toEqual({ command: 'notify-send "done"' })
  expect(hookCommand(CTX)).toBe(
    '/usr/bin/env ELECTRON_RUN_AS_NODE=1 /opt/Menkar/menkar /opt/Menkar/resources/app.asar/out/main/cursor-hook.js',
  )
  await hooks.set(false, CTX)
  expect(read(hooksPath())).toBe(USER_HOOKS)
  expect(await hooks.on()).toBe(false)
})

test('the allow item adds one entry for every tool of its flavour’s server, and removing it gives back every byte', async () => {
  write(configPath(), USER_CONFIG)
  await allow.set(true, CTX)
  expect(await allow.on()).toBe(true)
  const list: string[] = JSON.parse(read(configPath())).permissions.allow
  expect(list).toEqual(['Shell(ls)', 'Mcp(plugin-menkar-menkar:*)'])
  await allow.set(false, CTX)
  expect(read(configPath())).toBe(USER_CONFIG)
})

test('after Cursor rewrote cli-config.json in its own layout, removing takes out only the entry, found by value', async () => {
  write(configPath(), USER_CONFIG)
  await allow.set(true, CTX)
  const rewritten = {
    permissions: { allow: ['Shell(ls)', `Mcp(${serverName()}:*)`], deny: [] },
    version: 1,
    editor: { vimMode: false },
  }
  write(configPath(), JSON.stringify(rewritten, null, 2))
  expect(await allow.on()).toBe(true)
  await allow.set(false, CTX)
  expect(read(configPath())).toBe(
    JSON.stringify({ ...rewritten, permissions: { allow: ['Shell(ls)'], deny: [] } }, null, 2),
  )
})

test.each([
  [
    'CURSOR_CONFIG_DIR',
    (root: string) => ({ CURSOR_CONFIG_DIR: root, XDG_CONFIG_HOME: '/none' }),
    (root: string) => join(root, 'cli-config.json'),
  ],
  [
    'XDG_CONFIG_HOME',
    (root: string) => ({ CURSOR_CONFIG_DIR: '', XDG_CONFIG_HOME: root }),
    (root: string) => join(root, 'cursor', 'cli-config.json'),
  ],
  [
    'the home',
    () => ({ CURSOR_CONFIG_DIR: '', XDG_CONFIG_HOME: '' }),
    () => join(homedir(), '.cursor', 'cli-config.json'),
  ],
])('cli-config.json is written where Cursor reads it: from %s', async (_, env, where) => {
  const root = join(homedir(), 'elsewhere')
  for (const [name, value] of Object.entries(env(root))) vi.stubEnv(name, value)
  try {
    write(where(root), USER_CONFIG)
    await allow.set(true, CTX)
    expect(read(where(root))).toContain(`Mcp(${serverName()}:*)`)
    await allow.set(false, CTX)
    expect(read(where(root))).toBe(USER_CONFIG)
  } finally {
    vi.unstubAllEnvs()
    rmSync(root, { recursive: true, force: true })
  }
})

test('each item is removable on its own: turning one off leaves the other on and its file untouched', async () => {
  write(hooksPath(), USER_HOOKS)
  write(configPath(), USER_CONFIG)
  await hooks.set(true, CTX)
  await allow.set(true, CTX)
  const withHooks = read(hooksPath())
  await allow.set(false, CTX)
  expect(read(configPath())).toBe(USER_CONFIG)
  expect(read(hooksPath())).toBe(withHooks)
  expect(await hooks.on()).toBe(true)
  await hooks.set(false, CTX)
  expect(read(hooksPath())).toBe(USER_HOOKS)
})

test('the user’s edits made while the hooks are on are kept when they are turned off', async () => {
  write(hooksPath(), USER_HOOKS)
  await hooks.set(true, CTX)
  const edited = read(hooksPath()).replace('"version": 1', '"version": 1, "mine": true')
  write(hooksPath(), edited)
  await hooks.set(false, CTX)
  expect(read(hooksPath())).toBe(USER_HOOKS.replace('"version": 1', '"version": 1, "mine": true'))
})

test('with no hooks.json the item creates one, laid out on lines, and removing it deletes it', async () => {
  await hooks.set(true, CTX)
  const created = read(hooksPath())
  expect(JSON.parse(created).version).toBe(1)
  expect(created).toContain('\n  "hooks": {\n    "beforeSubmitPrompt": [')
  await hooks.set(false, CTX)
  expect(existsSync(hooksPath())).toBe(false)
})

test('a missing cli-config.json is refused with our sentence, and nothing is created', async () => {
  await expect(allow.set(true, CTX)).rejects.toThrow(IntegrationError)
  expect(existsSync(configPath())).toBe(false)
  expect(await allow.on()).toBe(false)
})

test.each([
  ['not JSON', '{"permissions": '],
  ['not an object', '[1, 2]'],
  ['permissions.allow not a list', '{"permissions": {"allow": "Shell(ls)"}}'],
])('a cli-config.json that is %s is refused and left as it is', async (_, text) => {
  write(configPath(), text)
  await expect(allow.set(true, CTX)).rejects.toThrow(IntegrationError)
  expect(read(configPath())).toBe(text)
})

test('an entry the user already had is neither added twice nor taken out', async () => {
  const mine = `{"permissions": {"allow": ["Mcp(${serverName()}:*)"]}}`
  write(configPath(), mine)
  await allow.set(true, CTX)
  const list: string[] = JSON.parse(read(configPath())).permissions.allow
  expect(list).toHaveLength(1)
  await allow.set(false, CTX)
  expect(read(configPath())).toBe(mine)
})

test('the file keeps its mode, a symlinked file is written at its target, and a copy is kept first', async () => {
  const target = join(homedir(), 'dotfiles-cli-config.json')
  writeFileSync(target, USER_CONFIG)
  chmodSync(target, 0o600)
  mkdirSync(configDir(), { recursive: true })
  symlinkSync(target, configPath())
  await allow.set(true, CTX)
  expect(lstatSync(configPath()).isSymbolicLink()).toBe(true)
  expect(statSync(target).mode & 0o777).toBe(0o600)
  expect(backups()).toEqual(['cursor-allow-20261123-235930.json'])
  await allow.set(false, CTX)
  expect(read(target)).toBe(USER_CONFIG)
  rmSync(target)
})

test('turned on again after the user took out one of its entries, it adds the missing one and still removes cleanly', async () => {
  write(hooksPath(), USER_HOOKS)
  await hooks.set(true, CTX)
  const ours = `{"command":${JSON.stringify(hookCommand(CTX))},"timeout":${HOOK_TIMEOUT}}`
  const text = read(hooksPath())
  expect(text).toContain(`,\n\t\t\t${ours}`)
  write(hooksPath(), text.replace(`,\n\t\t\t${ours}`, ''))
  expect(await hooks.on()).toBe(false)
  await hooks.set(true, CTX)
  expect(await hooks.on()).toBe(true)
  await hooks.set(false, CTX)
  expect(read(hooksPath())).toBe(USER_HOOKS)
})

test('a cli-config.json without the entry after it was turned on reads off, and turning it on adds it again', async () => {
  write(configPath(), USER_CONFIG)
  await allow.set(true, CTX)
  write(configPath(), USER_CONFIG)
  expect(await allow.on()).toBe(false)
  await allow.set(true, CTX)
  expect(await allow.on()).toBe(true)
  await allow.set(false, CTX)
  expect(read(configPath())).toBe(USER_CONFIG)
})

test("the sandbox's allow entries name a server of its own, so neither flavour's removal takes the other's", () => {
  vi.stubGlobal('__MENKAR_FLAVOR__', 'sandbox')
  try {
    expect(serverName()).toBe('plugin-menkar-sandbox-menkar')
  } finally {
    vi.unstubAllGlobals()
  }
  expect(serverName()).toBe('plugin-menkar-menkar')
})
