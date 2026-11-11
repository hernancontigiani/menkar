import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { beforeEach, describe, expect, test } from 'vitest'
import { renameProject } from '../../../src/core/projects/model'
import {
  loadProjects,
  parseProjects,
  projectsPath,
  saveProjects,
  serializeProjects,
} from '../../../src/core/projects/store'

const dir = () => join(projectsPath(), '..')

beforeEach(async () => {
  const { rm } = await import('node:fs/promises')
  await rm(dir(), { recursive: true, force: true })
  await mkdir(dir(), { recursive: true })
})

const valid = (extra: Record<string, unknown> = {}) => ({
  version: 1,
  current: 'a',
  projects: [{ id: 'a', name: 'A', members: [], groups: [] }],
  ...extra,
})

async function unreadable(content: string) {
  await writeFile(projectsPath(), content)
  const loaded = await loadProjects()
  expect(loaded.projects.projects.map((p) => [p.name, p.members])).toEqual([['Default', []]])
  expect(loaded.movedTo).toMatch(/^projects\.json\.broken-\d{8}-\d{6}$/)
  expect(await readFile(join(dir(), loaded.movedTo ?? ''), 'utf8')).toBe(content)
  expect(await readdir(dir())).toEqual([loaded.movedTo])
  return loaded
}

