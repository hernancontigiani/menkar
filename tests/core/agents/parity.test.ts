// §2.1 of the multi-agent architecture: a capability the renderer shows is a fact mirrored by the
// nullness of the concern behind it in the agent's kit, so the two cannot drift apart.
import { describe, expect, test } from 'vitest'
import { DESCRIPTORS, descriptorOf } from '../../../src/core/agents/descriptors'
import { AGENT_IDS, type AgentId } from '../../../src/core/agents/ids'
import { kitOf } from '../../../src/core/agents/registry'
import type { AgentCap } from '../../../src/core/agents/types'
import { mainKitOf } from '../../../src/main/agents/registry'

// Each cap's concern, read from the kits: `null` until the block that first builds it fills it in.
const PAIRS: Readonly<
  Record<AgentCap, { block: string; concern: ((id: AgentId) => unknown) | null }>
> = {
  remote: { block: 'P0.5', concern: (id) => mainKitOf(id).remote },
  fork: { block: 'P0.6', concern: (id) => kitOf(id).fork },
  trash: { block: 'P0.4', concern: (id) => kitOf(id).catalog.trash },
  chat: { block: 'P0.7', concern: null },
  context: { block: 'P1a.6', concern: null },
}

describe('descriptors and kits', () => {
  test('every registered agent has its own descriptor, a kit and a main kit', () => {
    expect(AGENT_IDS.length).toBeGreaterThanOrEqual(2)
    expect(Object.keys(DESCRIPTORS).sort()).toEqual([...AGENT_IDS].sort())
    for (const id of AGENT_IDS) {
      expect(descriptorOf(id).id).toBe(id)
      expect(kitOf(id)).toBeDefined()
      expect(mainKitOf(id)).toBeDefined()
    }
  })

  test("the descriptors say what the app shows today: Claude's and Cursor's command, name and glyph", () => {
    expect(
      AGENT_IDS.map((id) => [
        descriptorOf(id).command,
        descriptorOf(id).label,
        descriptorOf(id).glyph,
      ]),
    ).toEqual([
      ['claude', 'agent.claude', '✳'],
      ['cursor-agent', 'agent.cursor', '➤'],
    ])
  })

  test('the caps are what each agent can do today', () => {
    const caps = (id: AgentId) =>
      Object.entries(descriptorOf(id).caps)
        .filter(([, has]) => has)
        .map(([cap]) => cap)
        .sort()
    expect(caps('claude')).toEqual(['chat', 'context', 'fork', 'remote', 'trash'])
    expect(caps('cursor')).toEqual(['chat', 'trash'])
  })

  test('every cap has its concern named, and a built concern matches its cap for every agent', () => {
    for (const id of AGENT_IDS)
      expect(Object.keys(descriptorOf(id).caps).sort()).toEqual(Object.keys(PAIRS).sort())
    for (const [cap, { concern }] of Object.entries(PAIRS) as [
      AgentCap,
      (typeof PAIRS)[AgentCap],
    ][]) {
      if (concern === null) continue
      for (const id of AGENT_IDS)
        expect(concern(id) !== null, `${id}: ${cap}`).toBe(descriptorOf(id).caps[cap])
    }
  })
})
