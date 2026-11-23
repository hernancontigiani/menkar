// Plan 39 P3.2: a new Cursor session is started under the id Menkar chose, with its model and
// first prompt, and each pane is given a plugin folder of its own: Menkar's MCP server naming the
// pane, and in the orchestration mode a sessionStart hook answering the team block. A resume names
// the session and gets the folder with no hook: Cursor runs sessionStart for a new chat only.
import { mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { pluginFolderName } from '../../../../src/core/agents/cursor/integrations'
import { kitOf } from '../../../../src/core/agents/registry'
import type { LaunchContext, LaunchPlan } from '../../../../src/core/agents/types'

const kit = kitOf('cursor')
const CLI = '/usr/local/bin/cursor-agent'
const ENV = { MENKAR_PANE: 'p1' }
const PANE_FILES = '/c/menkar/control/panes/p1'
const FOLDER = join(PANE_FILES, pluginFolderName())
const BASE: LaunchContext = {
  cli: CLI,
  env: ENV,
  settings: '/c/menkar/claude-settings.json',
  remoteControl: 'demo api',
  mcpConfig: '{"a":1}',
  pluginDir: '/opt/Menkar/resources/plugin',
  execPath: '/opt/Menkar/menkar',
  mcpServer: '/opt/Menkar/resources/app.asar/out/main/mcp-server.js',
  programs: '/opt/Menkar/resources/app.asar/out/main',
  paneFiles: PANE_FILES,
}

// A compaction is recorded for main as a start of the session, by the program Claude's hooks run.
const PRE_COMPACT = {
  command:
    'ELECTRON_RUN_AS_NODE=1 /opt/Menkar/menkar /opt/Menkar/resources/app.asar/out/main/statusline.js pre-compact',
  timeout: 3,
}

afterEach(() => {
  vi.unstubAllEnvs()
})

async function written(plan: LaunchPlan): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const file of plan.files ?? []) out[file.path.slice(FOLDER.length + 1)] = await file.text()
  return out
}

describe("Cursor's Launcher", () => {
  test("a new start: its id, its model, the pane's plugin folder, then the first prompt", () => {
    const plan = kit.launch.plan(
      { kind: 'new', id: 'n1', name: 'w', model: 'gpt-6' },
      { ...BASE, promptFile: "/c/menkar/prompts/it's.txt" },
    )
    expect(plan.words).toEqual([
      CLI,
      '--new-session-id',
      'n1',
      '--model',
      'gpt-6',
      '--plugin-dir',
      FOLDER,
      '--',
      `"$(cat '/c/menkar/prompts/it'"'"'s.txt')"`,
    ])
    expect(plan.env).toBe(ENV)
  })

  test("the project's files folder is granted to the session", () => {
    expect(
      kit.launch.plan({ kind: 'resume', id: 'r1' }, { ...BASE, filesFolder: '/h/Menkar/a b/files' })
        .words,
    ).toEqual([CLI, '--resume', 'r1', '--add-dir', "'/h/Menkar/a b/files'", '--plugin-dir', FOLDER])
  })

  test('a new start with no id lets Cursor pick it', () => {
    expect(kit.launch.plan({ kind: 'new' }, BASE).words).toEqual([CLI, '--plugin-dir', FOLDER])
  })

  test('a resume names the session and keeps its model', () => {
    expect(kit.launch.plan({ kind: 'resume', id: 'r1' }, BASE).words).toEqual([
      CLI,
      '--resume',
      'r1',
      '--plugin-dir',
      FOLDER,
    ])
  })

  test("Claude's options are not Cursor's", () => {
    const words = kit.launch.plan({ kind: 'new', id: 'n1' }, BASE).words.join(' ')
    for (const option of ['--settings', '--mcp-config', '--remote-control', '-n'])
      expect(words).not.toContain(`${option} `)
    expect(words).not.toContain('/opt/Menkar/resources/plugin')
  })

  test('a pane Menkar cannot name gets no plugin folder and no files', () => {
    const { paneFiles: _, ...without } = BASE
    expect(kit.launch.plan({ kind: 'new', id: 'n1' }, without)).toEqual({
      words: [CLI, '--new-session-id', 'n1'],
      env: ENV,
    })
    expect(kit.launch.plan({ kind: 'new', id: 'n1' }, { ...BASE, env: {} }).files).toBeUndefined()
  })
})

