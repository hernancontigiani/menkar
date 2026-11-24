// D22 (1.137): nothing outside Cursor can name a chat, so a Cursor worker the orchestration starts
// keeps its `<project>-t<N>` in Menkar's own names, for good. Every other agent's own data names its
// sessions, and Menkar keeps no second name for them.
import { expect, test } from 'vitest'
import { AGENT_IDS } from '../../../../src/core/agents/ids'
import { kitOf } from '../../../../src/core/agents/registry'

test("a Cursor worker's name is kept by Menkar, and no other agent's is", () => {
  expect(kitOf('cursor').namer.kept('menkar-t9')).toBe('menkar-t9')
  const others = AGENT_IDS.filter((id) => id !== 'cursor')
  expect(others.length).toBeGreaterThanOrEqual(3)
  for (const id of others) expect(kitOf(id).namer.kept('menkar-t9')).toBeNull()
})
