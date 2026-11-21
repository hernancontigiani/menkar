// R10: what Claude and Cursor sessions get from Menkar, byte for byte, taken on `main` before the
// multi-agent work moves any of it behind per-agent kits. Every file under tests/core/r10/ is
// written on `main` only; a branch's CI compares them with `main`'s and fails on any difference,
// and `npm run ci` runs Vitest with CI=1, under which a missing file fails instead of being written.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { buildCommand, type CommandOptions, mcpConfig, type Start } from '../../src/core/command'
import { writeSessionSettings } from '../../src/core/context/settings'
import { WAKE_DELAY_MS } from '../../src/core/control/events'
import { wakeFrame } from '../../src/core/control/post'
import { answer } from '../../src/core/control/protocol'
import { appDirs } from '../../src/core/paths'
import { withoutSessionEnv } from '../../src/core/sessionenv'
import { type Installed, SessionScanner } from '../../src/core/sessions/scanner'
import { watchedDirs } from '../../src/core/sessions/service'
import {
  type TeamAgent,
  type TeamInput,
  teamAgent,
  teamBlock,
  teamFacts,
} from '../../src/core/team/block'
import { type TeamText, teamPost } from '../../src/core/team/posts'
import { defaultPassPaths, runPass } from '../../src/core/usage/pass'
import { cursorUser, ID, ID2, jsonl as transcriptJsonl, user } from '../factories/transcript'
import { jsonl, memberships, prompt, response } from '../factories/usage'

const ROOT = join(import.meta.dirname, '..', '..')
const snapshot = (name: string) => `./r10/${name}`

// Each test that needs a directory gets a fresh one; its path is written as <tmp> in a snapshot.
function fresh(name: string): string {
  return mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', `r10-${name}-`))
}
const relativeTo = (dir: string, paths: readonly string[]) =>
  paths.map((path) => (path === dir ? '<tmp>' : `<tmp>/${relative(dir, path)}`))

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('the command line', () => {
  // Every option main can pass, so a change to any of them shows.
  const OPTIONS: Readonly<Record<'claude' | 'cursor', CommandOptions>> = {
    claude: {
      cli: '/home/demo/.local/bin/claude',
      settings: '/home/demo/.config/menkar/claude-settings.json',
      remoteControl: "the demo's api",
      promptFile: "/home/demo/.cache/menkar/prompts/it's a prompt.txt",
      mcpConfig: mcpConfig('/opt/Menkar/menkar', '/opt/Menkar/resources/mcp-server.cjs'),
      pluginDir: '/opt/Menkar/resources/plugin',
    },
    cursor: {
      cli: '/home/demo/.local/bin/cursor-agent',
      settings: '/home/demo/.config/menkar/claude-settings.json',
      remoteControl: "the demo's api",
      promptFile: "/home/demo/.cache/menkar/prompts/it's a prompt.txt",
      mcpConfig: mcpConfig('/opt/Menkar/menkar', '/opt/Menkar/resources/mcp-server.cjs'),
      pluginDir: '/opt/Menkar/resources/plugin',
    },
  }
  const TEAM_FILE = '/home/demo/.cache/menkar/control/team/pane 7.md'
  const STARTS: Readonly<Record<'new' | 'resume' | 'fork', Start>> = {
    new: { kind: 'new', id: ID, name: "the demo's api", model: 'claude-haiku-5-5' },
    resume: { kind: 'resume', id: ID },
    fork: { kind: 'fork', source: ID, id: ID2 },
  }
  const CASES: readonly [keyof typeof OPTIONS, keyof typeof STARTS][] = [
    ['claude', 'new'],
    ['claude', 'resume'],
    ['claude', 'fork'],
    ['cursor', 'new'],
    ['cursor', 'resume'],
  ]

  test.each(
    CASES.flatMap(([agent, start]) => [
      [agent, start, 'off'],
      [agent, start, 'team'],
    ]),
  )('%s, %s, mode %s', async (agent, start, mode) => {
    const options = { ...OPTIONS[agent], ...(mode === 'team' ? { teamFile: TEAM_FILE } : {}) }
    await expect(buildCommand(agent, STARTS[start], options)).toMatchFileSnapshot(
      snapshot(`${agent}-${start}-${mode}.txt`),
    )
  })
})

