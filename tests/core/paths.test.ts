import { homedir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  agentPaths,
  appDirs,
  electronUserData,
  filesRoot,
  projectFilesFolder,
} from '../../src/core/paths'

describe('paths', () => {
  test("tests never resolve the app's directories under the developer's home", () => {
    const root = process.env.MENKAR_TEST_ROOT
    expect(root).toBeTruthy()
    const dirs = appDirs()
    for (const dir of [dirs.config, dirs.cache, dirs.data]) {
      expect(dir.startsWith(`${root}/`)).toBe(true)
    }
    expect(homedir().startsWith(`${root}/`)).toBe(true)
  })

  test('each directory is the XDG base plus the app name', () => {
    const root = process.env.MENKAR_TEST_ROOT ?? ''
    expect(appDirs()).toEqual({
      config: join(root, 'config', 'menkar'),
      cache: join(root, 'cache', 'menkar'),
      data: join(root, 'data', 'menkar'),
    })
  })

  test('the directories are resolved when called, not at import', () => {
    const before = process.env.XDG_CONFIG_HOME
    process.env.XDG_CONFIG_HOME = '/elsewhere'
    try {
      expect(appDirs().config).toBe('/elsewhere/menkar')
    } finally {
      process.env.XDG_CONFIG_HOME = before
    }
  })

  test('a relative XDG value is ignored and the home fallback is used', () => {
    const before = process.env.XDG_DATA_HOME
    process.env.XDG_DATA_HOME = 'relative/dir'
    try {
      expect(appDirs().data).toBe(join(homedir(), '.local/share', 'menkar'))
    } finally {
      process.env.XDG_DATA_HOME = before
    }
  })

  test("Chromium's data goes under the cache, never into the config directory", () => {
    const { cache, config } = appDirs()
    expect(electronUserData()).toBe(join(cache, 'electron'))
    expect(electronUserData().startsWith(`${config}/`)).toBe(false)
  })

  test("the agents' and agent-tablet's paths resolve under the test's HOME and XDG dirs", () => {
    const root = process.env.MENKAR_TEST_ROOT ?? ''
    const paths = agentPaths()
    expect(Object.keys(paths).length).toBeGreaterThanOrEqual(6)
    for (const path of Object.values(paths)) expect(path.startsWith(`${root}/`)).toBe(true)
    expect(paths.claudeProjects).toBe(join(root, 'home', '.claude', 'projects'))
    expect(paths.agentTabletData).toBe(join(root, 'data', 'agent-tablet'))
  })
})

test("decision 1.58: the Menkar folder is ~/Menkar under the test's HOME unless set; a project's files are <root>/<name>/files", () => {
  expect(filesRoot('')).toBe(join(homedir(), 'Menkar'))
  expect(filesRoot('/srv/shared')).toBe('/srv/shared')
  expect(projectFilesFolder('/h/Menkar', 'Guardian AI')).toBe('/h/Menkar/Guardian AI/files')
})
