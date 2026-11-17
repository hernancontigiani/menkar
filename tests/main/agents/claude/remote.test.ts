// §2.3 of the multi-agent architecture (B2): Remote Control's live state is Claude's kit's concern,
// read from Claude Code's per-process registry (`~/.claude/sessions/<pid>.json`) for the `claude`
// process under the pane's shell. A real throwaway process stands in for the agent so `/proc` has it.
import { type ChildProcess, spawn } from 'node:child_process'
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { procStartOf } from '../../../../src/core/remote/live'
import { mainKitOf } from '../../../../src/main/agents/registry'

const SESSION = '5c1e7a2b-0f3d-4e6a-8b9c-1d2e3f4a5b6c'
const root = join(process.env.MENKAR_TEST_ROOT ?? '', 'remote-live')
const home = join(root, 'home')
const registry = join(home, '.claude', 'sessions')

let shell: ChildProcess
let agentPid = 0

async function childOf(pid: number): Promise<number | null> {
  for (const task of await readdir(`/proc/${pid}/task`)) {
    const kids = readFileSync(`/proc/${pid}/task/${task}/children`, 'utf8').trim()
    if (kids !== '') return Number(kids.split(/\s+/)[0])
  }
  return null
}

beforeAll(async () => {
  mkdirSync(registry, { recursive: true })
  const bin = join(root, 'bin')
  mkdirSync(bin, { recursive: true })
  const script = join(bin, 'claude')
  writeFileSync(script, '#!/bin/sh\nsleep 60\n')
  chmodSync(script, 0o755)
  // `; :` keeps the shell from exec'ing the script, so the script runs as the shell's child.
  shell = spawn('sh', ['-c', `${script}; :`], { detached: true, stdio: 'ignore' })
  const pid = shell.pid ?? 0
  await vi.waitFor(
    async () => {
      const kid = await childOf(pid)
      if (kid === null) throw new Error('no child yet')
      agentPid = kid
    },
    { timeout: 5000, interval: 20 },
  )
})

afterAll(() => {
  // The shell leads its own process group: the script and its sleep go with it.
  if (shell.pid !== undefined) process.kill(-shell.pid, 'SIGKILL')
})

const write = (json: unknown) =>
  writeFileSync(join(registry, `${agentPid}.json`), JSON.stringify(json))

const entry = (extra: Record<string, unknown>) => ({
  pid: agentPid,
  sessionId: SESSION,
  procStart: procStartOf(readFileSync(`/proc/${agentPid}/stat`, 'utf8')),
  status: 'idle',
  ...extra,
})

describe("Claude's Remote Control reading", () => {
  beforeEach(() => vi.stubEnv('HOME', home))
  afterEach(() => vi.unstubAllEnvs())

  const remote = () => {
    const found = mainKitOf('claude').remote
    if (found === null) throw new Error('Claude has Remote Control')
    return found
  }
  const pane = (sessionId: string | null, pid = shell.pid ?? 0) => ({
    shellPid: () => pid,
    sessionId: () => sessionId,
  })

  test("its folder is Claude Code's registry", () => {
    expect(remote().folder()).toBe(registry)
  })

  test.each([
    ['a bridge id: on', { bridgeSessionId: 'session_01Abc' }, SESSION, 'on'],
    ['null after a disconnect: off', { bridgeSessionId: null }, SESSION, 'off'],
    ['never connected: off', {}, SESSION, 'off'],
    ['another session: unknown', { bridgeSessionId: 'session_01Abc' }, 'other', 'unknown'],
    ['before the session is known, the pid decides', { bridgeSessionId: 'x' }, null, 'on'],
  ] as const)('%s', async (_, extra, sessionId, state) => {
    write(entry(extra))
    expect(await remote().live(pane(sessionId))).toBe(state)
  })

  test('no claude under the shell: unknown', async () => {
    write(entry({ bridgeSessionId: 'session_01Abc' }))
    expect(await remote().live(pane(SESSION, agentPid))).toBe('unknown')
  })

  test('Cursor has no Remote Control', () => {
    expect(mainKitOf('cursor').remote).toBeNull()
  })
})
