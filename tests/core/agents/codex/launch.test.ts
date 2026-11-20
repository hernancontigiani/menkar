// Codex's Launcher: `codex [resume <id>]` with the model only on a new start, the project's files
// folder by `--add-dir`, Menkar's turn-end program by `-c notify` with the user's own chained
// through a file, and the first prompt after `--`. The quoting is checked by running the command
// line in a real shell against a stand-in that records its argv.
import { execFileSync } from 'node:child_process'
import { chmodSync, copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { kitOf } from '../../../../src/core/agents/registry'
import type { LaunchContext } from '../../../../src/core/agents/types'
import type { Start } from '../../../../src/core/command'

const kit = kitOf('codex')
const CONFIGS = join(import.meta.dirname, '..', '..', '..', 'data', 'agents', 'codex', 'config')
const NOTIFY_PROGRAM = 'codex-notify.js'
const CHAIN_FILE = 'codex-notify-chain.json'
const ID = '019a3f1e-7c2d-7b40-9e11-2f4a6b8c0d1e'

const CTX: LaunchContext = {
  cli: '/usr/local/bin/codex',
  env: { MENKAR_PANE: 'p1', MENKAR_FILES: '/home/ana/Menkar/work/files' },
  settings: '/c/menkar/claude-settings.json',
  remoteControl: 'demo api',
  mcpConfig: '{"a":1}',
  pluginDir: '/opt/Menkar/resources/plugin',
  teamFile: '/c/menkar/control/team/p1.md',
  execPath: '/opt/Menkar/menkar',
  programs: '/opt/Menkar/resources/app.asar/out/main',
  paneFiles: '/c/menkar/control/panes/p1',
  filesFolder: '/home/ana/Menkar/work/files',
}

const NOTIFY_ARGV = [
  '/usr/bin/env',
  'ELECTRON_RUN_AS_NODE=1',
  '/opt/Menkar/menkar',
  `/opt/Menkar/resources/app.asar/out/main/${NOTIFY_PROGRAM}`,
  '--pane',
  'p1',
  '--chain-file',
  `/c/menkar/control/panes/p1/${CHAIN_FILE}`,
]

afterEach(() => {
  vi.unstubAllEnvs()
})

// The argv a shell hands the CLI for this plan, read back from a stand-in that writes each
// argument NUL-terminated.
function argvOf(start: Start, ctx: LaunchContext): string[] {
  const dir = mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', 'codex-argv-'))
  const out = join(dir, 'argv')
  const cli = join(dir, "the 'codex' $CLI")
  writeFileSync(cli, `#!/bin/sh\nfor a in "$@"; do printf '%s\\0' "$a"; done > '${out}'\n`)
  chmodSync(cli, 0o755)
  const plan = kit.launch.plan(start, { ...ctx, cli })
  execFileSync('/bin/sh', ['-c', plan.words.join(' ')], { env: { PATH: '/usr/bin:/bin' } })
  return readFileSync(out, 'utf8').split('\0').slice(0, -1)
}

// The TOML array a `-c notify=…` argument holds.
const notifyOf = (argument: string): unknown => parse(argument).notify

describe("Codex's Launcher", () => {
  test('a new start: the model, the files folder, Menkar notify, then the prompt after --', () => {
    const dir = mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', 'codex-prompt-'))
    const promptFile = join(dir, 'prompt.txt')
    writeFileSync(promptFile, 'Fix the build\n')
    const argv = argvOf(
      { kind: 'new', id: 'ignored', name: 'ignored', model: 'gpt-5.5' },
      { ...CTX, promptFile },
    )
    expect(argv.slice(0, 5)).toEqual([
      '-m',
      'gpt-5.5',
      '--add-dir',
      '/home/ana/Menkar/work/files',
      '-c',
    ])
    expect(notifyOf(argv[5] ?? '')).toEqual(NOTIFY_ARGV)
    expect(argv.slice(6)).toEqual(['--', 'Fix the build'])
  })

  test('a resume names the thread after its options, takes no model, and may carry a prompt', () => {
    const dir = mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', 'codex-prompt-'))
    const promptFile = join(dir, 'prompt.txt')
    writeFileSync(promptFile, 'Go on')
    const argv = argvOf({ kind: 'resume', id: ID }, { ...CTX, promptFile })
    expect(argv.slice(0, 4)).toEqual(['resume', '--add-dir', '/home/ana/Menkar/work/files', '-c'])
    expect(notifyOf(argv[4] ?? '')).toEqual(NOTIFY_ARGV)
    expect(argv.slice(5)).toEqual([ID, '--', 'Go on'])
    expect(argvOf({ kind: 'resume', id: ID }, { cli: '', env: {} })).toEqual(['resume', ID])
  })

  test("none of Claude's options reach Codex, and a bare context is the CLI alone", () => {
    const plan = kit.launch.plan({ kind: 'new' }, { cli: '/usr/local/bin/codex', env: {} })
    expect(plan.words).toEqual(['/usr/local/bin/codex'])
    expect(plan.files).toEqual([])
    const words = kit.launch.plan({ kind: 'new', name: 'w' }, CTX).words
    for (const absent of ['--settings', '--mcp-config', '--plugin-dir', '-n', 'w'])
      expect(words).not.toContain(absent)
    for (const absent of ['--remote', 'claude-settings', 'team/', '{"a":1}', 'plugin'])
      expect(words.join(' ')).not.toContain(absent)
  })

  test('Menkar notify is left out without the pane or its programs', () => {
    for (const missing of ['execPath', 'programs', 'paneFiles'] as const) {
      const { [missing]: _, ...ctx } = CTX
      const plan = kit.launch.plan({ kind: 'new' }, ctx)
      expect(plan.words, missing).not.toContain('-c')
      expect(plan.files, missing).toEqual([])
    }
    const plan = kit.launch.plan({ kind: 'new' }, { ...CTX, env: {} })
    expect(plan.words).not.toContain('-c')
  })

  test('a fork is refused: Codex sessions are not forked', () => {
    expect(() => kit.launch.plan({ kind: 'fork', source: ID, id: 'x' }, CTX)).toThrow()
  })

  test.each([
    ['quotes', `it's "quoted"`],
    ['a dollar and a command', '$HOME $(id -u) `id -u`'],
    ['a newline', 'line one\nline two'],
    ['a leading dash', '-x do this'],
    ['a leading double dash', '--help'],
    ['backslashes', 'a\\nb \\\\ c'],
  ])('a prompt with %s reaches Codex as one argument, as written', (_, text) => {
    const dir = mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', "codex 'prompt' $dir-"))
    const promptFile = join(dir, "it's $p.txt")
    writeFileSync(promptFile, text)
    for (const start of [{ kind: 'new' }, { kind: 'resume', id: ID }] as const) {
      const argv = argvOf(start, { ...CTX, promptFile })
      expect(argv.slice(-2)).toEqual(['--', text])
    }
  })

  test('paths with quotes, spaces and a dollar stay whole in the notify argv', () => {
    const ctx = {
      ...CTX,
      execPath: "/opt/Me nkar/it's $x",
      programs: '/opt/"q"/out',
      paneFiles: '/c/pane\nfiles',
      filesFolder: "/home/ana/Menkar/Client's work/files",
    }
    const argv = argvOf({ kind: 'new' }, ctx)
    expect(argv.slice(0, 2)).toEqual(['--add-dir', "/home/ana/Menkar/Client's work/files"])
    expect(notifyOf(argv[3] ?? '')).toEqual([
      '/usr/bin/env',
      'ELECTRON_RUN_AS_NODE=1',
      "/opt/Me nkar/it's $x",
      `/opt/"q"/out/${NOTIFY_PROGRAM}`,
      '--pane',
      'p1',
      '--chain-file',
      `/c/pane\nfiles/${CHAIN_FILE}`,
    ])
  })
})

describe("the user's notify, chained through a file", () => {
  async function chainText(fixture: string | null): Promise<string> {
    const home = mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', 'codex-home-'))
    if (fixture) copyFileSync(join(CONFIGS, fixture), join(home, 'config.toml'))
    vi.stubEnv('CODEX_HOME', home)
    const { files } = kit.launch.plan({ kind: 'new' }, CTX)
    expect(files?.map((f) => f.path)).toEqual([`/c/menkar/control/panes/p1/${CHAIN_FILE}`])
    return (await files?.[0]?.text()) ?? ''
  }

  test("holds the user's notify argv", async () => {
    expect(JSON.parse(await chainText('plain.toml'))).toEqual([
      '/home/ana/bin/notify-me',
      '--sound',
      "it's done",
    ])
  })

  test('is empty when the user has none, or their file cannot be used', async () => {
    for (const fixture of [null, 'profile.toml', 'unparsable.toml', 'types.toml'])
      expect(JSON.parse(await chainText(fixture)), String(fixture)).toEqual([])
  })
})

// P1b.2: Menkar's MCP server mounted by `-c mcp_servers.menkar.*`, one key per `-c`. Codex hands a
// stdio server only a few variables of its own, so the caller's pane and agent are in `env` and the
// XDG names are forwarded by name, never by value.
describe("Menkar's MCP server, mounted for the session", () => {
  const MOUNTED = { ...CTX, mcpServer: '/opt/Menkar/resources/app.asar/out/main/mcp-server.js' }

  // Each `-c mcp_servers.menkar.<key>=<value>` read as Codex reads it: a dotted key over TOML.
  function menkarTable(argv: readonly string[]): Record<string, unknown> {
    const table: Record<string, unknown> = {}
    argv.forEach((arg, i) => {
      if (argv[i - 1] !== '-c' || !arg.startsWith('mcp_servers.menkar.')) return
      const at = arg.indexOf('=')
      const key = arg.slice('mcp_servers.menkar.'.length, at)
      table[key] = parse(`v = ${arg.slice(at + 1)}`).v
    })
    return table
  }

  test('names the program, the pane, the agent, the forwarded XDG names, and no approval card', () => {
    for (const start of [{ kind: 'new' }, { kind: 'resume', id: ID }] as const)
      expect(menkarTable(argvOf(start, MOUNTED)), start.kind).toEqual({
        command: '/opt/Menkar/menkar',
        args: ['/opt/Menkar/resources/app.asar/out/main/mcp-server.js'],
        env: { ELECTRON_RUN_AS_NODE: '1', MENKAR_PANE: 'p1', MENKAR_AGENT: 'codex' },
        env_vars: ['XDG_CACHE_HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME'],
        default_tools_approval_mode: 'approve',
      })
  })

  test('a resume still names its thread last', () => {
    const argv = argvOf({ kind: 'resume', id: ID }, MOUNTED)
    expect(argv.at(-1)).toBe(ID)
    expect(argv.indexOf('mcp_servers.menkar.command="/opt/Menkar/menkar"')).toBeGreaterThan(0)
  })

  test('no value of the pane environment but the pane id reaches the command', () => {
    const words = kit.launch
      .plan({ kind: 'new' }, { ...MOUNTED, env: { ...MOUNTED.env, XDG_CACHE_HOME: '/secret/x' } })
      .words.join(' ')
    expect(words).not.toContain('/secret/x')
  })

  test('paths and a pane id with quotes and a dollar stay whole', () => {
    const ctx = {
      ...MOUNTED,
      env: { MENKAR_PANE: `p"1 $x` },
      execPath: "/opt/Me nkar/it's $x",
      mcpServer: '/opt/"q"/mcp\nserver.js',
    }
    const table = menkarTable(argvOf({ kind: 'new' }, ctx))
    expect(table.command).toBe("/opt/Me nkar/it's $x")
    expect(table.args).toEqual(['/opt/"q"/mcp\nserver.js'])
    expect(table.env).toEqual({
      ELECTRON_RUN_AS_NODE: '1',
      MENKAR_PANE: `p"1 $x`,
      MENKAR_AGENT: 'codex',
    })
  })

  test('is left out without the program, Electron or the pane', () => {
    const { mcpServer: _, ...noProgram } = MOUNTED
    const { execPath: __, ...noElectron } = MOUNTED
    for (const ctx of [noProgram, noElectron, { ...MOUNTED, env: {} }])
      expect(kit.launch.plan({ kind: 'new' }, ctx).words.join(' ')).not.toContain('mcp_servers')
  })
})
