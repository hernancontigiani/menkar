import { describe, expect, test } from 'vitest'
import { earlierIds, keptEarlier, releaseEarlier } from '../../../src/core/projects/earlier'
import { parseProjects, serializeProjects } from '../../../src/core/projects/store'
import { project, projects } from '../../factories/projects'

describe('earlier conversations', () => {
  test('opening one makes it an ordinary session again; the list goes when it empties', () => {
    const state = projects([
      { ...project('p1', 'Work', ['now', 'a', 'b']), earlier: { now: ['a', 'b'] } },
    ])
    const once = releaseEarlier(state, 'a')
    expect(once.projects[0]?.earlier).toEqual({ now: ['b'] })
    expect(releaseEarlier(once, 'b').projects[0]).toEqual(project('p1', 'Work', ['now', 'a', 'b']))
    expect(releaseEarlier(state, 'now')).toBe(state)
  })

  test('only members count, an id in one list at most and never a key, and no empty list', () => {
    const p = {
      ...project('p1', 'Work', ['k1', 'k2', 'a', 'b']),
      earlier: { k1: ['a', 'gone', 'k2'], k2: ['a', 'b'], gone: ['b'], k3: [] },
    }
    // `a` stays in the first list that has it; `k2` is a key, so in no list.
    expect(keptEarlier(p)).toEqual({ k1: ['a'], k2: ['b'] })
    expect(earlierIds(p)).toEqual(new Set(['a', 'b']))
  })

  test('the store writes them on the project and reads them back; a file without the key reads as before', () => {
    const state = projects([
      { ...project('p1', 'Work', ['now', 'a']), earlier: { now: ['a'] } },
      project('p2', 'Other', ['c']),
    ])
    const written = serializeProjects(state)
    expect((written.projects as Record<string, unknown>[]).map((p) => p.earlier)).toEqual([
      { now: ['a'] },
      undefined,
    ])
    expect(parseProjects(JSON.parse(JSON.stringify(written)))).toEqual(state)
    const plain = {
      version: 1,
      current: 'p1',
      projects: [{ id: 'p1', name: 'Work', members: ['x'], groups: [] }],
    }
    expect(parseProjects(plain)).toEqual(projects([project('p1', 'Work', ['x'])]))
    expect(serializeProjects(parseProjects(plain)).projects).toEqual([
      { id: 'p1', name: 'Work', members: ['x'], groups: [] },
    ])
  })

  test('a list the file holds is read leniently: ids not members and odd values are dropped', () => {
    const read = parseProjects({
      version: 1,
      current: 'p1',
      projects: [
        {
          id: 'p1',
          name: 'Work',
          members: ['now', 'a'],
          groups: [],
          earlier: { now: ['a', 'stranger', 7], stranger: ['a'], odd: 'x' },
        },
      ],
    })
    expect(read.projects[0]?.earlier).toEqual({ now: ['a'] })
    expect(
      parseProjects({ version: 1, current: 'p1', projects: [{ id: 'p1', name: 'W', earlier: 5 }] })
        .projects[0],
    ).toEqual(project('p1', 'W'))
  })
})
