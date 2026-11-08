import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import type { MenkarApi, ProjectsSnapshot } from '../src/shared/ipc'
import { launchApp } from './app'

type PageGlobals = { menkar: MenkarApi }

test("the first start imports agent-tablet's projects and settings, and leaves its files as they were", async () => {
  let source = ''
  let menkar = ''
  const agentProjects = {
    version: 1,
    current: 'b2b2b2b2b2b2',
    projects: [
      {
        id: 'a1a1a1a1a1a1',
        name: 'Client work',
        members: ['s1', 's2'],
        groups: [{ name: 'api pair', color: '#c17be0', members: ['s1'] }],
      },
      { id: 'b2b2b2b2b2b2', name: 'Research', members: ['s3'] },
    ],
    windows: [
      {
        current: 'a1a1a1a1a1a1',
        tabs: { a1a1a1a1a1a1: [{ panes: ['s1'], orientation: 'horizontal' }] },
      },
    ],
  }
  const agentState = { names: { s2: 'Docs' }, hidden: ['s3'], settings: { ui_style: 'classic' } }
  const launched = await launchApp({
    prepare: ({ root }) => {
      source = join(root, 'config', 'agent-tablet')
      menkar = join(root, 'config', 'menkar')
      mkdirSync(source, { recursive: true })
      writeFileSync(join(source, 'projects.json'), JSON.stringify(agentProjects, null, 2))
      writeFileSync(join(source, 'state.json'), JSON.stringify(agentState, null, 2))
      return undefined
    },
  })
  const files = ['projects.json', 'state.json'].map((name) => join(source, name))
  const before = files.map((f) => [readFileSync(f, 'utf8'), statSync(f).mtimeMs])
  try {
    const snapshot: ProjectsSnapshot = await launched.window.evaluate(() =>
      (globalThis as unknown as PageGlobals).menkar.projects.get(),
    )
    expect(snapshot).toEqual({
      current: 'b2b2b2b2b2b2',
      projects: [
        {
          id: 'a1a1a1a1a1a1',
          name: 'Client work',
          members: ['s1', 's2'],
          groups: [{ name: 'api pair', color: '#c17be0', members: ['s1'] }],
        },
        { id: 'b2b2b2b2b2b2', name: 'Research', members: ['s3'], groups: [] },
      ],
      notices: [],
    })
    const written = JSON.parse(readFileSync(join(menkar, 'projects.json'), 'utf8'))
    expect(written.projects.map((p: { name: string }) => p.name)).toEqual([
      'Client work',
      'Research',
    ])
    expect(written.windows).toEqual([])
    expect(JSON.parse(readFileSync(join(menkar, 'state.json'), 'utf8'))).toEqual({
      names: { s2: 'Docs' },
      hidden: ['s3'],
      settings: { ui_style: 'classic' },
    })
    expect(files.map((f) => [readFileSync(f, 'utf8'), statSync(f).mtimeMs])).toEqual(before)
  } finally {
    await launched.close()
  }
})
