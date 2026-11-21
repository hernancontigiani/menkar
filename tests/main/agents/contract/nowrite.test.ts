// R9 of the multi-agent design on main's side: what Menkar runs of an agent's own (its waker's and
// its namer's commands) writes nothing in the agent's data but what the agent's kit declares. The core contract
// reads each agent's sessions; this runs each main kit's commands against the same fixture home,
// with the agent's stand-in on the PATH, so a write the kit forgot to declare fails here.
import { cpSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { codexStandIn } from '../../../../e2e/standins/codex'
import { opencodeStandIn } from '../../../../e2e/standins/opencode'
import { AGENT_IDS, type AgentId } from '../../../../src/core/agents/ids'
import { inProcessReads, useReads } from '../../../../src/core/agents/opencode/reads'
import { kitOf } from '../../../../src/core/agents/registry'
import { mainKitOf } from '../../../../src/main/agents/registry'
import {
  DATA,
  type Entry,
  filesOf,
  undeclared,
} from '../../../core/agents/contract/nowrite-harness'

// The stand-in an agent's commands need; an agent whose main kit runs no command needs none.
const STAND_INS: Partial<Record<AgentId, (bin: string) => void>> = {
  codex: codexStandIn,
  opencode: opencodeStandIn,
}
// What a stand-in records of its own runs, beside the agent's data: not the agent's.
const STAND_IN_RECORDS =
  /^(codex-(args|env|mcp-env|threads)|opencode-(args|env|serve-env|serve-pids|requests|mcp-env))\.(txt|json|jsonl)$/

// OpenCode's catalog reads on a worker thread in the app; here on the test's own.
useReads(inProcessReads())

const WAKING = AGENT_IDS.filter((id) => mainKitOf(id).waker !== null)
const NAMING = AGENT_IDS.filter((id) => mainKitOf(id).namer !== null)

let n = 0

function homeOf(id: AgentId): string {
  n += 1
  const root = join(process.env.MENKAR_TEST_ROOT ?? '', `main-nowrite-${id}-${n}`)
  const home = join(root, 'home')
  const bin = join(root, 'bin')
  cpSync(join(DATA, id, 'home'), home, { recursive: true, preserveTimestamps: true })
  STAND_INS[id]?.(bin)
  vi.stubEnv('HOME', home)
  vi.stubEnv('XDG_DATA_HOME', join(home, '.local', 'share'))
  vi.stubEnv('PATH', `${bin}:${process.env.PATH}`)
  return home
}

const agentData = (files: Map<string, Entry>) =>
  new Map([...files].filter(([path]) => !STAND_IN_RECORDS.test(path)))

afterEach(async () => {
  await Promise.all(AGENT_IDS.map((id) => mainKitOf(id).prepare?.quit()))
  vi.unstubAllEnvs()
})

test('every agent that can be woken or named after its start is checked, Codex among them', () => {
  expect(WAKING).toContain('codex')
  expect(WAKING).toContain('opencode')
  expect(NAMING).toContain('codex')
})

// A compressed rollout is an old session's, which the stand-in does not look in.
async function sessionsOf(id: AgentId): Promise<string[]> {
  const found = await kitOf(id).catalog.find(kitOf(id).catalog.root())
  const live = found.filter((f) => !f.locator.endsWith('.zst')).map((f) => f.id)
  expect(live.length).toBeGreaterThan(0)
  return live
}

describe.each(WAKING.map((id) => [id]))('%s', (id) => {
  test('waking a session writes nothing it does not declare', async () => {
    const home = homeOf(id)
    const before = agentData(filesOf(home))
    expect(before.size).toBeGreaterThan(0)
    // An agent whose sessions run in a server Menkar starts is woken there, once a pane holds it.
    let pane = 0
    for (const session of await sessionsOf(id)) {
      pane += 1
      await mainKitOf(id).prepare?.prepare({
        pane: `pane-${pane}`,
        cli: id,
        cwd: home,
        start: { kind: 'resume', id: session },
        team: false,
        execPath: process.execPath,
        mcpServer: join(home, 'no-mcp-server.js'),
      })
      const woken = await mainKitOf(id).waker?.wake(session, 'hello', undefined)
      // Its server holds every session of its data, so each wake reaches it.
      if (mainKitOf(id).prepare !== null) expect(woken).toBe('posted')
    }

    expect(undeclared(before, agentData(filesOf(home)), kitOf(id).writes)).toEqual([])
  })
})

describe.each(NAMING.map((id) => [id]))('%s', (id) => {
  test('naming a session writes nothing it does not declare', async () => {
    const home = homeOf(id)
    const before = agentData(filesOf(home))
    for (const session of await sessionsOf(id))
      expect(await mainKitOf(id).namer?.after(session, 'a-worker')).toBe('named')
    expect(undeclared(before, agentData(filesOf(home)), kitOf(id).writes)).toEqual([])
  })
})
