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
