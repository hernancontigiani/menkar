// The chat processes with stand-ins for `claude`, `cursor-agent` and `ghostty` from tests/data/chat
// on the PATH: never the real ones (docs/spec/chat.md CHT-6 to CHT-12, CHT-23, CHT-24, CHT-29,
// CHT-41, CHT-47 to CHT-50).
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  chatOf,
  closeChat,
  cursorTurn,
  ghosttyInstalled,
  onChatEvent,
  openInGhostty,
  startChat,
} from '../../../src/core/chat/processes'
import { allowLine, type ChatEvent, denyLine, userLine } from '../../../src/core/chat/protocol'
import { now } from '../../../src/core/clock'

const STANDINS = resolve('tests/data/chat')
type Seen = ChatEvent | { readonly kind: 'ended' }
let events: { chatId: string; event: Seen }[] = []
let log = ''

beforeEach(() => {
  log = mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', 'chat-'))
  mkdirSync(homedir(), { recursive: true })
  vi.stubEnv('PATH', `${STANDINS}:${process.env.PATH ?? ''}`)
  vi.stubEnv('FAKE_CHAT_LOG', log)
  events = []
  onChatEvent((chatId, event) => events.push({ chatId, event }))
})

afterEach(() => {
  vi.unstubAllEnvs()
})

