// The orchestration mode's marks live on the project in projects.json: switching the mode off
// keeps them, one orchestrator per project, and every move or removal of a session carries them.
import { describe, expect, test } from 'vitest'
import { forgetSession } from '../../../src/core/projects/earlier'
import { removeMember } from '../../../src/core/projects/model'
import {
  setMode,
  setOrchestrator,
  setPriority,
  setRole,
  setTopicsCollapsed,
  setWithYou,
} from '../../../src/core/projects/orchestration'
import { followNewId, followResume } from '../../../src/core/projects/rekey'
import { parseProjects, serializeProjects } from '../../../src/core/projects/store'
import { project, projects } from '../../factories/projects'

const work = () => projects([project('p1', 'Work', ['O', 'A', 'B', 'X'])])
const roundTrip = (state: ReturnType<typeof work>) =>
  parseProjects(JSON.parse(JSON.stringify(serializeProjects(state))))

const marked = () => {
  let s = setMode(work(), 'p1', true)
  s = setOrchestrator(s, 'p1', 'O')
  s = setRole(s, 'p1', 'X', 'Fabric expert')
  s = setPriority(s, 'p1', 'X', true)
  s = setWithYou(s, 'p1', 'X', true)
  return s
}

describe('orchestration marks', () => {
  test('switching the mode off keeps every mark, and they survive the file', () => {
    const off = roundTrip(setMode(marked(), 'p1', false))
    expect(off.projects[0]?.orchestration).toEqual({
      on: false,
      orchestrator: 'O',
      roles: { X: 'Fabric expert' },
      priority: ['X'],
      withYou: ['X'],
    })
    const written = serializeProjects(off).projects as Record<string, unknown>[]
    expect(written[0]?.orchestration).toEqual({
      on: false,
      orchestrator: 'O',
      roles: { X: 'Fabric expert' },
      priority: ['X'],
      with_you: ['X'],
    })
  })

  test('a project with nothing set writes no orchestration key', () => {
    const written = serializeProjects(work()).projects as Record<string, unknown>[]
    expect(written[0]).not.toHaveProperty('orchestration')
    expect(written[0]).not.toHaveProperty('topics_collapsed')
  })

  test('one orchestrator per project: marking B unmarks A', () => {
    const s = setOrchestrator(setOrchestrator(work(), 'p1', 'A'), 'p1', 'B')
    expect(s.projects[0]?.orchestration?.orchestrator).toBe('B')
    expect(setOrchestrator(s, 'p1', null).projects[0]?.orchestration?.orchestrator).toBeUndefined()
  })

  test('an empty role removes the label; unsetting ★ and with you removes the id', () => {
    let s = setRole(marked(), 'p1', 'X', '  ')
    s = setPriority(s, 'p1', 'X', false)
    s = setWithYou(s, 'p1', 'X', false)
    expect(s.projects[0]?.orchestration).toEqual({ on: true, orchestrator: 'O' })
  })

  test('the marks follow a /clear: X → Y, Y has the role and the ★, X none', () => {
    const s = followNewId(marked(), 'X', 'Y')
    expect(s.projects[0]?.orchestration).toEqual({
      on: true,
      orchestrator: 'O',
      roles: { Y: 'Fabric expert' },
      priority: ['Y'],
      withYou: ['Y'],
    })
    expect(followNewId(marked(), 'O', 'O2').projects[0]?.orchestration?.orchestrator).toBe('O2')
  })

  test('the marks follow an in-tab /resume, and the resumed session drops its marks elsewhere', () => {
    let s = projects([project('p1', 'Work', ['O', 'X']), project('p2', 'Other', ['R'])])
    s = setOrchestrator(s, 'p1', 'O')
    s = setRole(s, 'p1', 'X', 'Docs')
    s = setPriority(s, 'p2', 'R', true)
    const after = followResume(s, 'X', 'R', 'p1')
    expect(after.projects[0]?.orchestration).toEqual({
      on: false,
      orchestrator: 'O',
      roles: { R: 'Docs' },
    })
    expect(after.projects[1]?.orchestration).toBeUndefined()
  })

  test('leaving the project drops the marks: no key names X', () => {
    for (const s of [removeMember(marked(), 'X'), forgetSession(marked(), 'X')]) {
      expect(JSON.stringify(s.projects[0]?.orchestration)).not.toContain('"X"')
      expect(s.projects[0]?.orchestration?.orchestrator).toBe('O')
    }
    expect(removeMember(marked(), 'O').projects[0]?.orchestration?.orchestrator).toBeUndefined()
  })

  test('topics collapsed round-trips and is removed when expanded', () => {
    const s = setTopicsCollapsed(work(), 'p1', true)
    expect(roundTrip(s).projects[0]?.topicsCollapsed).toBe(true)
    expect(setTopicsCollapsed(s, 'p1', false).projects[0]).not.toHaveProperty('topicsCollapsed')
  })
})
