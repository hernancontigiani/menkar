import { describe, expect, test } from 'vitest'
import {
  addMember,
  createProject,
  deleteProject,
  freshProjects,
  GROUP_COLORS,
  joinTarget,
  newGroup,
  newProjectId,
  projectOf,
  removeMember,
  renameProject,
  setGroup,
} from '../../../src/core/projects/model'
import { group, project, projects } from '../../factories/projects'

const ok = <T extends { ok: boolean }>(result: T) => {
  expect(result.ok).toBe(true)
  return result as Extract<T, { ok: true }>
}

describe('the model', () => {
  test('PRJ-1 a fresh state is one empty Default, current, with no windows', () => {
    const fresh = freshProjects(() => 'abc123abc123')
    expect(fresh).toEqual({
      current: 'abc123abc123',
      projects: [{ id: 'abc123abc123', name: 'Default', members: [], groups: [], rest: {} }],
      windows: [],
      rest: {},
    })
  })

  test('a project id is 12 lowercase hex characters', () => {
    expect(newProjectId()).toMatch(/^[0-9a-f]{12}$/)
  })

  test('PRJ-11 a name of spaces is refused', () => {
    expect(createProject(projects([project('a', 'Work')]), '  ', 'b')).toEqual({
      ok: false,
      refusal: 'projects.nameEmpty',
    })
  })

  test('PRJ-12 a name equal to another ignoring case and spaces is refused', () => {
    expect(createProject(projects([project('a', 'Work')]), 'work ', 'b')).toEqual({
      ok: false,
      refusal: 'projects.nameTaken',
    })
  })

  test('PRJ-13 a created project is appended, trimmed, empty, and current', () => {
    const { projects: after } = ok(createProject(projects([project('a', 'Work')]), ' Infra ', 'b'))
    expect(after.projects.map((p) => [p.id, p.name])).toEqual([
      ['a', 'Work'],
      ['b', 'Infra'],
    ])
    expect(after.current).toBe('b')
  })

  test('PRJ-14 renaming to a different case of its own name is allowed; to another project’s is not', () => {
    const state = projects([project('a', 'Work'), project('b', 'Docs')])
    expect(ok(renameProject(state, 'a', 'WORK')).projects.projects[0]?.name).toBe('WORK')
    expect(renameProject(state, 'b', 'work')).toEqual({ ok: false, refusal: 'projects.nameTaken' })
    expect(renameProject(state, 'b', ' ')).toEqual({ ok: false, refusal: 'projects.nameEmpty' })
  })

  test('PRJ-15 the last project cannot be deleted', () => {
    expect(deleteProject(projects([project('a', 'Only')]), 'a')).toEqual({
      ok: false,
      refusal: 'projects.lastProject',
    })
  })

  test('PRJ-16 deleting a project releases its members and moves current to the first remaining', () => {
    const state = projects(
      [project('a', 'A', ['s9']), project('p', 'P', ['s1', 's2'], [group('g', ['s1'])])],
      'p',
    )
    const { projects: after } = ok(deleteProject(state, 'p'))
    expect(after.projects.map((p) => p.id)).toEqual(['a'])
    expect(after.current).toBe('a')
    expect(projectOf(after, 's1')).toBeUndefined()
    expect(projectOf(after, 's2')).toBeUndefined()
  })

  test('PRJ-22 a new group takes the palette color by the number of groups after the drop; a repeat name is refused', () => {
    const state = projects([project('a', 'A', ['s1', 's3'], [group('api', ['s1'])])])
    const { projects: after } = ok(newGroup(state, 'a', 's3', ' pair '))
    expect(after.projects[0]?.groups).toEqual([
      group('api', ['s1']),
      group('pair', ['s3'], '#c17be0'),
    ])
    expect(newGroup(after, 'a', 's1', 'PAIR')).toEqual({ ok: false, refusal: 'groups.nameTaken' })
    expect(newGroup(after, 'a', 's1', '')).toEqual({ ok: false, refusal: 'groups.nameEmpty' })
    expect(GROUP_COLORS).toEqual(['#5ec4b6', '#c17be0', '#e0b45b', '#7fb2ff', '#e57c9a'])
  })

  test('PRJ-22 the color counts the groups left after the session leaves an emptied one', () => {
    const state = projects([project('a', 'A', ['s1'], [group('solo', ['s1'])])])
    const { projects: after } = ok(newGroup(state, 'a', 's1', 'next'))
    expect(after.projects[0]?.groups).toEqual([group('next', ['s1'], GROUP_COLORS[0])])
  })

  test('PRJ-23 No group drops a group the move emptied', () => {
    const state = projects([project('a', 'A', ['s1'], [group('solo', ['s1'])])])
    expect(setGroup(state, 'a', 's1', null).projects[0]?.groups).toEqual([])
  })

  test('PRJ-24 moving to another group appends the session there', () => {
    const state = projects([
      project('a', 'A', ['s1', 's2'], [group('g1', ['s1']), group('g2', ['s2'], '#c17be0')]),
    ])
    expect(
      setGroup(state, 'a', 's1', { name: 'g2', color: '#c17be0' }).projects[0]?.groups,
    ).toEqual([group('g2', ['s2', 's1'], '#c17be0')])
  })

  test('a group dropped since the menu was built comes back with this session alone, name and color kept', () => {
    const state = projects([project('a', 'A', ['s1'])])
    expect(
      setGroup(state, 'a', 's1', { name: 'old', color: '#e0b45b' }).projects[0]?.groups,
    ).toEqual([group('old', ['s1'], '#e0b45b')])
  })

  test('PRJ-25 removing a member takes it out of its group too', () => {
    const state = projects([project('a', 'A', ['s1', 's2'], [group('g', ['s1'])])])
    const after = removeMember(state, 's1')
    expect(after.projects[0]).toMatchObject({ members: ['s2'], groups: [] })
  })

  test('F23 adding a session takes it out of its previous project and that project’s group', () => {
    const state = projects([
      project('r', 'Research', ['s1', 's2'], [group('g', ['s1', 's2'])]),
      project('a', 'A'),
    ])
    const after = addMember(state, 'a', 's1')
    expect(after.projects).toMatchObject([
      { id: 'r', members: ['s2'], groups: [{ name: 'g', members: ['s2'] }] },
      { id: 'a', members: ['s1'] },
    ])
    expect(addMember(after, 'a', 's1')).toEqual(after)
  })

  test('PRJ-36/37, SES-44 a new session joins the project its tab was started in, else current', () => {
    const state = projects([project('a', 'A'), project('b', 'B')], 'a')
    expect(joinTarget(state, 'b')).toBe('b')
    expect(joinTarget(state, 'gone')).toBe('a')
  })

  test('PRJ-57 the member count counts members whose transcript is gone', () => {
    expect(projects([project('a', 'A', ['known', 'deleted'])]).projects[0]?.members).toHaveLength(2)
  })
})