const kinds = (chatId: string) => events.filter((e) => e.chatId === chatId).map((e) => e.event)
const records = (file: string) =>
  existsSync(join(log, file))
    ? readFileSync(join(log, file), 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : []

async function until(check: () => boolean, ms = 5000): Promise<void> {
  const end = now() + ms
  while (!check()) {
    if (now() > end) throw new Error('timed out')
    await new Promise((r) => setTimeout(r, 20))
  }
}

test('CHT-6 a new Claude chat starts at once with the stream argv, in its folder, with no --resume', async () => {
  const folder = mkdtempSync(join(log, 'shop-'))
  const chat = startChat('claude', 'default', { folder })
  expect(chat?.title).toMatch(/^Chat — shop-/)
  expect(chat?.tooltip).toBe(`Claude Code chat — ${folder}`)
  await until(() => records('claude.json').length > 0)
  expect(records('claude.json')[0]).toEqual({
    argv: [
      '-p',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--include-partial-messages',
      '--verbose',
      '--permission-mode',
      'default',
      '--permission-prompt-tool',
      'stdio',
    ],
    cwd: folder,
  })
  closeChat(chat?.chatId ?? '')
})

test('CHT-9, CHT-10 continuing resumes the session; a folder that is gone runs in the home folder', async () => {
  const chat = startChat('claude', 'default', {
    folder: join(log, 'gone'),
    resume: { id: '1b2c', name: 'JWT auth' },
  })
  expect(chat).toMatchObject({ title: 'Chat — JWT auth', tooltip: 'Claude Code chat — 1b2c' })
  await until(() => records('claude.json').length > 0)
  expect(records('claude.json')[0].argv.slice(-2)).toEqual(['--resume', '1b2c'])
  expect(records('claude.json')[0].cwd).toBe(homedir())
  closeChat(chat?.chatId ?? '')
})

test('CHT-15, CHT-35, CHT-36 a message streams back; a permission is answered over stdin', async () => {
  const chat = startChat('claude', 'default', { folder: log })
  const id = chat?.chatId ?? ''
  chatOf(id)?.process?.stdin?.write(userLine('run the tests'))
  await until(() => kinds(id).some((e) => e.kind === 'permission'))
  const request = kinds(id).find((e) => e.kind === 'permission')
  expect(kinds(id).slice(0, 3)).toEqual([
    { kind: 'session', id: 'fake-session' },
    { kind: 'text', text: 'Hel' },
    { kind: 'text', text: 'lo' },
  ])
  if (request?.kind !== 'permission') throw new Error('no request')
  expect(request).toMatchObject({ tool: 'Bash', body: 'npm test' })
  chatOf(id)?.process?.stdin?.write(allowLine(request.requestId, request.input))
  await until(() => kinds(id).some((e) => e.kind === 'turnEnd'))
  expect(kinds(id)).toContainEqual({ kind: 'text', text: ' ran' })
  expect(records('claude-stdin.jsonl').at(-1)).toEqual({
    type: 'control_response',
    response: {
      subtype: 'success',
      request_id: request.requestId,
      response: { behavior: 'allow', updatedInput: { command: 'npm test' } },
    },
  })
  chatOf(id)?.process?.stdin?.write(userLine('again'))
  await until(() => kinds(id).filter((e) => e.kind === 'permission').length === 2)
  const second = kinds(id).filter((e) => e.kind === 'permission')[1]
  if (second?.kind !== 'permission') throw new Error('no second request')
  chatOf(id)?.process?.stdin?.write(denyLine(second.requestId, 'The user declined this action.'))
  await until(() => kinds(id).some((e) => e.kind === 'text' && e.text === ' skipped'))
  closeChat(id)
})

test("CHT-23 Claude's process exiting ends the session, once", async () => {
  const chat = startChat('claude', 'default', { folder: log })
  const id = chat?.chatId ?? ''
  chatOf(id)?.process?.stdin?.write(userLine('exit'))
  await until(() => kinds(id).some((e) => e.kind === 'ended'))
  await new Promise((r) => setTimeout(r, 100))
  expect(kinds(id).filter((e) => e.kind === 'ended')).toHaveLength(1)
})

test('CHT-41 closing the tab ends the process with no notice', async () => {
  const chat = startChat('claude', 'default', { folder: log })
  const id = chat?.chatId ?? ''
  const child = chatOf(id)?.process
  const exited = new Promise<void>((r) => child?.once('exit', () => r()))
  closeChat(id)
  await exited
  await new Promise((r) => setTimeout(r, 50))
  expect(kinds(id).filter((e) => e.kind === 'ended')).toEqual([])
  expect(chatOf(id)).toBeUndefined()
})

test('CHT-8, CHT-11, CHT-12 a Cursor chat runs a process per message, resuming from the first', async () => {
  const chat = startChat('cursor', 'ask', { folder: log })
  const id = chat?.chatId ?? ''
  expect(records('cursor.json')).toEqual([])
  const c = chatOf(id)
  if (!c) throw new Error('no chat')
  cursorTurn(c, 'list files')
  await until(() => kinds(id).some((e) => e.kind === 'turnEnd'))
  expect(records('cursor.json')[0].argv).toEqual([
    '-p',
    '--output-format',
    'stream-json',
    '--stream-partial-output',
    '--trust',
    '--mode',
    'ask',
    'list files',
  ])
  expect(kinds(id).filter((e) => e.kind === 'text')).toEqual([
    { kind: 'text', text: 'echo: list files' },
  ])
  cursorTurn(c, 'more')
  await until(() => records('cursor.json').length === 2)
  expect(records('cursor.json')[1].argv).toContain('--resume')
  expect(records('cursor.json')[1].argv).toContain('cursor-session')
  const trusted = startChat('cursor', 'trusted', { folder: log, resume: { id: '9f8e', name: 'x' } })
  const t2 = chatOf(trusted?.chatId ?? '')
  if (!t2) throw new Error('no chat')
  cursorTurn(t2, 'hi')
  await until(() => records('cursor.json').length === 3)
  expect(records('cursor.json')[2].argv.slice(-5)).toEqual([
    '--trust',
    '--resume',
    '9f8e',
    '--force',
    'hi',
  ])
})

test('CHT-29 Stop interrupts a Cursor turn, which ends quietly', async () => {
  const chat = startChat('cursor', 'ask', { folder: log })
  const c = chatOf(chat?.chatId ?? '')
  if (!c) throw new Error('no chat')
  cursorTurn(c, 'hang')
  await until(() => c.process !== null && kinds(c.id).some((e) => e.kind === 'text'))
  c.process?.kill('SIGINT')
  await until(() => kinds(c.id).some((e) => e.kind === 'turnEnd'))
  expect(kinds(c.id).some((e) => e.kind === 'error')).toBe(false)
})

test('CHT-24 the CLI gone when a Cursor turn starts: our sentence, no process', async () => {
  const chat = startChat('cursor', 'ask', { folder: log })
  const c = chatOf(chat?.chatId ?? '')
  if (!c) throw new Error('no chat')
  vi.stubEnv('PATH', '/nonexistent')
  cursorTurn(c, 'hi')
  expect(kinds(c.id)).toEqual([
    { kind: 'error', message: 'cursor-agent is not installed or not on the PATH.' },
    { kind: 'turnEnd' },
  ])
  expect(records('cursor.json')).toEqual([])
  expect(startChat('claude', 'default', { folder: log })).toBeNull()
})

test('CHT-47 to CHT-50 Ghostty resumes the session in its folder, or does nothing', async () => {
  expect(ghosttyInstalled()).toBe(true)
  const folder = mkdtempSync(join(log, 'proj-'))
  expect(openInGhostty('claude', '1b2c', folder)).toBe(true)
  await until(() => existsSync(join(log, 'ghostty.txt')))
  expect(readFileSync(join(log, 'ghostty.txt'), 'utf8').trim().split('\n')).toEqual([
    `--working-directory=${folder}`,
    '-e',
    'claude',
    '--resume',
    '1b2c',
  ])
  expect(openInGhostty('cursor', 'abc', join(log, 'gone'))).toBe(true)
  await until(() => readFileSync(join(log, 'ghostty.txt'), 'utf8').includes('cursor-agent'))
  expect(readFileSync(join(log, 'ghostty.txt'), 'utf8').split('\n')[0]).toBe(
    `--working-directory=${homedir()}`,
  )
  // CHT-50: Ghostty installed but not the agent's CLI → nothing
  const only = join(log, 'only-ghostty')
  mkdirSync(only)
  symlinkSync(join(STANDINS, 'ghostty'), join(only, 'ghostty'))
  vi.stubEnv('PATH', only)
  expect(openInGhostty('claude', '1b2c', folder)).toBe(false)
  vi.stubEnv('PATH', STANDINS.replace('/chat', '/nowhere'))
  expect(ghosttyInstalled()).toBe(false)
  expect(openInGhostty('claude', '1b2c', folder)).toBe(false)
})
