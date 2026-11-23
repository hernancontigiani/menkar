import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { descriptorOf } from '../../../src/core/agents/descriptors'
import { AGENT_IDS, type AgentId } from '../../../src/core/agents/ids'
import { kitOf } from '../../../src/core/agents/registry'
import {
  type AgentVersionView,
  bannerOf,
  compareVersions,
  hiddenVersions,
  readVersion,
  type Standing,
  standingOf,
  withHiddenVersion,
  withoutEscapes,
} from '../../../src/core/agents/versions'
import { catalog } from '../../../src/core/i18n'
import { parseState } from '../../../src/core/state'

const CLAUDE = { validated: '2.1.327', floor: '2.1.267' }

describe('an installed version against the validated one and the floor', () => {
  test.each<[string | null, boolean, Standing]>([
    [null, false, 'notInstalled'],
    [null, true, 'unknown'],
    ['2.1.240', true, 'old'],
    ['2.1.266', true, 'old'],
    ['2.1.267', true, 'older'],
    ['2.1.300', true, 'older'],
    ['2.1.327', true, 'validated'],
    ['2.1.330', true, 'newer'],
    ['2.1.1000', true, 'newer'],
    ['2.2.0', true, 'muchNewer'],
    ['3.0.0', true, 'muchNewer'],
    ['nightly', true, 'unknown'],
  ])('%s (found: %s) is %s', (installed, found, standing) => {
    expect(standingOf(installed, found, CLAUDE)).toBe(standing)
  })

  test('an agent with no validated version is "not validated", still below its floor is old', () => {
    expect(standingOf('2026.11.13-eacade1', true, { validated: null, floor: null })).toBe(
      'notValidated',
    )
    expect(standingOf('1.0.0', true, { validated: null, floor: '1.2.0' })).toBe('old')
  })

  test('versions compare as numbers, not as text', () => {
    expect(compareVersions('2.1.100', '2.1.99')).toBeGreaterThan(0)
    expect(compareVersions('2.1', '2.1.0')).toBe(0)
    expect(compareVersions('x', '2.1.0')).toBeNull()
  })

  test('the version is the first word --version prints', () => {
    expect(readVersion('2.1.327 (Claude Code)\n')).toBe('2.1.327')
    expect(readVersion('2026.11.13-eacade1\n')).toBe('2026.11.13-eacade1')
    expect(readVersion('  \n')).toBeNull()
  })

  // Each agent says where its version is in what `--version` prints, as each CLI prints it.
  test("each agent's version is read from its own --version output", () => {
    const of = (id: AgentId, output: string) => readVersion(output, descriptorOf(id).versionWord)
    expect(of('claude', '2.1.329 (Claude Code)\n')).toBe('2.1.329')
    expect(of('cursor', '2026.11.13-eacade1\n')).toBe('2026.11.13-eacade1')
    expect(of('codex', 'codex-cli 0.169.0\n')).toBe('0.169.0')
    expect(of('codex', 'codex-cli\n')).toBeNull()
    expect(of('opencode', 'opencode v2.3.0\n')).toBe('2.3.0')
    expect(
      standingOf(of('opencode', 'opencode v2.3.0\n'), true, { validated: '2.3.0', floor: null }),
    ).toBe('validated')
  })

  // OpenCode 2.3.0 under FORCE_COLOR=1, as measured: every word is wrapped in SGR codes.
  test('a colored --version reads as the plain one', () => {
    const colored = '\x1b[1mopencode\x1b[0m \x1b[2mv\x1b[0m\x1b[1m2.3.0\x1b[0m\n'
    expect(readVersion(colored, descriptorOf('opencode').versionWord)).toBe('2.3.0')
    expect(readVersion('\x1b[32m2.1.329\x1b[0m (Claude Code)\n')).toBe('2.1.329')
    expect(withoutEscapes('\x1b]8;;https://x\x1b\\a\x1b]0;t\x07b\x9b1mc\x1bMd')).toBe('abcd')
  })
})

const view = (
  agent: 'claude' | 'cursor',
  standing: Standing,
  hidden = false,
): AgentVersionView => ({
  agent,
  installed: '1.0.0',
  validated: null,
  floor: null,
  standing,
  hidden,
})

describe('the banner', () => {
  test('says nothing when every agent is validated, older, not validated or not installed', () => {
    const quiet: Standing[] = ['validated', 'older', 'notValidated', 'notInstalled', 'unknown']
    expect(bannerOf(quiet.map((s) => view('claude', s)))).toBeNull()
  })

  test('shows the most serious: too old before much newer', () => {
    expect(bannerOf([view('claude', 'newer'), view('cursor', 'old')])?.agent).toBe('cursor')
    expect(bannerOf([view('claude', 'muchNewer'), view('cursor', 'newer')])?.agent).toBe('claude')
  })

  test('a patch newer than validated says nothing: About shows it', () => {
    expect(bannerOf([view('claude', 'newer')])).toBeNull()
    expect(bannerOf([view('claude', 'old', true), view('cursor', 'newer')])).toBeNull()
  })

  test('a hidden one is skipped', () => {
    expect(bannerOf([view('claude', 'old', true), view('cursor', 'muchNewer')])?.agent).toBe(
      'cursor',
    )
    expect(bannerOf([view('claude', 'old', true)])).toBeNull()
  })

  test('Hide is kept per agent in state.json, and other keys survive', () => {
    const state = parseState({ names: {}, hidden: [], other: 1, agent_versions_hidden: 'junk' })
    expect(hiddenVersions(state)).toEqual({})
    const next = withHiddenVersion(withHiddenVersion(state, 'claude', '2.2.0'), 'cursor', 'a')
    expect(hiddenVersions(next)).toEqual({ claude: '2.2.0', cursor: 'a' })
    expect(next.rest.other).toBe(1)
  })
})

describe("the validated versions are docs/agent-versions.md's rows", () => {
  const doc = readFileSync(join(import.meta.dirname, '../../../docs/agent-versions.md'), 'utf8')
  const english = catalog('en')

  test.each(AGENT_IDS.map((id) => [id]))('%s', (id) => {
    const name = english[descriptorOf(id).label]
    const row = new RegExp(`^## ${name} — (?:validated at (\\S+) |no row yet)`, 'm').exec(doc)
    expect(row, `a row for ${name}`).not.toBeNull()
    expect(descriptorOf(id).versions.validated).toBe(row?.[1] ?? null)
  })

  test('the floor is the team block floor of its kit', () => {
    for (const id of AGENT_IDS)
      expect(descriptorOf(id).versions.floor).toBe(kitOf(id).team?.floor?.version ?? null)
  })
})