describe('projects.json', () => {
  test('PRJ-1 no file: one empty Default, and nothing is created on disk', async () => {
    const loaded = await loadProjects()
    expect(loaded.movedTo).toBeNull()
    expect(loaded.projects.projects.map((p) => p.name)).toEqual(['Default'])
    expect(loaded.projects.current).toBe(loaded.projects.projects[0]?.id)
    expect(await readdir(dir())).toEqual([])
  })

  test('PRJ-2 a file that is not JSON is moved aside, never deleted, and a fresh Default starts', async () => {
    await unreadable('{')
  })

  test('PRJ-3 version 2 is unreadable', async () => {
    await unreadable(JSON.stringify(valid({ version: 2 })))
  })

  test('PRJ-4 an empty projects list is unreadable', async () => {
    await unreadable(JSON.stringify(valid({ projects: [] })))
  })

  test('PRJ-5 members that are a string make the file unreadable', async () => {
    await unreadable(JSON.stringify(valid({ projects: [{ id: 'a', name: 'A', members: 'abc' }] })))
  })

  test.each([
    ['an id that is not a string', { projects: [{ id: 1, name: 'A' }] }],
    ['a name that is not a string', { projects: [{ id: 'a', name: null }] }],
    ['a group that is not an object', { projects: [{ id: 'a', name: 'A', groups: ['g'] }] }],
    [
      'a group name that is not a string',
      { projects: [{ id: 'a', name: 'A', groups: [{ members: [] }] }] },
    ],
    [
      'group members that are not strings',
      { projects: [{ id: 'a', name: 'A', members: ['s'], groups: [{ name: 'g', members: [1] }] }] },
    ],
    ['a top level that is not an object', null],
  ])('%s makes the file unreadable', (_what, change) => {
    expect(() => parseProjects(change === null ? [1] : valid(change))).toThrow()
  })

  test('PRJ-6 a session in two projects stays in the first only', () => {
    const parsed = parseProjects(
      valid({
        projects: [
          { id: 'a', name: 'A', members: ['S'] },
          { id: 'b', name: 'B', members: ['S', 'T'] },
        ],
      }),
    )
    expect(parsed.projects.map((p) => p.members)).toEqual([['S'], ['T']])
    expect(
      (serializeProjects(parsed).projects as Array<{ members: string[] }>).map((p) => p.members),
    ).toEqual([['S'], ['T']])
  })

  test('PRJ-7 a group member not in its project is dropped, and a group left empty is gone', () => {
    const parsed = parseProjects(
      valid({
        projects: [
          {
            id: 'a',
            name: 'A',
            members: ['s1'],
            groups: [
              { name: 'g', members: ['s1', 'x'] },
              { name: 'e', members: ['x'] },
            ],
          },
        ],
      }),
    )
    expect(parsed.projects[0]?.groups).toEqual([{ name: 'g', color: '#5ec4b6', members: ['s1'] }])
  })

  test('PRJ-8 a group with no color takes #5ec4b6; another value is stringified', () => {
    const parsed = parseProjects(
      valid({
        projects: [
          {
            id: 'a',
            name: 'A',
            members: ['s1', 's2'],
            groups: [
              { name: 'g', members: ['s1'] },
              { name: 'h', color: 7, members: ['s2'] },
            ],
          },
        ],
      }),
    )
    expect(parsed.projects[0]?.groups.map((g) => g.color)).toEqual(['#5ec4b6', '7'])
  })

  test('PRJ-9 a current that names no project is the first project', () => {
    expect(parseProjects(valid({ current: 'nope' })).current).toBe('a')
  })

  test('PRJ-10 unknown keys at the top and in a project survive a rename; a group’s do not; windows not an array → []', async () => {
    const file = {
      future: { x: 1 },
      version: 1,
      current: 'a',
      projects: [{ id: 'a', name: 'A', pinned: true, members: [], groups: [] }],
      windows: 'junk',
    }
    await writeFile(projectsPath(), JSON.stringify(file))
    const { projects } = await loadProjects()
    expect(projects.windows).toEqual([])
    const renamed = renameProject(projects, 'a', 'B')
    if (!renamed.ok) throw new Error(renamed.refusal)
    await saveProjects(renamed.projects, [])
    const saved = JSON.parse(await readFile(projectsPath(), 'utf8'))
    expect(saved.future).toEqual({ x: 1 })
    expect(saved.projects[0]).toEqual({ pinned: true, id: 'a', name: 'B', members: [], groups: [] })
    expect(
      parseProjects(
        valid({
          projects: [
            {
              id: 'a',
              name: 'A',
              members: ['s'],
              groups: [{ name: 'g', members: ['s'], extra: 1 }],
            },
          ],
        }),
      ).projects[0]?.groups[0],
    ).toEqual({
      name: 'g',
      color: '#5ec4b6',
      members: ['s'],
    })
  })

  describe('a collapsed group and its leader (1.54)', () => {
    const file = (g: Record<string, unknown>) =>
      valid({ projects: [{ id: 'a', name: 'A', members: ['a1', 'b'], groups: [g] }] })
    const written = (g: Record<string, unknown>) =>
      (serializeProjects(parseProjects(file(g))).projects as { groups: unknown[] }[])[0]?.groups[0]

    test('collapsed and a leader that is a member round-trip, after the members', () => {
      const g = { name: 'g', color: '#5ec4b6', members: ['b', 'a1'], collapsed: true, leader: 'b' }
      expect(parseProjects(file(g)).projects[0]?.groups[0]).toEqual(g)
      expect(JSON.stringify(written(g))).toBe(JSON.stringify(g))
    })

    test('a leader written anywhere but first is read back first', () => {
      const g = { name: 'g', color: '#5ec4b6', members: ['a1', 'b'], leader: 'b' }
      expect(parseProjects(file(g)).projects[0]?.groups[0]?.members).toEqual(['b', 'a1'])
    })

    test.each([false, 'yes'])('collapsed: %j reads as expanded and is not written', (collapsed) => {
      const g = { name: 'g', color: '#5ec4b6', members: ['a1'], collapsed }
      expect(parseProjects(file(g)).projects[0]?.groups[0]).not.toHaveProperty('collapsed')
      expect(written(g)).toEqual({ name: 'g', color: '#5ec4b6', members: ['a1'] })
    })

    test('a leader that is not a member of the group is dropped; the file is still read', () => {
      const g = { name: 'g', color: '#5ec4b6', members: ['a1'], leader: 'zz' }
      expect(parseProjects(file(g)).projects[0]?.groups[0]).toEqual({
        name: 'g',
        color: '#5ec4b6',
        members: ['a1'],
      })
      expect(written({ ...g, leader: 'b' })).toEqual({
        name: 'g',
        color: '#5ec4b6',
        members: ['a1'],
      })
    })

    // The guard against rewriting every projects.json on the first save after this change.
    test('a group with neither key is written with exactly name, color and members', () => {
      const g = { name: 'g', color: '#5ec4b6', members: ['a1', 'b'] }
      expect(JSON.stringify(written(g))).toBe(JSON.stringify(g))
    })
  })

  test("a project's files folder name round-trips after hidden; one that is not a string is dropped", () => {
    const file = valid({
      projects: [
        {
          id: 'a',
          name: 'A',
          members: [],
          groups: [],
          files_folder: 'A (2)',
          files_collapsed: true,
        },
      ],
    })
    const parsed = parseProjects(file)
    expect(parsed.projects[0]?.filesFolder).toBe('A (2)')
    expect(JSON.stringify(serializeProjects(parsed).projects)).toBe(JSON.stringify(file.projects))
    const bad = parseProjects(
      valid({ projects: [{ id: 'a', name: 'A', members: [], groups: [], files_folder: 7 }] }),
    )
    expect(bad.projects[0]).not.toHaveProperty('filesFolder')
    expect(serializeProjects(bad).projects).toEqual([
      { id: 'a', name: 'A', members: [], groups: [] },
    ])
  })

  test('PRJ-55 the written form: 2 spaces, non-ASCII as is, unknown keys first, then version, current, projects, windows', async () => {
    const parsed = parseProjects({
      zeta: 1,
      version: 1,
      current: 'a',
      projects: [{ id: 'a', name: 'Café', members: [] }],
    })
    await saveProjects(parsed, [{ current: 'a', tabs: {} }])
    const text = await readFile(projectsPath(), 'utf8')
    expect(text).toBe(
      [
        '{',
        '  "zeta": 1,',
        '  "version": 1,',
        '  "current": "a",',
        '  "projects": [',
        '    {',
        '      "id": "a",',
        '      "name": "Café",',
        '      "members": [],',
        '      "groups": []',
        '    }',
        '  ],',
        '  "windows": [',
        '    {',
        '      "current": "a",',
        '      "tabs": {}',
        '    }',
        '  ]',
        '}',
        '',
      ].join('\n'),
    )
  })
})