test("the --settings file's bytes", async () => {
  // The prompt hook's guard names the inbox folder under the cache directory: pinned, as the
  // statusline's path is, so the bytes do not change with the test's temporary directory.
  vi.stubEnv('XDG_CACHE_HOME', '/home/demo/.cache')
  const path = await writeSessionSettings(
    "'/opt/Menkar/menkar' '/opt/Menkar/resources/statusline.cjs'",
  )
  await expect(readFileSync(path, 'utf8')).toMatchFileSnapshot(snapshot('settings.json'))
})

describe("Menkar's MCP server", () => {
  const ctx = { pane: null, call: async () => ({ ok: true, text: '' }) }

  test("initialize's reply", async () => {
    const reply = await answer(
      { id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25' } },
      ctx,
    )
    await expect(`${JSON.stringify(reply, null, 2)}\n`).toMatchFileSnapshot(
      snapshot('mcp-initialize.json'),
    )
  })

  test("tools/list's reply", async () => {
    const reply = await answer({ id: 2, method: 'tools/list' }, ctx)
    await expect(`${JSON.stringify(reply, null, 2)}\n`).toMatchFileSnapshot(
      snapshot('mcp-tools-list.json'),
    )
  })
})

describe('the plugin a Claude session is given', () => {
  const PLUGIN = join(ROOT, 'plugin')
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
    )
  const files = [
    ...walk(join(PLUGIN, 'skills')),
    ...walk(join(PLUGIN, 'guide')),
    join(PLUGIN, 'team', 'common.md'),
    join(PLUGIN, 'team', 'claude.md'),
  ]
    .map((path) => relative(PLUGIN, path))
    .sort()

  test('the list', async () => {
    expect(files.length).toBeGreaterThanOrEqual(6)
    await expect(`${files.join('\n')}\n`).toMatchFileSnapshot(snapshot('plugin/LIST.txt'))
  })

  test.each(files)('%s', async (file) => {
    await expect(readFileSync(join(PLUGIN, file), 'utf8')).toMatchFileSnapshot(
      snapshot(`plugin/${file}`),
    )
  })
})