describe("the pane's plugin folder", () => {
  test("its server is Menkar's, named after the flavour, with the pane and the agent in its env", async () => {
    vi.stubEnv('XDG_CACHE_HOME', '/c')
    vi.stubEnv('XDG_CONFIG_HOME', '')
    vi.stubEnv('XDG_DATA_HOME', '')
    const files = await written(kit.launch.plan({ kind: 'resume', id: 'r1' }, BASE))
    // No manifest: Cursor loads the folder without one (`cursor`, measured 2026-11-23).
    expect(Object.keys(files).sort()).toEqual(['.mcp.json', 'hooks/hooks.json'])
    expect(JSON.parse(files['.mcp.json'] ?? '')).toEqual({
      mcpServers: {
        menkar: {
          command: '/opt/Menkar/menkar',
          args: ['/opt/Menkar/resources/app.asar/out/main/mcp-server.js'],
          env: {
            ELECTRON_RUN_AS_NODE: '1',
            MENKAR_PANE: 'p1',
            MENKAR_AGENT: 'cursor',
            XDG_CACHE_HOME: '/c',
          },
        },
      },
    })
    // A resume runs no sessionStart: no hook is left from an earlier start of the pane.
    expect(JSON.parse(files['hooks/hooks.json'] ?? '')).toEqual({ version: 1, hooks: {} })
  })

  test('outside the orchestration mode a new start gets no hook', async () => {
    const files = await written(kit.launch.plan({ kind: 'new', id: 'n1' }, BASE))
    expect(JSON.parse(files['hooks/hooks.json'] ?? '')).toEqual({ version: 1, hooks: {} })
    expect(files['session-start.json']).toBeUndefined()
  })

  test("in the mode a new start's sessionStart hook prints the block as additional_context", async () => {
    const dir = mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', 'cursor-team-'))
    const teamFile = join(dir, "pane 1's.md")
    const block =
      '## Your team in Menkar\nYou are `w`, with "quotes", `ticks` and $(no expansion).\n'
    writeFileSync(teamFile, block)
    const plan = kit.launch.plan({ kind: 'new', id: 'n1' }, { ...BASE, teamFile })
    const files = await written(plan)
    expect(JSON.parse(files['session-start.json'] ?? '')).toEqual({ additional_context: block })
    expect(JSON.parse(files['hooks/hooks.json'] ?? '')).toEqual({
      version: 1,
      hooks: {
        sessionStart: [{ command: `cat ${join(FOLDER, 'session-start.json')}`, timeout: 3 }],
        preCompact: [PRE_COMPACT],
      },
    })
    expect(plan.words).not.toContain(teamFile)
  })

  test('a resume in the mode gets no sessionStart, only the compaction record', async () => {
    const plan = kit.launch.plan({ kind: 'resume', id: 'r1' }, { ...BASE, teamFile: '/t.md' })
    const files = await written(plan)
    expect(JSON.parse(files['hooks/hooks.json'] ?? '')).toEqual({
      version: 1,
      hooks: { preCompact: [PRE_COMPACT] },
    })
    expect(files['session-start.json']).toBeUndefined()
  })
})

test("Cursor's MCP mount is its plugin folder, and it takes no name at start", () => {
  expect(kit.mcp?.words(BASE)).toEqual(['--plugin-dir', FOLDER])
  expect(kit.mcp?.words({ ...BASE, env: {} })).toEqual([])
  expect(kit.namer.atStart('w')).toBeNull()
  expect(kit.env).toBeNull()
})
