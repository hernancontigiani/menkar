// Settings' agent items as main answers them: greyed with a line while the agent's CLI is not on
// the PATH (decision 1.140), the sandbox's line before uninstalling (S11), and a change refused
// while the CLI is not found.
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useProgramsFolder } from '../../src/core/paths'
import { agentItems, setAgentItem } from '../../src/main/agent-integrations'

const bin = () => join(homedir(), 'bin')

beforeEach(() => {
  useProgramsFolder('/opt/Menkar/resources/app.asar/out/main')
  mkdirSync(bin(), { recursive: true })
  vi.stubEnv('PATH', bin())
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const standIn = () => {
  writeFileSync(join(bin(), 'cursor-agent'), '#!/bin/sh\n')
  chmodSync(join(bin(), 'cursor-agent'), 0o755)
}

test('with no agent CLI found every agent group is greyed with its line, and a change is refused writing nothing', async () => {
  const groups = await agentItems()
  expect(groups.map((g) => g.agent)).toEqual(['cursor'])
  const [cursor] = groups
  expect(cursor?.found).toBe(false)
  expect(cursor?.label).toBe('Cursor')
  expect(cursor?.notes).toEqual([
    'cursor-agent was not found on the PATH: these can be turned on once it is installed.',
  ])
  expect(cursor?.items.map((i) => [i.key, i.on])).toEqual([
    ['cursor-hooks', false],
    ['cursor-allow', false],
  ])
  const answer = await setAgentItem('cursor', 'cursor-hooks', true)
  expect(answer.on).toBe(false)
  expect(answer.error).toContain('was not found')
  expect(existsSync(join(homedir(), '.cursor', 'hooks.json'))).toBe(false)
})

test('found, the group has no line in the daily Menkar, and the sandbox says to turn the items off before uninstalling', async () => {
  standIn()
  expect((await agentItems())[0]?.notes).toEqual([])
  vi.stubGlobal('__MENKAR_FLAVOR__', 'sandbox')
  expect((await agentItems())[0]?.notes).toEqual([
    "These entries run Menkar Sandbox's own program: turn them off here before uninstalling Menkar Sandbox.",
  ])
})

test('an unknown agent or item is refused with our sentence', async () => {
  standIn()
  expect(await setAgentItem('gemini', 'x', true)).toEqual({
    on: false,
    error: 'Menkar has no such setting.',
  })
  expect((await setAgentItem('cursor', 'nope', true)).error).toBe('Menkar has no such setting.')
})