describe('the team block', () => {
  const claude = (): TeamAgent => {
    const agent = teamAgent('claude')
    if (!agent) throw new Error('Claude has no team record')
    return agent
  }
  const common = readFileSync(join(ROOT, 'plugin', 'team', 'common.md'), 'utf8')
  const part = readFileSync(join(ROOT, 'plugin', 'team', 'claude.md'), 'utf8')
  const base: TeamInput = {
    project: 'menkar',
    name: 'packager',
    orchestrator: { name: 'set' },
    parent: { name: 'set', orchestrator: true },
    skills: [],
    context: { warn: 60, full: 90 },
  }
  const without = (key: 'name' | 'parent', input: TeamInput): TeamInput => {
    const { [key]: _, ...rest } = input
    return rest
  }
  const MAINTAINED = [{ name: 'packager', maintainer: true, found: true }]
  const READ_ONLY = [{ name: 'review-branch', maintainer: false, found: true }]
  // The variants tests/core/team/block.test.ts covers, each by the case it names.
  const INPUTS: readonly [string, TeamInput][] = [
    [
      'the expert',
      {
        ...base,
        role: 'Packaging',
        skills: [
          { name: 'packager', maintainer: true, found: true },
          { name: 'claude-cli', maintainer: false, maintainedBy: 'claude-cli', found: true },
        ],
      },
    ],
    ['no name yet', without('name', without('parent', base))],
    ['no role, parent the orchestrator', base],
    ['a role', { ...base, role: 'Packaging' }],
    [
      'the orchestrator',
      { ...without('parent', base), name: 'set', orchestrator: 'self' as const },
    ],
    [
      'another parent',
      { ...base, name: 'menkar-t3', parent: { name: 'packager', orchestrator: false } },
    ],
    ['loose, with an orchestrator', without('parent', base)],
    ['no orchestrator marked', { ...without('parent', base), orchestrator: null }],
    [
      'a parent and no orchestrator marked',
      {
        ...base,
        name: 'helper',
        orchestrator: null,
        parent: { name: 'packager', orchestrator: false },
      },
    ],
    ['a role with a newline', { ...base, role: 'Packaging\nand releases' }],
    ['a role with a backtick', { ...base, role: 'The `deb` keeper' }],
    ['a role with a double quote', { ...base, role: 'The "deb" keeper' }],
    ['a role of 61 characters', { ...base, role: 'x'.repeat(61) }],
    ['a role of 60 characters', { ...base, role: 'x'.repeat(60) }],
    ['a role only delimiters and spaces', { ...base, role: ' `"` \n' }],
    [
      'two maintained',
      {
        ...base,
        skills: [
          { name: 'packager', maintainer: true, found: true },
          { name: 'deb-notes', maintainer: true, found: true },
        ],
      },
    ],
    [
      'read only with none',
      { ...base, skills: [{ name: 'review-branch', maintainer: false, found: true }] },
    ],
    [
      'not found for this session',
      {
        ...base,
        skills: [{ name: 'gone', maintainer: true, found: false }, ...READ_ONLY],
      },
    ],
    [
      "the orchestrator's skills",
      { ...without('parent', base), name: 'set', orchestrator: 'self' as const, skills: READ_ONLY },
    ],
    [
      'loose, a role, maintaining a skill',
      { ...without('parent', base), role: 'Packaging', skills: MAINTAINED },
    ],
    [
      'loose, a role, maintaining none',
      { ...without('parent', base), role: 'Packaging', skills: READ_ONLY },
    ],
    [
      'the orchestrator with a role and a skill',
      {
        ...without('parent', base),
        name: 'set',
        orchestrator: 'self' as const,
        role: 'Lead',
        skills: MAINTAINED,
      },
    ],
    ['loose with no role', { ...without('parent', base), skills: MAINTAINED }],
  ]
  const text = (input: TeamInput): TeamText => {
    const facts = teamFacts(input, claude())
    return { facts, block: teamBlock(facts, common, part) }
  }

  test('the blocks, at both ring thresholds', async () => {
    const sections = INPUTS.flatMap(([name, input]) =>
      [input.context, { warn: 50, full: 80 }].map(
        (context) =>
          `=== ${name}, ${context.warn}/${context.full} ===\n${text({ ...input, context }).block}`,
      ),
    )
    expect(sections.length).toBeGreaterThanOrEqual(40)
    await expect(sections.join('\n')).toMatchFileSnapshot(snapshot('team-blocks.txt'))
  })

  test('the posts', async () => {
    const a = text(base)
    const b = text({ ...base, role: 'Release' })
    const posts = [
      ['a block, now none', teamPost(a, null)],
      ['none, now a block', teamPost(null, a)],
      ['a block, other facts', teamPost(a, b)],
      ['a block, the same facts', teamPost(a, a)],
    ].map(([name, post]) => `=== ${name} ===\n${post}\n`)
    await expect(posts.join('\n')).toMatchFileSnapshot(snapshot('team-posts.txt'))
  })
})

test("wakeFrame's bytes and the wake delay", async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  // Local time, so the frame's time of day is 09:30:05 whatever the time zone.
  vi.setSystemTime(new Date(2026, 10, 16, 9, 30, 5))
  const frames = [
    wakeFrame('`worker` finished a turn.', 'msg-1'),
    wakeFrame('`worker` finished a turn.', 'msg-2', { forYou: 1, working: 2, waiting: 0 }),
  ]
  await expect(`${frames.join('')}WAKE_DELAY_MS ${WAKE_DELAY_MS}\n`).toMatchFileSnapshot(
    snapshot('wake.txt'),
  )
})

