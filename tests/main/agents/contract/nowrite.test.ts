// R9 of the multi-agent design on main's side: what Menkar runs of an agent's own (its waker's
// command) writes nothing in the agent's data but what the agent's kit declares. The core contract
// reads each agent's sessions; this runs each main kit's commands against the same fixture home,
// with the agent's stand-in on the PATH, so a write the kit forgot to declare fails here.
import { cpSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { codexStandIn } from '../../../../e2e/standins/codex'
import { AGENT_IDS, type AgentId } from '../../../../src/core/agents/ids'
import { kitOf } from '../../../../src/core/agents/registry'
import { mainKitOf } from '../../../../src/main/agents/registry'
import {
  DATA,
  type Entry,
  filesOf,
  undeclared,
} from '../../../core/agents/contract/nowrite-harness'

// The stand-in an agent's commands need; an agent whose main kit runs no command needs none.
const STAND_INS: Partial<Record<AgentId, (bin: string) => void>> = { codex: codexStandIn }
// What a stand-in records of its own runs, beside the agent's data: not the agent's.
const STAND_IN_RECORDS = /^codex-(args|env|mcp-env|threads)\.(txt|json)$/

const WAKING = AGENT_IDS.filter((id) => mainKitOf(id).waker !== null)

let n = 0

function homeOf(id: AgentId): string {
  n += 1
  const root = join(process.env.MENKAR_TEST_ROOT ?? '', `main-nowrite-${id}-${n}`)
  const home = join(root, 'home')
  const bin = join(root, 'bin')
  cpSync(join(DATA, id, 'home'), home, { recursive: true, preserveTimestamps: true })
  STAND_INS[id]?.(bin)
  vi.stubEnv('HOME', home)
  vi.stubEnv('PATH', `${bin}:${process.env.PATH}`)
  return home
}

const agentData = (files: Map<string, Entry>) =>
  new Map([...files].filter(([path]) => !STAND_IN_RECORDS.test(path)))

afterEach(() => {
  vi.unstubAllEnvs()
})

test('every agent that can be woken is checked, Codex among them', () => {
  expect(WAKING).toContain('codex')
})

describe.each(WAKING.map((id) => [id]))('%s', (id) => {
  test('waking a session writes nothing it does not declare', async () => {
    const home = homeOf(id)
    const before = agentData(filesOf(home))
    expect(before.size).toBeGreaterThan(0)
    const found = await kitOf(id).catalog.find(kitOf(id).catalog.root())
    expect(found.length).toBeGreaterThan(0)

    // A compressed rollout is an old session's, which the stand-in does not look in.
    const outcomes = []
    for (const item of found.filter((f) => !f.locator.endsWith('.zst')))
      outcomes.push(await mainKitOf(id).waker?.wake(item.id, 'hello', undefined))
    expect(outcomes.length).toBeGreaterThan(0)

    expect(undeclared(before, agentData(filesOf(home)), kitOf(id).writes)).toEqual([])
  })
})
