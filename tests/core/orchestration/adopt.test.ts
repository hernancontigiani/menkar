// Decision 1.102: the orchestrator makes a session of its project its child (adopt_session), only
// while the mode is on; nobody else may. Taking a session back removes its parent.
import { describe, expect, test } from 'vitest'
import { adopt } from '../../../src/core/orchestration/adopt'
import type { Project } from '../../../src/core/projects/model'
import { clearParent, keptParents } from '../../../src/core/projects/parents'
import { project, projects } from '../../factories/projects'

const team = (on: boolean): Project => ({
  ...project('p1', 'Team', ['O', 'W', 'X']),
  parents: { X: 'O' },
  orchestration: { on, orchestrator: 'O' },
})

const parentsOf = (state: ReturnType<typeof projects>) =>
  keptParents(state.projects[0] ?? project('p1', 'Team'))

describe('adopting a session', () => {
  test("the orchestrator adopts W: W's parent is the orchestrator", () => {
    const result = adopt(projects([team(true)]), 'O', 'W')
    if ('refusal' in result) throw new Error(result.refusal)
    expect(parentsOf(result.projects)).toEqual({ X: 'O', W: 'O' })
  })

  test('a worker calling is refused, and nothing changes', () => {
    expect(adopt(projects([team(true)]), 'W', 'X')).toEqual({
      refusal: 'Only the orchestrator can adopt a session.',
    })
  })

  test('with the mode off, even the orchestrator is refused', () => {
    expect(adopt(projects([team(false)]), 'O', 'W')).toEqual({
      refusal: 'The orchestration mode is off in this project.',
    })
  })

  test('the orchestrator cannot adopt itself', () => {
    expect(adopt(projects([team(true)]), 'O', 'O')).toEqual({
      refusal: 'The orchestrator cannot adopt itself.',
    })
  })

  test('taking a session back removes its parent, and only its own', () => {
    const state = projects([{ ...team(true), parents: { X: 'O', W: 'O' } }])
    expect(parentsOf(clearParent(state, 'X'))).toEqual({ W: 'O' })
  })
})