test('withoutSessionEnv on a fixed environment', async () => {
  const env = {
    HOME: '/home/demo',
    PATH: '/usr/local/bin:/usr/bin:/bin',
    LANG: 'en_US.UTF-8',
    CLAUDE_CONFIG_DIR: '/home/demo/.claude-work',
    ANTHROPIC_MODEL: 'claude-opus-5-5',
    CLAUDE_CODE_USE_BEDROCK: '1',
    CLAUDE_CODE_DISABLE_AUTOUPDATER: '1',
    CURSOR_AGENT: '1',
    MENKAR_PANE: 'p-1',
    MENKAR_FILES: '/home/demo/Menkar/Client work/files',
    CLAUDECODE: '1',
    CLAUDE_CODE_SESSION_ID: ID,
    CLAUDE_CODE_CHILD_SESSION: '1',
    CLAUDE_CODE_SESSION_ATTENDED: '1',
    CLAUDE_PID: '4242',
    CLAUDE_EFFORT: 'high',
    AI_AGENT: 'claude-code',
    TRACEPARENT: '00-abc-def-01',
    CLAUDE_CODE_MESSAGING_SOCKET: '/tmp/cc.sock',
    CLAUDE_CODE_MESSAGING_TOKEN: 'token',
    CLAUDE_CODE_ENTRYPOINT: 'cli',
    CLAUDE_CODE_EXECPATH: '/home/demo/.local/bin/claude',
    CLAUDE_CODE_INVOKED_SKILLS: 'worker',
    CLAUDE_CODE_BRIDGE_SESSION_ID: 'bridge',
    CLAUDE_PROJECT_DIR: '/home/demo/work',
    CLAUDE_ENV_FILE: '/tmp/env',
    CLAUDE_PLUGIN_ROOT: '/home/demo/.claude/plugins/x',
    CLAUDE_PLUGIN_DATA: '/home/demo/.claude/plugins/data',
    CLAUDE_CODE_SSE_PORT: '12345',
    UNSET: undefined,
  }
  await expect(`${JSON.stringify(withoutSessionEnv(env), null, 2)}\n`).toMatchFileSnapshot(
    snapshot('session-env.json'),
  )
})

describe('the folders watched and the sessions scanned', () => {
  function agentsHome(): {
    dir: string
    roots: { claudeProjects: string; cursorProjects: string }
  } {
    const dir = fresh('scan')
    const roots = { claudeProjects: join(dir, 'claude'), cursorProjects: join(dir, 'cursor') }
    const put = (path: string, text: string) => {
      mkdirSync(join(path, '..'), { recursive: true })
      writeFileSync(path, text)
    }
    put(join(roots.claudeProjects, '-home-demo-api', `${ID}.jsonl`), transcriptJsonl([user('hi')]))
    put(join(roots.claudeProjects, '-home-demo-api', ID, 'subagents', 'a.jsonl'), '{}\n')
    put(join(roots.claudeProjects, '-home-demo-web', `${ID2}.jsonl`), transcriptJsonl([user('yo')]))
    put(
      join(
        roots.cursorProjects,
        'home-demo-api',
        'agent-transcripts',
        'c0ffee01',
        'c0ffee01.jsonl',
      ),
      transcriptJsonl([cursorUser('hello')]),
    )
    mkdirSync(join(roots.cursorProjects, 'home-demo-api', 'worker-logs'), { recursive: true })
    return { dir, roots }
  }

  test.each<[string, Installed]>([
    ['only Claude installed', { claude: true, cursor: false }],
    ['Claude and Cursor installed', { claude: true, cursor: true }],
  ])('%s', async (name, installed) => {
    const { dir, roots } = agentsHome()
    const watched = relativeTo(dir, await watchedDirs(roots))
    const scanned = (await new SessionScanner().scan(roots, installed))
      .map((s) => `${s.agent} ${s.id} ${relativeTo(dir, [s.file])[0]}`)
      .sort()
    expect(scanned.length).toBeGreaterThanOrEqual(2)
    await expect(
      `watched:\n${watched.join('\n')}\nscanned:\n${scanned.join('\n')}\n`,
    ).toMatchFileSnapshot(snapshot(`scan-${name.replaceAll(/[ ,]+/g, '-')}.txt`))
  })
})

test("the usage cache directory's files after a pass with only Claude installed", async () => {
  const dir = fresh('usage')
  vi.stubEnv('HOME', join(dir, 'home'))
  vi.stubEnv('XDG_CACHE_HOME', join(dir, 'cache'))
  vi.stubEnv('XDG_DATA_HOME', join(dir, 'data'))
  const project = join(dir, 'home', '.claude', 'projects', '-home-demo-api')
  mkdirSync(project, { recursive: true })
  writeFileSync(
    join(project, `${ID}.jsonl`),
    jsonl([prompt('10:00:00'), response('10:00:05'), prompt('10:01:00'), response('10:01:09')]),
  )
  runPass(memberships(), defaultPassPaths())
  const cache = appDirs().cache
  const walk = (path: string): string[] =>
    statSync(path).isDirectory()
      ? readdirSync(path).flatMap((name) => walk(join(path, name)))
      : [relative(cache, path)]
  const files = walk(cache).sort()
  expect(files.length).toBeGreaterThan(0)
  await expect(`${files.join('\n')}\n`).toMatchFileSnapshot(snapshot('usage-cache-files.txt'))
})
