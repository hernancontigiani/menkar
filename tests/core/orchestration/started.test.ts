// Decision 1.111: start_session may start a session loose (no parent: a consultant, never woken
// for, never read only) and with the role label it is born with; no tool changes an existing one.
import { describe, expect, test } from 'vitest'
import { modeRows } from '../../../src/core/orchestration/rows'
import { placeStarted, readPlacement } from '../../../src/core/orchestration/started'
import type { Projects } from '../../../src/core/projects/model'
import { orchestrationInfo } from '../../../src/core/projects/orchestration'
import { keptParents } from '../../../src/core/projects/parents'
import { project, projects } from '../../factories/projects'

const team = (): Projects =>
  projects([
    {
      ...project('p1', 'Team', ['O', 'N']),
      orchestration: { on: true, orchestrator: 'O' },
    },
  ])

const only = (state: Projects) => state.projects[0] ?? project('p1', 'Team')

describe('starting a session with loose and role', () => {
  test('by default the caller becomes its parent, with no label', () => {
    const p = only(placeStarted(team(), 'p1', 'N', 'O', { loose: false, role: '' }))
    expect(keptParents(p)).toEqual({ N: 'O' })
    expect(orchestrationInfo(p).roles).toEqual({})
  })

  test('loose: no parent is recorded', () => {
    const p = only(placeStarted(team(), 'p1', 'N', 'O', { loose: true, role: '' }))
    expect(keptParents(p)).toEqual({})
  })

  test('loose drops a parent the session inherited from a stopped namesake', () => {
    const inherited = projects([{ ...only(team()), parents: { N: 'O' } }])
    expect(
      keptParents(only(placeStarted(inherited, 'p1', 'N', 'O', { loose: true, role: '' }))),
    ).toEqual({})
  })

  test('role: the label is set', () => {
    const p = only(placeStarted(team(), 'p1', 'N', 'O', { loose: false, role: 'Release' }))
    expect(orchestrationInfo(p).roles).toEqual({ N: 'Release' })
  })

  test('both together: a loose session with a label lands under "Consultants"', () => {
    const p = only(placeStarted(team(), 'p1', 'N', 'O', { loose: true, role: 'Fabric' }))
    const info = {
      id: p.id,
      name: p.name,
      members: p.members,
      hidden: [],
      groups: [],
      earlier: {},
      parents: keptParents(p),
      orchestration: orchestrationInfo(p),
      topicsCollapsed: false,
    }
    const rows = modeRows(info, {
      listed: ['O', 'N'],
      open: new Set(['O', 'N']),
      unfolded: new Set<string>(),
    })
    expect(rows.map((r) => (r.kind === 'session' ? r.id : r.kind))).toEqual(['O', 'heading', 'N'])
    expect(rows[1]).toEqual({ kind: 'heading', heading: 'consultants' })
  })

  test('the arguments: loose must be true or false, role text; an empty or blank role is none', () => {
    expect(readPlacement({})).toEqual({ loose: false, role: '' })
    expect(readPlacement({ loose: true, role: '  Release  ' })).toEqual({
      loose: true,
      role: 'Release',
    })
    expect(readPlacement({ role: '   ' })).toEqual({ loose: false, role: '' })
    expect(readPlacement({ loose: 'yes' })).toEqual({ refusal: 'loose must be true or false.' })
    expect(readPlacement({ role: 3 })).toEqual({ refusal: 'The role must be text.' })
  })
})
