// Who notifies (decisions 1.99, 1.104): a muted session never does, in any mode; with the
// orchestration mode on, only the sessions under the orchestrator (its children) are quiet, unless
// the human marked one "with you"; the orchestrator and loose sessions notify as before.
import { describe, expect, test } from 'vitest'
import { notifiesFor } from '../../../src/core/orchestration/notifies'
import type { Project } from '../../../src/core/projects/model'
import { project } from '../../factories/projects'

const team = (on: boolean): Project => ({
  ...project('p1', 'Team', ['O', 'W', 'L', 'Y']),
  parents: { W: 'O', Y: 'O' },
  orchestration: { on, orchestrator: 'O', withYou: ['Y'] },
})

describe('who notifies', () => {
  test('mode on: the orchestrator, a loose session and a child "with you" notify; a child does not', () => {
    const p = team(true)
    expect(notifiesFor('O', p, [])).toBe(true)
    expect(notifiesFor('W', p, [])).toBe(false)
    expect(notifiesFor('L', p, [])).toBe(true)
    expect(notifiesFor('Y', p, [])).toBe(true)
  })

  test('a muted session never notifies, the orchestrator included', () => {
    expect(notifiesFor('L', team(true), ['L'])).toBe(false)
    expect(notifiesFor('O', team(true), ['O'])).toBe(false)
    expect(notifiesFor('L', team(false), ['L'])).toBe(false)
  })

  test('mode off: a child notifies as today', () => {
    expect(notifiesFor('W', team(false), [])).toBe(true)
  })

  test('a child of another session than the orchestrator is loose', () => {
    const p = { ...team(true), parents: { W: 'L' } }
    expect(notifiesFor('W', p, [])).toBe(true)
  })

  test('a session in no project notifies unless muted', () => {
    expect(notifiesFor('X', undefined, [])).toBe(true)
    expect(notifiesFor('X', undefined, ['X'])).toBe(false)
  })
})
