import { describe, expect, test } from 'vitest'
import {
  addMember,
  clearLeader,
  createProject,
  deleteProject,
  freshProjects,
  GROUP_COLORS,
  joinTarget,
  moveMember,
  newGroup,
  newProjectId,
  projectOf,
  removeMember,
  renameProject,
  setCollapsed,
  setGroup,
  setLeader,
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

describe('dragging a row (2026-11-10)', () => {
  const state = () =>
    projects([
      {
        ...project(
          'a',
          'Work',
          ['s1', 'g1', 's2', 'g2', 'h', 's3', 'g3'],
          [group('UI', ['g1', 'g2', 'g3'])],
        ),
        hidden: ['h'],
      },
    ])
  const members = (after: ReturnType<typeof state>) => after.projects[0]?.members
  const groupMembers = (after: ReturnType<typeof state>) => after.projects[0]?.groups[0]?.members

  test("within a group: the group's order changes, the project's does not", () => {
    const after = moveMember(state(), 'g3', 'g1', 'before')
    expect(groupMembers(after)).toEqual(['g3', 'g1', 'g2'])
    expect(members(after)).toEqual(members(state()))
    expect(groupMembers(moveMember(state(), 'g1', 'g3', 'after'))).toEqual(['g2', 'g3', 'g1'])
  })

  test('within "No group": the project\'s order changes, the groups\' does not', () => {
    const after = moveMember(state(), 's3', 's1', 'before')
    expect(members(after)).toEqual(['s3', 's1', 'g1', 's2', 'g2', 'h', 'g3'])
    expect(after.projects[0]?.groups).toEqual(state().projects[0]?.groups)
  })

  test('a drop onto another group, or between "No group" and a group, changes nothing', () => {
    const before = state()
    expect(moveMember(before, 'g1', 's1', 'before')).toBe(before)
    expect(moveMember(before, 's1', 'g2', 'after')).toBe(before)
    const two = projects([
      project('a', 'Work', ['x1', 'x2', 'y1'], [group('X', ['x1', 'x2']), group('Y', ['y1'])]),
    ])
    expect(moveMember(two, 'x1', 'y1', 'after')).toBe(two)
  })

  test('a hidden member not shown keeps its place between the rows it sat between', () => {
    // Shown: s1 s2 s3 (h hidden between s2 and s3). s1 dropped after s3, the last shown row.
    expect(members(moveMember(state(), 's1', 's3', 'after'))).toEqual([
      'g1',
      's2',
      'g2',
      'h',
      's3',
      's1',
      'g3',
    ])
    // s3 dropped before s2: h stays after s2.
    expect(members(moveMember(state(), 's3', 's2', 'before'))).toEqual([
      's1',
      'g1',
      's3',
      's2',
      'g2',
      'h',
      'g3',
    ])
    // Shown, it moves as the rest.
    expect(members(moveMember(state(), 'h', 's1', 'before'))).toEqual([
      'h',
      's1',
      'g1',
      's2',
      'g2',
      's3',
      'g3',
    ])
  })

  test('a drop onto itself, a session in no project, or a target outside the project, changes nothing', () => {
    const before = state()
    expect(moveMember(before, 's1', 's1', 'after')).toBe(before)
    expect(moveMember(before, 'zz', 's1', 'before')).toBe(before)
    expect(moveMember(before, 's1', 'zz', 'before')).toBe(before)
  })
})

describe('a group leader and a collapsed group (1.54)', () => {
  const state = (leader?: string) =>
    projects([
      project(
        'p',
        'P',
        ['a', 'b', 'c', 'x'],
        [{ ...group('g', ['a', 'b', 'c']), ...(leader ? { leader } : {}) }, group('other', ['x'])],
      ),
      project('q', 'Q'),
    ])
  const g = (after: ReturnType<typeof state>) =>
    after.projects[0]?.groups.find((each) => each.name === 'g')

  test('making a member leader puts it first; another replaces it; clearing keeps the order', () => {
    const c = setLeader(state(), 'c')
    expect(g(c)).toMatchObject({ leader: 'c', members: ['c', 'a', 'b'] })
    const a = setLeader(c, 'a')
    expect(g(a)).toMatchObject({ leader: 'a', members: ['a', 'c', 'b'] })
    const cleared = clearLeader(a, 'a')
    expect(g(cleared)).not.toHaveProperty('leader')
    expect(g(cleared)?.members).toEqual(['a', 'c', 'b'])
  })

  test('a session in "No group" or in no project cannot lead', () => {
    const loose = projects([project('p', 'P', ['a', 'n'], [group('g', ['a'])])])
    expect(setLeader(loose, 'n')).toBe(loose)
    expect(setLeader(loose, 'nowhere')).toBe(loose)
  })

  test('the leader stays first when rows are dragged', () => {
    expect(moveMember(state('a'), 'a', 'c', 'after')).toEqual(state('a'))
    expect(g(moveMember(state('a'), 'c', 'a', 'before'))?.members).toEqual(['a', 'c', 'b'])
  })

  test.each<[string, (s: ReturnType<typeof state>) => ReturnType<typeof state>]>([
    ['moved to No group', (s) => setGroup(s, 'p', 'b', null)],
    ['moved to another group', (s) => setGroup(s, 'p', 'b', { name: 'other', color: '#5ec4b6' })],
    ['moved to a new group', (s) => ok(newGroup(s, 'p', 'b', 'fresh')).projects],
    ['removed from the project', (s) => removeMember(s, 'b')],
    ['moved to another project', (s) => addMember(s, 'q', 'b')],
  ])('the leader %s leaves its group without a leader', (_, change) => {
    const before = setLeader(state(), 'b')
    expect(g(before)?.leader).toBe('b')
    const after = g(change(before))
    expect(after).not.toHaveProperty('leader')
    expect(after?.members).not.toContain('b')
  })

  test("picking a session's own group again changes nothing: it keeps its place and its lead", () => {
    const led = setLeader(state(), 'b')
    expect(setGroup(led, 'p', 'b', { name: 'g', color: '#5ec4b6' })).toBe(led)
    const plain = state()
    expect(setGroup(plain, 'p', 'a', { name: 'g', color: '#5ec4b6' })).toBe(plain)
  })

  test('a session joining a collapsed group keeps it collapsed', () => {
    const collapsed = setCollapsed(state(), 'p', 'g', true)
    expect(g(collapsed)?.collapsed).toBe(true)
    const joined = g(setGroup(collapsed, 'p', 'x', { name: 'g', color: '#5ec4b6' }))
    expect(joined).toMatchObject({ collapsed: true, members: ['a', 'b', 'c', 'x'] })
    expect(g(setCollapsed(collapsed, 'p', 'g', false))).not.toHaveProperty('collapsed')
  })
})

describe("a project's files folder (decision 1.51)", () => {
  const named = projects([{ ...project('a', 'Work'), filesFolder: 'Work' }])

  test('a rename keeps the saved folder name unless told the folder moved', () => {
    expect(ok(renameProject(named, 'a', 'Job')).projects.projects[0]?.filesFolder).toBe('Work')
    expect(ok(renameProject(named, 'a', 'Job', 'Job')).projects.projects[0]?.filesFolder).toBe(
      'Job',
    )
  })
})
