// Plan 39 P3.2 (§2.5.6): a new Cursor chat holds the block its sessionStart hook gave it; a resume
// runs no hook, so it holds what main recorded it held; a fork Cursor has none of. From the floor
// `--new-session-id` was measured on, a new session gets the id Menkar chose; below it, or with
// no version read, Cursor picks the id and the pane binds it late (set, 2026-11-23).
import { describe, expect, test } from 'vitest'
import { NEW_ID_FLOOR } from '../../../../src/core/agents/cursor/descriptor'
import { kitOf } from '../../../../src/core/agents/registry'
import { teamFacts } from '../../../../src/core/team/block'
import type { TeamText } from '../../../../src/core/team/posts'

const kit = kitOf('cursor')
const team = kit.team
const block: TeamText = { facts: 'facts now', block: 'block now' }
const recorded: TeamText = { facts: 'facts then', block: 'block then' }

describe('what a Cursor session holds of its team at start', () => {
  test('a new chat holds the block it starts with', () => {
    expect(team?.heldAtStart({ kind: 'new', id: 'n1' }, block, recorded)).toBe(block)
  })

  test('a resume holds what it recorded, not the block it is started with', () => {
    expect(team?.heldAtStart({ kind: 'resume', id: 'r1' }, block, recorded)).toBe(recorded)
    expect(team?.heldAtStart({ kind: 'resume', id: 'r1' }, block, null)).toBeNull()
    expect(team?.records).toBe(true)
  })

  test('its start puts no words on the line: the plugin folder carries the block', () => {
    expect(team?.atStart({ kind: 'new', id: 'n1' }, '/t.md')).toEqual([])
  })

  // 1.214: its resumes are not granted the folder, so the block is where the model learns of it.
  test("its facts name the project's files folder; the other agents' do not", () => {
    const input = {
      project: 'menkar',
      name: 'menkar-t3',
      orchestrator: { name: 'set' },
      skills: [],
      context: { warn: 60, full: 90 },
      filesFolder: '/h/Menkar/menkar',
    } as const
    if (!team) throw new Error('no team')
    expect(teamFacts(input, team)).toContain(
      "The project's files folder is `/h/Menkar/menkar` (`$MENKAR_FILES`)",
    )
    const { filesFolder: _, ...without } = input
    expect(teamFacts(without, team)).not.toContain('files folder')
    for (const agent of ['claude', 'codex', 'opencode'] as const) {
      const other = kitOf(agent).team
      if (other) expect(teamFacts(input, other)).not.toContain('/h/Menkar/menkar')
    }
  })

  test('skills are loaded by reading their SKILL.md, named by path', () => {
    expect(team?.own('worker', '/opt/Menkar/resources/plugin/skills')).toBe(
      '`menkar:worker` (`/opt/Menkar/resources/plugin/skills/worker/SKILL.md`)',
    )
    expect(team?.skill('packager', '/w/.claude/skills/packager/SKILL.md')).toBe(
      '`packager` (`/w/.claude/skills/packager/SKILL.md`)',
    )
    expect(team?.part).toBe('cursor.md')
  })
})

describe("a new session's id against Cursor's floor", () => {
  test.each([
    [NEW_ID_FLOOR, true],
    ['2026.11.13-eacade1', true],
    ['2026.12.2-0f00f00', true],
    ['2026.11.12-aaaaaaa', false],
    ['not a version', false],
    [null, false],
  ])('%s takes an id: %s', (installed, takes) => {
    const id = kit.ids.newId(installed)
    expect(id !== null).toBe(takes)
    if (id)
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(team?.floor?.accepts(installed ?? '')).toBe(takes)
  })

  test("the floor reads the version Cursor prints, and is the descriptor's", () => {
    expect(team?.floor?.read('2026.11.13-eacade1\n')).toBe('2026.11.13-eacade1')
    expect(team?.floor?.version).toBe(NEW_ID_FLOOR)
  })
})

describe('what a compaction leaves a Cursor session holding', () => {
  test('a new chat keeps the block its sessionStart gave it', () => {
    expect(team?.startedWith?.({ kind: 'new', id: 'n1' }, block)).toBe(block)
  })

  test('a resume was given no block: after a compaction it is told the whole of it again', () => {
    expect(team?.startedWith?.({ kind: 'resume', id: 'r1' }, block)).toBeNull()
  })

  test("the other agents' compaction rebuilds the block they are started with", () => {
    for (const id of ['claude', 'codex', 'opencode'] as const)
      expect(kitOf(id).team?.startedWith).toBeUndefined()
  })
})
