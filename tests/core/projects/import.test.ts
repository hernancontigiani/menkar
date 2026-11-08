import { chmod, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { addSink } from '../../../src/core/log'
import { agentPaths } from '../../../src/core/paths'
import { firstStartImport } from '../../../src/core/projects/import'
import { projectsPath } from '../../../src/core/projects/store'
import { statePath } from '../../../src/core/state'
import { ids } from '../../factories/projects'

const atDir = () => agentPaths().agentTabletConfig
const menkarDir = () => join(projectsPath(), '..')

beforeEach(async () => {
  await rm(atDir(), { recursive: true, force: true })
  await chmod(menkarDir(), 0o755).catch(() => undefined)
  await rm(menkarDir(), { recursive: true, force: true })
  vi.restoreAllMocks()
})

async function agentTablet(files: { projects?: unknown; state?: unknown }) {
  await mkdir(atDir(), { recursive: true })
  const write = (name: string, value: unknown) =>
    writeFile(
      join(atDir(), name),
      typeof value === 'string' ? value : JSON.stringify(value, null, 2),
    )
  if (files.projects !== undefined) await write('projects.json', files.projects)
  if (files.state !== undefined) await write('state.json', files.state)
}

const readMenkar = async () => ({
  projects: JSON.parse(await readFile(projectsPath(), 'utf8')),
  state: JSON.parse(await readFile(statePath(), 'utf8')),
})

const S = (n: number) => `s${n}`

const validProjects = {
  version: 1,
  current: 'b2',
  projects: [
    {
      id: 'a1',
      name: 'Client',
      members: [S(1), S(2)],
      groups: [{ name: 'api', color: '#c17be0', members: [S(1)] }],
    },
    {
      id: 'b2',
      name: 'Research',
      members: [S(3), S(4), S(5)],
      groups: [
        { name: 'x', color: '#e0b45b', members: [S(3)] },
        { name: 'y', members: [S(4)] },
      ],
    },
  ],
  windows: [{ current: 'a1', tabs: { a1: [{ panes: [S(1)], orientation: 'horizontal' }] } }],
}

const validState = {
  names: { [S(1)]: 'Billing', [S(2)]: 'Docs' },
  hidden: [S(5)],
  remote_control: [S(3)],
  settings: { ui_style: 'classic', scrollback: 5000 },
}

describe('the first-start import of agent-tablet’s data', () => {
  test('SES-71 both files valid: projects, ids, groups and colors, members, names, hidden, Remote Control, settings', async () => {
    await agentTablet({ projects: validProjects, state: validState })
    const result = await firstStartImport(ids('n'))
    expect(result).toMatchObject({ firstStart: true, notices: [] })
    const { projects, state } = await readMenkar()
    expect(projects.current).toBe('b2')
    expect(projects.projects).toEqual([
      {
        id: 'a1',
        name: 'Client',
        members: [S(1), S(2)],
        groups: [{ name: 'api', color: '#c17be0', members: [S(1)] }],
      },
      {
        id: 'b2',
        name: 'Research',
        members: [S(3), S(4), S(5)],
        groups: [
          { name: 'x', color: '#e0b45b', members: [S(3)] },
          { name: 'y', color: '#5ec4b6', members: [S(4)] },
        ],
      },
    ])
    expect(state).toEqual({
      names: { [S(1)]: 'Billing', [S(2)]: 'Docs' },
      hidden: [S(5)],
      remote_control: [S(3)],
      settings: { ui_style: 'classic', scrollback: 5000 },
    })
  })

  test('SES-72 no agent-tablet folder: one empty Default and default settings, no notice, both files written', async () => {
    const result = await firstStartImport(ids('n'))
    expect(result.notices).toEqual([])
    const { projects, state } = await readMenkar()
    expect(projects.projects.map((p: { name: string }) => p.name)).toEqual(['Default'])
    expect(state).toEqual({ names: {}, hidden: [] })
  })

  test('SES-73 a cut-off projects.json: Default and the projects notice; state still imported; their file untouched', async () => {
    await agentTablet({ projects: '{"version": 1, "projects": [', state: validState })
    const result = await firstStartImport(ids('n'))
    expect(result.notices).toEqual(['import.projectsUnreadable'])
    const { projects, state } = await readMenkar()
    expect(projects.projects.map((p: { name: string }) => p.name)).toEqual(['Default'])
    expect(state.hidden).toEqual([S(5)])
    expect(await readdir(atDir())).toEqual(['projects.json', 'state.json'])
  })

  test('SES-74 a state.json that is an array: the settings notice; projects still imported', async () => {
    await agentTablet({ projects: validProjects, state: [1, 2] })
    const result = await firstStartImport(ids('n'))
    expect(result.notices).toEqual(['import.stateUnreadable'])
    expect((await readMenkar()).projects.projects).toHaveLength(2)
  })

  test('SES-75 version 2 is unreadable', async () => {
    await agentTablet({ projects: { ...validProjects, version: 2 } })
    expect((await firstStartImport(ids('n'))).notices).toEqual(['import.projectsUnreadable'])
  })

  test('SES-76 a partly valid projects.json keeps the good entries, logs the dropped ones, shows no notice', async () => {
    const lines: string[] = []
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    const off = addSink((line) => lines.push(line))
    try {
      await agentTablet({
        projects: {
          version: 1,
          projects: [
            { id: 'a1', name: 'A', members: ['s1', 's2', 7] },
            { name: 'no id' },
            {
              id: 'b2',
              name: 'B',
              members: ['s2', 's3'],
              groups: [
                { name: 'g', members: ['s1', 's3'] },
                { name: 'empty', members: ['s9'] },
              ],
            },
          ],
        },
      })
      const result = await firstStartImport(ids('n'))
      expect(result.notices).toEqual([])
      expect((await readMenkar()).projects.projects).toEqual([
        { id: 'a1', name: 'A', members: ['s1', 's2'], groups: [] },
        {
          id: 'b2',
          name: 'B',
          members: ['s3'],
          groups: [{ name: 'g', color: '#5ec4b6', members: ['s3'] }],
        },
      ])
      expect(lines.some((l) => l.includes('dropped=') && l.includes('agent-tablet'))).toBe(true)
    } finally {
      off()
    }
  })

  test('SES-77 a partly valid state.json keeps the good values; a wrong-typed setting takes the default', async () => {
    await agentTablet({
      state: {
        hidden: ['s1', 3],
        names: { s2: '  ', s3: ' Ok ' },
        settings: { scrollback: 'lots', notify_sound: false, zoom: 2 },
      },
    })
    await firstStartImport(ids('n'))
    expect((await readMenkar()).state).toEqual({
      names: { s3: 'Ok' },
      hidden: ['s1'],
      settings: { notify_sound: false },
    })
  })

  test('SES-78 a current that names no imported project: the first one', async () => {
    await agentTablet({ projects: { ...validProjects, current: 'zz' } })
    await firstStartImport(ids('n'))
    expect((await readMenkar()).projects.current).toBe('a1')
  })

  test('SES-79/80 with either of Menkar’s files present it is not a first start: nothing is imported', async () => {
    await agentTablet({ projects: validProjects, state: validState })
    await mkdir(menkarDir(), { recursive: true })
    await writeFile(statePath(), '{}')
    expect(await firstStartImport(ids('n'))).toEqual({ firstStart: false, notices: [] })
    expect(await readdir(menkarDir())).toEqual(['state.json'])
  })

  test('SES-81 agent-tablet’s files keep their bytes and mtimes, and nothing is created in their folder', async () => {
    await agentTablet({ projects: validProjects, state: validState })
    const files = ['projects.json', 'state.json'].map((n) => join(atDir(), n))
    const before = await Promise.all(
      files.map(async (f) => [await readFile(f), (await stat(f)).mtimeMs] as const),
    )
    expect(before).toHaveLength(2)
    await firstStartImport(ids('n'))
    expect(
      await Promise.all(
        files.map(async (f) => [await readFile(f), (await stat(f)).mtimeMs] as const),
      ),
    ).toEqual(before)
    expect(await readdir(atDir())).toEqual(['projects.json', 'state.json'])
  })

  test('SES-82 nothing of Agent Session Manager is read', async () => {
    const asm = join(atDir(), '..', 'agent-session-manager')
    await mkdir(asm, { recursive: true })
    await writeFile(join(asm, 'state.json'), JSON.stringify({ names: { s1: 'From ASM' } }))
    await firstStartImport(ids('n'))
    expect((await readMenkar()).state.names).toEqual({})
  })

  test('SES-83 when Menkar’s files cannot be written, the error is logged and the next start is a first start again', async () => {
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    await mkdir(menkarDir(), { recursive: true })
    await chmod(menkarDir(), 0o500)
    try {
      const result = await firstStartImport(ids('n'))
      expect(result.firstStart).toBe(true)
      expect(await readdir(menkarDir())).toEqual([])
    } finally {
      await chmod(menkarDir(), 0o755)
    }
    expect((await firstStartImport(ids('n'))).firstStart).toBe(true)
  })

  test('SES-84 the saved windows are not imported', async () => {
    await agentTablet({ projects: validProjects })
    await firstStartImport(ids('n'))
    expect((await readMenkar()).projects.windows).toEqual([])
  })
})
