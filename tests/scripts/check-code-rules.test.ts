import { describe, expect, test } from 'vitest'
import { findViolations, overAllowed, readRoster } from '../../scripts/check-code-rules.mjs'

const rules = (file: string, source: string) => findViolations(file, source).map((v) => v.rule)

describe('check-code-rules', () => {
  test.each([
    ["import { app } from 'electron'", 'core-imports-electron'],
    ["import type { BrowserWindow } from 'electron'", 'core-imports-electron'],
    ["export { ipcMain } from 'electron'", 'core-imports-electron'],
    ["const e = await import('electron')", 'core-imports-electron'],
    ["const e = require('electron/main')", 'core-imports-electron'],
    ["import { x } from '../main/window'", 'core-imports-outside'],
  ])('src/core cannot reach Electron or the other layers: %s', (source, rule) => {
    expect(rules('src/core/sessions.ts', source)).toEqual([rule])
  })

  test('the main process may import electron, and core may import node builtins and itself', () => {
    expect(rules('src/main/index.ts', "import { app } from 'electron'")).toEqual([])
    expect(
      rules('src/core/a.ts', "import { join } from 'node:path'\nimport { now } from './clock'"),
    ).toEqual([])
  })

  test.each([
    'const t = Date.now()',
    'const t = globalThis.Date.now()',
    'const d = new Date()',
    'const d = new Date',
  ])('time is read only through the clock: %s', (source) => {
    expect(rules('src/core/usage.ts', source)).toEqual(['time-outside-clock'])
    expect(rules('tests/core/usage.test.ts', source)).toEqual(['time-outside-clock'])
    expect(rules('src/core/clock.ts', source)).toEqual([])
  })

  test('a date built from a value, or the words in a comment or string, is not reading the time', () => {
    const source = "const d = new Date(0)\n// Date.now() here is prose\nconst s = 'new Date()'"
    expect(rules('src/core/usage.ts', source)).toEqual([])
  })

  test('`any` needs a line-scoped reason', () => {
    expect(rules('src/main/a.ts', 'let x: any')).toEqual(['no-any'])
    expect(rules('src/main/a.ts', 'let x: unknown[] = [] as any[]')).toEqual(['no-any'])
    const justified =
      '// biome-ignore lint/suspicious/noExplicitAny: the library types this as any\nlet x: any'
    expect(rules('src/main/a.ts', justified)).toEqual([])
  })

  test.each([
    ['src/core/sessions.ts', "console.log('x')"],
    ['src/main/index.ts', 'console.error(error)'],
    ['src/renderer/main.ts', 'const warn = console.warn'],
    ['tests/core/a.test.ts', 'console.info(1)'],
  ])('logging goes through the one module: %s', (file, source) => {
    expect(rules(file, source)).toEqual(['console-outside-log'])
  })

  test('the logging module itself may write, and a word in a string is not a call', () => {
    expect(rules('src/core/log.ts', "console.error('x')")).toEqual([])
    expect(rules('src/core/a.ts', "const s = 'console.log(1)'")).toEqual([])
  })
})

