// A session started for an agent that picks its own id holds a provisional one until it binds
// (plan 39 §2.5.2): placed at once as member, child and marks; the real id takes its place at the
// bind; dropped on load when Menkar stopped before it bound.
import { describe, expect, test } from 'vitest'
import { forgetSession } from '../../../src/core/projects/earlier'
import type { Project } from '../../../src/core/projects/model'
import {
  bindProvisional,
  dropProvisional,
  isProvisional,
  provisionalId,
} from '../../../src/core/projects/provisional'
import { group, project, projects } from '../../factories/projects'

const P = provisionalId('7c1e')
const REAL = '019a3f1e-7c2d-7b40-9e11-2f4a6b8c0d1e'

const team = (members: string[]): Project => ({
  ...project('p1', 'Work', members, [group('auth', [P, 'orch'])]),
  parents: { [P]: 'orch', child: P },
  hidden: [P],
})

describe('provisional ids', () => {
  test('are told apart from real ids', () => {
    expect(isProvisional(P)).toBe(true)
    expect(isProvisional(REAL)).toBe(false)
    expect(isProvisional('pending')).toBe(false)
  })

  test('the real id takes its place, group, hidden flag, parent and children; the provisional one is gone', () => {
    const state = projects([team(['orch', P, 'child']), project('p2', 'Other', ['x'])])
    const bound = bindProvisional(state, P, REAL)
    const p = bound.projects[0]
    expect(p?.members).toEqual(['orch', REAL, 'child'])
    expect(p?.groups).toEqual([group('auth', [REAL, 'orch'])])
    expect(p?.hidden).toEqual([REAL])
    expect(p?.parents).toEqual({ [REAL]: 'orch', child: REAL })
    expect(p?.earlier).toBeUndefined()
    expect(bound.projects[1]).toEqual(state.projects[1])
  })

  test('earlier conversations it took over by name stay the real id’s', () => {
    const state = projects([
      { ...project('p1', 'Work', ['orch', P, 'old']), earlier: { [P]: ['old'] } },
    ])
    expect(bindProvisional(state, P, REAL).projects[0]?.earlier).toEqual({ [REAL]: ['old'] })
  })

  test('nothing changes when the provisional id is in no project, or the real one is in one', () => {
    const state = projects([project('p1', 'Work', [P]), project('p2', 'Other', [REAL])])
    expect(bindProvisional(state, 'pending:none', 'fresh')).toBe(state)
    expect(bindProvisional(state, P, REAL)).toBe(state)
  })

  test('on load every provisional id leaves its project, as a forgotten session does', () => {
    const other = provisionalId('9d')
    const state = projects([team(['orch', P, 'child']), project('p2', 'Other', ['x', other])])
    const { projects: loaded, dropped } = dropProvisional(state)
    expect(dropped).toEqual([P, other])
    expect(loaded).toEqual(forgetSession(forgetSession(state, P), other))
    expect(loaded.projects.flatMap((p) => p.members)).toEqual(['orch', 'child', 'x'])
    expect(loaded.projects[0]?.parents).toBeUndefined()
  })

  test('a load with no provisional id changes nothing', () => {
    const state = projects([project('p1', 'Work', ['a'])])
    expect(dropProvisional(state)).toEqual({ projects: state, dropped: [] })
  })
})
