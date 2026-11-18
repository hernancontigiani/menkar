// §2.3 and §2.10 of the multi-agent architecture: every registered agent's state rules are asserted
// against its own screen fixtures, and P0.5 moved Claude's and Cursor's rules behind their kits with
// no change in what they read (screens.json holds what the rules answered before the move).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { descriptorOf } from '../../../../src/core/agents/descriptors'
import { AGENT_IDS, type AgentId } from '../../../../src/core/agents/ids'
import { kitOf } from '../../../../src/core/agents/registry'
import { detectState, RAW_STATES, type RawState } from '../../../../src/core/agentstate/detect'
import { setLanguage, translate } from '../../../../src/core/i18n'
import { en } from '../../../../src/core/i18n/en'
import { es } from '../../../../src/core/i18n/es'

const DATA = join(import.meta.dirname, '..', '..', '..', 'data', 'agents')

interface Case {
  readonly name: string
  readonly title: string
  readonly screen: string
  readonly state: RawState
}

const screensOf = (id: AgentId): readonly Case[] =>
  JSON.parse(readFileSync(join(DATA, id, 'screens.json'), 'utf8')) as Case[]

describe.each(AGENT_IDS.map((id) => [id]))('%s', (id) => {
  const cases = screensOf(id)

  test('its fixtures reach every raw state', () => {
    expect([...new Set(cases.map((c) => c.state))].sort()).toEqual([...RAW_STATES].sort())
  })

  test.each(cases.map((c) => [c.name, c]))('%s', (_, c) => {
    expect(kitOf(id).state.detect(c.title, c.screen)).toBe(c.state)
    expect(detectState(id, c.title, c.screen)).toBe(c.state)
  })
})

describe("the agent's name in a notification", () => {
  afterEach(() => setLanguage('en'))

  // The label arrives as data, so check-i18n cannot see it at the call: each language's catalog
  // holds it.
  test.each([
    ['en', en],
    ['es', es],
  ] as const)('%s holds every label key itself', (_, messages) => {
    for (const id of AGENT_IDS) expect(Object.hasOwn(messages, descriptorOf(id).label)).toBe(true)
  })

  // The notification's name came from a fixed table before P0.5; the descriptors' labels read the
  // same in every language, so the text shown does not change.
  test.each(['en', 'es'] as const)('%s: the names shown before', (language) => {
    setLanguage(language)
    expect(AGENT_IDS.map((id) => translate(descriptorOf(id).label))).toEqual([
      'Claude Code',
      'Cursor',
    ])
  })
})