// 1.135: no agent is named in shared code; each agent's behaviour lives in its own folders and is
// reached through the registries. Codex stands in for an agent not built yet.
describe('the agent rules', () => {
  const roster = {
    ids: ['claude', 'cursor', 'codex'],
    commands: { claude: 'claude', cursor: 'cursor-agent', codex: 'codex' },
  }
  const agentRules = (file: string, source: string) =>
    findViolations(file, source, roster)
      .map((v) => v.rule)
      .filter((rule) => rule.startsWith('agent-') || rule === 'descriptors-node-free')

  test("the roster is read from the tree: the ids, and each one's command", () => {
    const real = readRoster()
    expect(real.ids).toEqual(['claude', 'cursor', 'codex', 'opencode'])
    expect(real.commands).toEqual({
      claude: 'claude',
      cursor: 'cursor-agent',
      codex: 'codex',
      opencode: 'opencode',
    })
  })

  test.each([
    ["if (a === 'cursor') go()", 'agent-literal'],
    ["const cli = 'cursor-agent'", 'agent-literal'],
    ['const cli = `codex`', 'agent-literal'],
    ["type A = 'claude' | 'other'", 'agent-literal'],
    ['run(AGENT_COMMANDS.codex)', 'agent-property'],
    ["run(installed['claude'])", 'agent-property'],
    ['const m = { claude: 1 }', 'agent-property'],
    ["const m = { 'cursor': 1 }", 'agent-property'],
    ['type I = { codex: boolean }', 'agent-property'],
    ['const claudeArgs = []', 'agent-identifier'],
    ['function cursorTurn() {}', 'agent-identifier'],
    ['function f(codexHome: string) {}', 'agent-identifier'],
    ['type ClaudeSpec = string', 'agent-identifier'],
    ['const CODEX_HOME = 1', 'agent-identifier'],
    ['interface X { isClaude: boolean }', 'agent-identifier'],
    ['if (x === DEFAULT_AGENT) go()', 'agent-default'],
    ['if (CLASSIFIER_AGENT != x) go()', 'agent-default'],
    ['switch (x) { case ids.DEFAULT_AGENT: break }', 'agent-default'],
  ])('shared code names no agent: %s', (source, rule) => {
    expect(agentRules('src/main/x.ts', source)).toEqual([rule])
  })

  test("words that only contain an agent's name, an i18n key, or a comment are not a name check", () => {
    const source = [
      "const s = 'agent.claude'",
      "const n = 'claude code'",
      '// the cursor agent',
      'const recursor = 1',
      'const cursory = 2',
      'const id = DEFAULT_AGENT',
      'f(DEFAULT_AGENT)',
    ].join('\n')
    expect(agentRules('src/main/x.ts', source)).toEqual([])
  })

  test.each([
    'src/core/agents/cursor/catalog.ts',
    'src/main/agents/cursor/waker.ts',
    'src/core/agents/ids.ts',
    'src/core/agents/descriptors.ts',
    'src/core/agents/registry.ts',
    'src/main/agents/registry.ts',
    'tests/core/a.test.ts',
    'e2e/a.spec.ts',
  ])(
    "the agent's own folders, the ids, the descriptors, the registries and the tests may name it: %s",
    (file) => {
      const source =
        "if (a === 'cursor') go()\nrun(AGENT_COMMANDS.cursor)\nconst cursorTurn = 1\nconst c = 'cursor-agent'"
      expect(agentRules(file, source)).toEqual([])
    },
  )

  test("an agent's folder may name only itself", () => {
    expect(agentRules('src/core/agents/claude/launch.ts', "if (a === 'cursor') go()")).toEqual([
      'agent-literal',
    ])
    expect(agentRules('src/core/agents/shared/jsonl.ts', 'const claudeLine = 1')).toEqual([
      'agent-identifier',
    ])
  })

  test('comparing to the default agent is allowed only where the default is defined and chosen', () => {
    const source = 'if (x === DEFAULT_AGENT) go()'
    expect(agentRules('src/core/agents/ids.ts', source)).toEqual([])
    expect(agentRules('src/core/agents/registry.ts', source)).toEqual([])
    expect(agentRules('src/main/agents/registry.ts', source)).toEqual([])
    expect(agentRules('src/core/agents/claude/index.ts', source)).toEqual(['agent-default'])
  })

  test.each([
    ['src/core/agents/claude/index.ts', "import { c } from '../cursor/catalog'"],
    ['src/main/agents/claude/waker.ts', "import { c } from '../../../core/agents/cursor/catalog'"],
    ['src/core/agents/shared/jsonl.ts', "import { c } from '../claude/catalog'"],
    ['src/main/workspace.ts', "import { kit } from '../core/agents/claude'"],
    ['src/core/command.ts', "export { plan } from './agents/claude/launch'"],
    ['src/main/agents/registry.ts', "import { kit } from '../../core/agents/claude/index'"],
  ])("an agent's folder is reached only through its registry: %s", (file, source) => {
    expect(agentRules(file, source)).toEqual(['agent-import'])
  })

  test("the registries, the descriptors and the agent's own folders import it", () => {
    expect(agentRules('src/core/agents/registry.ts', "import { kit } from './claude'")).toEqual([])
    expect(
      agentRules('src/main/agents/registry.ts', "import { kit } from './cursor/index'"),
    ).toEqual([])
    expect(
      agentRules(
        'src/core/agents/descriptors.ts',
        "import { descriptor } from './claude/descriptor'",
      ),
    ).toEqual([])
    expect(
      agentRules('src/core/agents/claude/index.ts', "import { plan } from './launch'"),
    ).toEqual([])
    expect(
      agentRules(
        'src/main/agents/claude/index.ts',
        "import { kit } from '../../../core/agents/claude'",
      ),
    ).toEqual([])
    expect(
      agentRules('src/core/agents/claude/index.ts', "import { slice } from '../shared/jsonl'"),
    ).toEqual([])
    expect(
      agentRules(
        'tests/core/agents/claude/launch.test.ts',
        "import { plan } from '../../../../src/core/agents/claude/launch'",
      ),
    ).toEqual([])
  })

  test.each([
    ['src/core/agents/descriptors.ts', "import { readFileSync } from 'node:fs'"],
    ['src/core/agents/claude/descriptor.ts', "import { t } from '../../i18n'"],
    ['src/core/agents/claude/descriptor.ts', "import { kit } from './index'"],
    ['src/renderer/addsession.ts', "import { kitOf } from '../core/agents/registry'"],
    ['src/core/control/server.ts', "import { kitOf } from '../agents/registry'"],
  ])(
    'the descriptors and what the renderer and the MCP server read stay free of Node: %s',
    (file, source) => {
      expect(agentRules(file, source)).toContain('descriptors-node-free')
    },
  )

  test('a descriptor reads the ids, other descriptors and types; the renderer reads the descriptors', () => {
    expect(
      agentRules(
        'src/core/agents/claude/descriptor.ts',
        "import type { AgentDescriptor } from '../types'\nimport type { AgentId } from '../ids'",
      ),
    ).toEqual([])
    expect(
      agentRules(
        'src/core/agents/descriptors.ts',
        "import { AGENT_IDS } from './ids'\nimport { descriptor } from './cursor/descriptor'",
      ),
    ).toEqual([])
    expect(
      agentRules(
        'src/renderer/addsession.ts',
        "import { descriptorOf } from '../core/agents/descriptors'",
      ),
    ).toEqual([])
  })

  test('a file may keep the hits its ALLOWED entry counts, and no more', () => {
    const source = "const a = 'claude'\nconst b = 'cursor'"
    const found = findViolations('src/main/x.ts', source, roster)
    const allowed = { 'src/main/x.ts': { 'agent-literal': { count: 2, reason: 'moved in P0.6' } } }
    expect(overAllowed(found, allowed)).toEqual([])
    expect(
      overAllowed(findViolations('src/main/x.ts', `${source}\nconst c = 'codex'`, roster), allowed),
    ).toEqual([{ file: 'src/main/x.ts', rule: 'agent-literal', count: 3, allowed: 2 }])
    expect(overAllowed(found, {})).toEqual([
      { file: 'src/main/x.ts', rule: 'agent-literal', count: 2, allowed: 0 },
    ])
  })

  test("the rules that existed before the agents' are never allowed by count", () => {
    const found = findViolations('src/core/a.ts', 'const t = Date.now()', roster)
    expect(
      overAllowed(found, { 'src/core/a.ts': { 'time-outside-clock': { count: 1, reason: 'x' } } }),
    ).toEqual([{ file: 'src/core/a.ts', rule: 'time-outside-clock', count: 1, allowed: 0 }])
  })
})
