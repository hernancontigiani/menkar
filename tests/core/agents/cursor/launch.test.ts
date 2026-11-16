// 1.135: Cursor's kit starts it as today — its CLI, `--resume` — and takes none of Claude's options:
// no MCP mount, no team delivery, no name at start, no environment rules of its own yet.
import { describe, expect, test } from 'vitest'
import { kitOf } from '../../../../src/core/agents/registry'
import type { LaunchContext } from '../../../../src/core/agents/types'

const kit = kitOf('cursor')
const CLI = '/usr/local/bin/cursor-agent'
const ENV = { MENKAR_PANE: 'p1' }
const FULL: LaunchContext = {
  cli: CLI,
  env: ENV,
  settings: '/c/menkar/claude-settings.json',
  remoteControl: 'demo api',
  addDirs: ['/h/Menkar/demo'],
  promptFile: '/c/menkar/prompts/p.txt',
  mcpConfig: '{"a":1}',
  pluginDir: '/opt/Menkar/resources/plugin',
  teamFile: '/c/menkar/control/team/p1.md',
}

describe("Cursor's Launcher", () => {
  test('a new start is the CLI alone, whatever main offers', () => {
    expect(kit.launch.plan({ kind: 'new', id: 'n1', name: 'w', model: 'm' }, FULL)).toEqual({
      words: [CLI],
      env: ENV,
    })
  })

  test('a resume names the session', () => {
    expect(kit.launch.plan({ kind: 'resume', id: 'r1' }, FULL).words).toEqual([
      CLI,
      '--resume',
      'r1',
    ])
  })
})

test('Cursor has no MCP mount, no team delivery, no name at start and no environment rules', () => {
  expect(kit.mcp).toBeNull()
  expect(kit.team).toBeNull()
  expect(kit.env).toBeNull()
  expect(kit.namer.atStart('w')).toBeNull()
})
