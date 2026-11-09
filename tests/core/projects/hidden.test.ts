import { describe, expect, test } from 'vitest'
import { addMember, hideMember, removeMember, showMember } from '../../../src/core/projects/model'
import { parseProjects, serializeProjects } from '../../../src/core/projects/store'
import { group, project, projects } from '../../factories/projects'

const state = projects([
  project('a', 'Work', ['s1', 's2'], [group('pair', ['s1'])]),
  project('b', 'Research', ['s3']),
])
const hiddenOf = (s: ReturnType<typeof projects>, id: string) =>
  s.projects.find((p) => p.id === id)?.hidden ?? []

describe('hidden in a project (decision 1.25)', () => {
  test('a stopped member is hidden in its own project only, and stays a member and in its group', () => {
    const result = hideMember(state, 's1', false)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(hiddenOf(result.projects, 'a')).toEqual(['s1'])
    expect(hiddenOf(result.projects, 'b')).toEqual([])
    expect(result.projects.projects[0]?.members).toEqual(['s1', 's2'])
    expect(result.projects.projects[0]?.groups).toEqual([group('pair', ['s1'])])
  })

  test('a running member is refused: close its tab first', () => {
    expect(hideMember(state, 's1', true)).toEqual({ ok: false, refusal: 'projects.hideRunning' })
  })

  test('Show takes it back into the list; showing a member that is not hidden changes nothing', () => {
    const hidden = hideMember(state, 's2', false)
    if (!hidden.ok) throw new Error('refused')
    expect(hiddenOf(showMember(hidden.projects, 's2'), 'a')).toEqual([])
    expect(showMember(state, 's2')).toBe(state)
  })

  test('a member leaving the project, removed or moved, leaves its hidden list too', () => {
    const hidden = hideMember(state, 's1', false)
    if (!hidden.ok) throw new Error('refused')
    expect(hiddenOf(removeMember(hidden.projects, 's1'), 'a')).toEqual([])
    const moved = addMember(hidden.projects, 'b', 's1')
    expect(hiddenOf(moved, 'a')).toEqual([])
    expect(hiddenOf(moved, 'b')).toEqual([])
  })

  test('the file keeps the list, drops ids that are not members, and reads a malformed one as none', () => {
    const file = (hidden: unknown) => ({
      version: 1,
      current: 'a',
      projects: [{ id: 'a', name: 'Work', members: ['s1', 's2'], groups: [], hidden }],
      windows: [],
    })
    const read = parseProjects(file(['s2', 'gone', 's2', 7]))
    expect(read.projects[0]?.hidden).toEqual(['s2'])
    expect((serializeProjects(read).projects as { hidden?: string[] }[])[0]?.hidden).toEqual(['s2'])
    expect(parseProjects(file('not a list')).projects[0]?.hidden).toBeUndefined()
    const none = parseProjects(file(undefined))
    expect('hidden' in ((serializeProjects(none).projects as object[])[0] ?? {})).toBe(false)
  })
})
