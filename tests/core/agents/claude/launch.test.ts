// 1.135: what a Claude session is started with comes from Claude's kit — its Launcher, its MCP mount,
// its namer and its team delivery — so shared code asks the kit and never names the agent.
import { describe, expect, test } from 'vitest'
import { kitOf } from '../../../../src/core/agents/registry'
import type { LaunchContext } from '../../../../src/core/agents/types'
import type { Start } from '../../../../src/core/command'
import type { TeamText } from '../../../../src/core/team/posts'

const kit = kitOf('claude')
const CLI = '/usr/local/bin/claude'
const ENV = { MENKAR_PANE: 'p1', MENKAR_FILES: '/h/Menkar/demo' }
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
const NEW: Start = { kind: 'new', id: 'n1', name: 'the api', model: 'sonnet' }
const RESUME: Start = { kind: 'resume', id: 'r1' }
const FORK: Start = { kind: 'fork', source: 's1', id: 'f1' }
const TAIL = [
  `"$(cat '/c/menkar/prompts/p.txt')"`,
  '--add-dir',
  '/h/Menkar/demo',
  '--mcp-config',
  `'{"a":1}'`,
  '--plugin-dir',
  '/opt/Menkar/resources/plugin',
  '--settings',
  '/c/menkar/claude-settings.json',
]

describe("Claude's Launcher", () => {
  test.each<[string, Start, readonly string[]]>([
    [
      'new',
      NEW,
      [
        CLI,
        '--session-id',
        'n1',
        '-n',
        "'the api'",
        '--model',
        'sonnet',
        "'--remote-control=demo api'",
        ...TAIL,
        '--append-system-prompt-file',
        '/c/menkar/control/team/p1.md',
      ],
    ],
    [
      'resume',
      RESUME,
      [
        CLI,
        '--resume',
        'r1',
        "'--remote-control=demo api'",
        ...TAIL,
        '--system-prompt-snapshot',
        'off',
        '--append-system-prompt-file',
        '/c/menkar/control/team/p1.md',
      ],
    ],
    [
      'fork',
      FORK,
      [
        CLI,
        '--resume',
        's1',
        '--fork-session',
        '--session-id',
        'f1',
        ...TAIL,
        '--append-system-prompt-file',
        '/c/menkar/control/team/p1.md',
      ],
    ],
  ])('a %s start uses every option main offers, in its place', (_, start, words) => {
    expect(kit.launch.plan(start, FULL)).toEqual({ words, env: ENV })
  })

  test('with nothing offered, the line is the CLI and the identity alone', () => {
    expect(kit.launch.plan(RESUME, { cli: CLI, env: {} }).words).toEqual([CLI, '--resume', 'r1'])
    expect(kit.launch.plan({ kind: 'new' }, { cli: CLI, env: {} }).words).toEqual([CLI])
  })

  test("the pane's environment is passed on as given", () => {
    expect(kit.launch.plan(NEW, { cli: CLI, env: ENV }).env).toEqual(ENV)
  })
})

describe("Claude's MCP mount and namer", () => {
  test("Menkar's MCP server and skills plugin are mounted with --mcp-config and --plugin-dir", () => {
    expect(kit.mcp?.words({ cli: CLI, env: {}, mcpConfig: '{}', pluginDir: '/p' })).toEqual([
      '--mcp-config',
      "'{}'",
      '--plugin-dir',
      '/p',
    ])
    expect(kit.mcp?.words({ cli: CLI, env: {} })).toEqual([])
  })

  test('a name is given at start with -n', () => {
    expect(kit.namer.atStart('the api')).toEqual(['-n', 'the api'])
  })
})

describe("Claude's team delivery", () => {
  const team = kit.team
  if (!team) throw new Error('Claude has no team delivery')
  const block: TeamText = { facts: '# Your team in Menkar\nfacts', block: 'the block\n' }

  // §2.5.6 (1): a new or resumed session holds the block it was started with; a fork carries its
  // source's, so it holds none of its own.
  test('what a start holds: new and resume the block, fork nothing', () => {
    expect(team.heldAtStart(NEW, block)).toBe(block)
    expect(team.heldAtStart(RESUME, block)).toBe(block)
    expect(team.heldAtStart(FORK, block)).toBeNull()
    expect(team.heldAtStart(NEW, null)).toBeNull()
  })

  // §2.5.6 (2), research §7: a resume without the snapshot flag reverts to the conversation's first
  // block, so every resume carries it.
  test('how a start delivers: the file last, and the snapshot off on every resume', () => {
    expect(team.atStart(NEW, '/t/p 1.md')).toEqual(['--append-system-prompt-file', "'/t/p 1.md'"])
    expect(team.atStart(FORK, '/t/p.md')).toEqual(['--append-system-prompt-file', '/t/p.md'])
    expect(team.atStart(RESUME, '/t/p.md')).toEqual([
      '--system-prompt-snapshot',
      'off',
      '--append-system-prompt-file',
      '/t/p.md',
    ])
  })

  // 1.157 Q4: below the snapshot flag's floor, 2.1.267, a start carries no team flag.
  test("the version floor is 2.1.267, read from the CLI's --version", () => {
    const floor = team.floor
    if (!floor) throw new Error('Claude has no version floor')
    expect(floor.version).toBe('2.1.267')
    expect(floor.read('2.1.325 (Claude Code)\n')).toBe('2.1.325')
    expect(floor.read('nothing')).toBeNull()
    expect(floor.accepts('2.1.266')).toBe(false)
    expect(floor.accepts('2.1.267')).toBe(true)
    expect(floor.notice).toBe('team.oldClaude')
  })

  test("its part and its skills' names are today's", () => {
    expect(team.part).toBe('claude.md')
    expect(team.skill('packager')).toBe('`packager`')
    expect(team.own('worker')).toBe('`menkar:worker`')
  })
})

test("Claude's environment rules name the variables of a running Claude Code session", () => {
  const vars = Object.values(kit.env ?? {}).flat()
  expect(vars.length).toBeGreaterThanOrEqual(10)
  expect(vars).toContain('CLAUDECODE')
  expect(vars).toContain('CLAUDE_CODE_MESSAGING_SOCKET')
})
