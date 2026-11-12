// a session started by another records its starter as its parent, on the
// project in projects.json, so Menkar knows whom to wake.
import { describe, expect, test } from 'vitest'
import { forgetSession } from '../../../src/core/projects/earlier'
import { keptParents, setParent } from '../../../src/core/projects/parents'
import { followNewId } from '../../../src/core/projects/rekey'
import { parseProjects, serializeProjects } from '../../../src/core/projects/store'
import { project, projects } from '../../factories/projects'

const withParents = (members: string[], parents: Record<string, string>) =>
  projects([{ ...project('p1', 'Work', members), parents }])

describe('parents', () => {
  test('the store writes them on the project and reads them back; a file without the key is unchanged', () => {
    const state = withParents(['orch', 'w1', 'w2'], { w1: 'orch', w2: 'orch' })
    const written = serializeProjects(state)
    expect((written.projects as Record<string, unknown>[])[0]?.parents).toEqual({
      w1: 'orch',
      w2: 'orch',
    })
    expect(parseProjects(JSON.parse(JSON.stringify(written)))).toEqual(state)
    const plain = {
      version: 1,
      current: 'p1',
      projects: [{ id: 'p1', name: 'Work', members: ['x'], groups: [] }],
    }
    expect(serializeProjects(parseProjects(plain)).projects).toEqual(plain.projects)
  })

  test('read leniently: an entry whose child or parent is not a member, or not a string, is dropped', () => {
    const read = parseProjects({
      version: 1,
      current: 'p1',
      projects: [
        {
          id: 'p1',
          name: 'Work',
          members: ['orch', 'w1'],
          groups: [],
          parents: { w1: 'orch', stranger: 'orch', w2: 'gone', orch: 7, self: 'self' },
        },
      ],
    })
    expect(read.projects[0]?.parents).toEqual({ w1: 'orch' })
    expect(keptParents({ ...project('p', 'P', ['a']), parents: { a: 'a' } })).toEqual({})
  })

  test('setParent records the starter, only when both are members of the same project', () => {
    const state = projects([project('p1', 'Work', ['orch', 'w1']), project('p2', 'Other', ['x'])])
    expect(setParent(state, 'w1', 'orch').projects[0]?.parents).toEqual({ w1: 'orch' })
    expect(setParent(state, 'x', 'orch')).toEqual(state)
  })

  test('followNewId moves a parent key (the child renewed) and a parent value (the parent renewed)', () => {
    const state = withParents(['orch', 'w1'], { w1: 'orch' })
    expect(followNewId(state, 'w1', 'w1b').projects[0]?.parents).toEqual({ w1b: 'orch' })
    expect(followNewId(state, 'orch', 'orch2').projects[0]?.parents).toEqual({ w1: 'orch2' })
  })

  test('a removed child leaves; a removed parent leaves its children without one', () => {
    const state = withParents(['orch', 'w1', 'w2'], { w1: 'orch', w2: 'w1' })
    expect(forgetSession(state, 'w2').projects[0]?.parents).toEqual({ w1: 'orch' })
    expect(forgetSession(state, 'orch').projects[0]?.parents).toEqual({ w2: 'w1' })
  })
})
