// What main hands `teamFacts` for a pane, read from the project's marks. Only with the
// mode on; a session not yet a member gets the identity it started with; a name is a custom title
// or the name Menkar started it with, never Claude's derived title.
import { expect, test } from 'vitest'
import type { Project } from '../../../src/core/projects/model'
import {
  setMode,
  setOrchestrator,
  setRole,
  setSkills,
} from '../../../src/core/projects/orchestration'
import { setParent } from '../../../src/core/projects/parents'
import { teamAgent } from '../../../src/core/team/block'
import { teamInput, teamText } from '../../../src/core/team/input'
import { project, projects } from '../../factories/projects'

const NAMES: Record<string, string> = { o1: 'set', e1: 'packager', w1: 'menkar-t3' }
const named = (id: string) => NAMES[id]
const context = { warn: 60, full: 90 }

function team(on = true): Project {
  let state = projects([project('p', 'menkar', ['o1', 'e1', 'w1', 'x1'])])
  state = setOrchestrator(setMode(state, 'p', on), 'p', 'o1')
  state = setRole(state, 'p', 'e1', 'Packaging')
  state = setParent(state, 'e1', 'o1')
  state = setParent(state, 'w1', 'e1')
  const own = setSkills(state, 'p', 'e1', [
    { name: 'packager', maintainer: true },
    { name: 'gone' },
  ])
  if (!own.ok) throw new Error('refused')
  const read = setSkills(own.projects, 'p', 'w1', [{ name: 'packager' }])
  if (!read.ok) throw new Error('refused')
  const p = read.projects.projects[0]
  if (!p) throw new Error('no project')
  return p
}

const found = (name: string) => name !== 'gone'

test('the mode off gives no input, so nothing is delivered', () => {
  expect(teamInput({ project: team(false), session: 'e1', named, found, context })).toBeNull()
})

test("an expert's input: its name, role, parent the orchestrator, skills with found", () => {
  expect(teamInput({ project: team(), session: 'e1', named, found, context })).toEqual({
    project: 'menkar',
    name: 'packager',
    role: 'Packaging',
    orchestrator: { name: 'set' },
    parent: { name: 'set', orchestrator: true },
    skills: [
      { name: 'packager', maintainer: true, found: true },
      { name: 'gone', maintainer: false, found: false },
    ],
    context,
  })
})

test('a read-only skill names the session that maintains it; another parent is not the orchestrator', () => {
  const input = teamInput({ project: team(), session: 'w1', named, found, context })
  expect(input?.parent).toEqual({ name: 'packager', orchestrator: false })
  expect(input?.skills).toEqual([
    { name: 'packager', maintainer: false, maintainedBy: 'packager', found: true },
  ])
})

test("the orchestrator is 'self'; a session with no name of its own has none", () => {
  expect(teamInput({ project: team(), session: 'o1', named, found, context })?.orchestrator).toBe(
    'self',
  )
  const loose = teamInput({ project: team(), session: 'x1', named, found, context })
  expect(loose).toEqual({ project: 'menkar', orchestrator: { name: 'set' }, skills: [], context })
})

test('a session not yet a member: the name it started with, no role, parent or skills', () => {
  expect(
    teamInput({ project: team(), session: null, startName: 'scratch', named, found, context }),
  ).toEqual({
    project: 'menkar',
    name: 'scratch',
    orchestrator: { name: 'set' },
    skills: [],
    context,
  })
})

test('the text: the facts alone, and the whole block with the parts after them', () => {
  const agent = teamAgent('claude')
  const input = teamInput({ project: team(), session: 'e1', named, found, context })
  if (!agent || !input) throw new Error('no input')
  const text = teamText(input, agent, '## How the team works\n- one\n', '- two\n')
  expect(text.facts.startsWith('# Your team in Menkar\nYou are `packager`')).toBe(true)
  expect(text.block).toBe(`${text.facts}\n\n## How the team works\n- one\n\n- two\n`)
})

test('another session with no name of its own is called by the first eight characters of its id', () => {
  let state = projects([project('p', 'menkar', ['0123456789ab', 'e1'])])
  state = setOrchestrator(setMode(state, 'p', true), 'p', '0123456789ab')
  const p = state.projects[0]
  if (!p) throw new Error('no project')
  expect(teamInput({ project: p, session: 'e1', named, found, context })?.orchestrator).toEqual({
    name: '01234567',
  })
})
