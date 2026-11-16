import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import ts from 'typescript'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { classifySince, withSwitch } from '../../src/core/classifier/settings'
import {
  IntegrationError,
  installRetention,
  installStatusline,
  removeRetention,
  removeStatusline,
} from '../../src/core/context/integrations'
import { chainedCommand } from '../../src/core/context/settings'
import {
  FLAVOR_ENV,
  flavor,
  flavorFacts,
  paneFlavorEnv,
  refusalFor,
  resolveBuildFlavor,
} from '../../src/core/flavor'
import { agentPaths, appDirs, filesRoot } from '../../src/core/paths'
import { withoutSessionEnv } from '../../src/core/sessionenv'
import { parseState, startedSessions, withStarted } from '../../src/core/state'
import { runUsageCli } from '../../src/core/usage/cli'

// 1.155 Q3, 1.158: the branch's build runs as a second flavour that cannot touch the human's
// Menkar. The build defines the flavour; a test stubs that definition.
const asSandbox = () => vi.stubGlobal('__MENKAR_FLAVOR__', 'sandbox')

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the flavour menkar changes nothing (R10)', () => {
  test('with no definition the flavour is menkar', () => {
    expect(flavor()).toBe('menkar')
  })

  test('its directories, files folder and title are the ones it always had', () => {
    const root = process.env.MENKAR_TEST_ROOT ?? ''
    expect(appDirs()).toEqual({
      config: join(root, 'config', 'menkar'),
      cache: join(root, 'cache', 'menkar'),
      data: join(root, 'data', 'menkar'),
    })
    expect(filesRoot('')).toBe(join(homedir(), 'Menkar'))
    expect(flavorFacts().titleKey).toBe('window.title')
    expect(flavorFacts().ownsOnly).toBe(false)
  })

  test('a pane carries no flavour, and an inherited one is stripped', () => {
    expect(paneFlavorEnv()).toEqual({})
    expect(withoutSessionEnv({ [FLAVOR_ENV]: 'sandbox', PATH: '/bin' })).toEqual({ PATH: '/bin' })
  })
})

describe('the flavour sandbox', () => {
  test('its directories are menkar-sandbox under each XDG home', () => {
    asSandbox()
    const root = process.env.MENKAR_TEST_ROOT ?? ''
    expect(flavor()).toBe('sandbox')
    expect(appDirs()).toEqual({
      config: join(root, 'config', 'menkar-sandbox'),
      cache: join(root, 'cache', 'menkar-sandbox'),
      data: join(root, 'data', 'menkar-sandbox'),
    })
  })

  test('its files folder is ~/Menkar-sandbox and its title "Menkar Sandbox"', () => {
    asSandbox()
    expect(filesRoot('')).toBe(join(homedir(), 'Menkar-sandbox'))
    expect(filesRoot('/elsewhere')).toBe('/elsewhere')
    expect(flavorFacts().titleKey).toBe('window.titleSandbox')
  })

  test('a pane carries MENKAR_FLAVOR=sandbox; an inherited one is stripped first', () => {
    asSandbox()
    expect(paneFlavorEnv()).toEqual({ [FLAVOR_ENV]: 'sandbox' })
    expect(withoutSessionEnv({ [FLAVOR_ENV]: 'menkar', HOME: '/h' })).toEqual({ HOME: '/h' })
  })

  test('the agents’ own folders are the same: the sandbox reads real sessions', () => {
    const daily = agentPaths()
    asSandbox()
    expect(agentPaths()).toEqual(daily)
  })
})

// The CLI's help names the command the flavour's package installs.
describe('the command line', () => {
  const help = () => {
    const err: string[] = []
    runUsageCli(['--period', 'never'], { out: () => undefined, err: (line) => err.push(line) })
    return err.join('\n')
  }

  test('menkar says menkar usage', () => {
    expect(help()).toMatch(/ menkar usage \[/)
    expect(help()).toMatch(/^menkar usage: error:/m)
  })

  test('the sandbox says menkar-sandbox usage', () => {
    asSandbox()
    expect(help()).toMatch(/ menkar-sandbox usage \[/)
    expect(help()).toMatch(/^menkar-sandbox usage: error:/m)
  })
})

// S11: a .deb built in the worktree can never be a menkar package by mistake.
describe("the build's flavour", () => {
  test('MENKAR_FLAVOR_BUILD wins', () => {
    expect(resolveBuildFlavor('menkar', 'multi-agent')).toBe('menkar')
    expect(resolveBuildFlavor('sandbox', 'main')).toBe('sandbox')
  })

  test('on main it is menkar; on any other branch, sandbox', () => {
    expect(resolveBuildFlavor(undefined, 'main')).toBe('menkar')
    expect(resolveBuildFlavor('', 'main')).toBe('menkar')
    expect(resolveBuildFlavor(undefined, 'multi-agent')).toBe('sandbox')
    expect(resolveBuildFlavor(undefined, 'HEAD')).toBe('sandbox')
  })

  test('an unknown value is refused, not read as either', () => {
    expect(() => resolveBuildFlavor('daily', 'main')).toThrow(/daily/)
  })
})

// §2.12's table: one statusLine fits in ~/.claude/settings.json; a flavour never chains to a
// Menkar statusline of any flavour, which would log its sessions into the other's files.
describe('the statusline a session chains to', () => {
  const own =
    "ELECTRON_RUN_AS_NODE=1 /opt/Menkar-sandbox/menkar-sandbox '/opt/Menkar-sandbox/resources/app.asar/out/main/statusline.js'"
  const settings = (command: string) => {
    const path = agentPaths().claudeSettings
    mkdirSync(join(path, '..'), { recursive: true })
    writeFileSync(path, JSON.stringify({ statusLine: { type: 'command', command } }))
  }

  test("another Menkar's statusline is not chained", async () => {
    settings(
      "ELECTRON_RUN_AS_NODE=1 /opt/Menkar/menkar '/opt/Menkar/resources/app.asar/out/main/statusline.js'",
    )
    expect(await chainedCommand(own)).toBeNull()
    settings(
      "ELECTRON_RUN_AS_NODE=1 '/home/u/git/menkar/node_modules/electron/dist/electron' '/home/u/git/menkar/out/main/statusline.js'",
    )
    expect(await chainedCommand(own)).toBeNull()
  })

  test("the user's own script is chained", async () => {
    settings('~/.claude/statusline.sh')
    expect(await chainedCommand(own)).toBe('~/.claude/statusline.sh')
  })
})

// §2.12's table, 1.159 S11: the sandbox offers nothing that writes ~/.claude/settings.json, and
// its classifier stays off whatever its state says.
describe('what the sandbox offers', () => {
  const on = withSwitch({}, true, 1_000)

  test('menkar offers the Claude settings items and classifies when switched on', () => {
    expect(flavorFacts().offersSettingsFileItems).toBe(true)
    expect(flavorFacts().classifies).toBe(true)
    expect(classifySince(on)).toBe(1_000)
  })

  test('the sandbox offers neither, and never classifies', () => {
    asSandbox()
    expect(flavorFacts().offersSettingsFileItems).toBe(false)
    expect(flavorFacts().classifies).toBe(false)
    expect(classifySince(on)).toBeNull()
  })
})

// 1.158: the sandbox cannot write ~/.claude/settings.json by any path, not only from its page.
describe("the sandbox's writes to Claude Code's settings", () => {
  test.each([
    ['installing the statusline', () => installStatusline('x')],
    ['removing the statusline', () => removeStatusline('x')],
    ['installing retention', () => installRetention()],
    ['removing retention', () => removeRetention()],
  ])('%s is refused and the file keeps its bytes', async (_what, write) => {
    const path = agentPaths().claudeSettings
    mkdirSync(join(path, '..'), { recursive: true })
    writeFileSync(path, '{"theme":"dark"}\n')
    asSandbox()
    await expect(write()).rejects.toBeInstanceOf(IntegrationError)
    expect(readFileSync(path, 'utf8')).toBe('{"theme":"dark"}\n')
  })

  test('menkar still installs them', async () => {
    const path = agentPaths().claudeSettings
    mkdirSync(join(path, '..'), { recursive: true })
    writeFileSync(path, '{}\n')
    await installRetention()
    expect(JSON.parse(readFileSync(path, 'utf8')).cleanupPeriodDays).toBeGreaterThan(0)
  })
})

// 1.159 B1: the sandbox scans the same agents' folders, so it refuses resume, add, trash and
// delete for any session it did not start.
describe('the sessions the sandbox started', () => {
  test('started_sessions is read, added to once, and kept beside every other key', () => {
    const state = parseState({ names: {}, hidden: [], started_sessions: ['a', 7, 'b'], x: 1 })
    expect([...startedSessions(state)].sort()).toEqual(['a', 'b'])
    const next = withStarted(withStarted(state, 'c'), 'a')
    expect([...startedSessions(next)].sort()).toEqual(['a', 'b', 'c'])
    expect(next.rest.x).toBe(1)
    expect(startedSessions(parseState({}))).toEqual(new Set())
  })

  const started = new Set(['mine'])
  const actions = [
    { type: 'openSession', session: 'theirs' },
    { type: 'openBeside', session: 'theirs' },
    { type: 'pickSession', session: 'theirs' },
    { type: 'moveSession', session: 'theirs' },
    { type: 'trashSession', session: 'theirs' },
    { type: 'deleteSession', session: 'theirs' },
    { type: 'forkSession', session: 'theirs' },
    { type: 'continueInChat', session: 'theirs' },
    { type: 'setManaged', sessions: ['mine', 'theirs'] },
  ] as const

  test.each(actions)('the sandbox refuses $type on a session it did not start', (action) => {
    asSandbox()
    expect(refusalFor(action, started)).toBe('sandbox.notStarted')
  })

  test('the sandbox lets the same actions through on a session it started', () => {
    asSandbox()
    expect(refusalFor({ type: 'trashSession', session: 'mine' }, started)).toBeNull()
    expect(refusalFor({ type: 'setManaged', sessions: ['mine'] }, started)).toBeNull()
    expect(refusalFor({ type: 'newWindow' }, started)).toBeNull()
  })

  test('menkar refuses nothing', () => {
    for (const action of actions) expect(refusalFor(action, new Set())).toBeNull()
  })

  // The refusal comes before anything the action would do, so no transcript under the agent's
  // home is ever reached. The MCP's tools act only on the caller's project, which holds only
  // sessions the sandbox started.
  test('runAction asks the guard before anything else', () => {
    const path = join(__dirname, '..', '..', 'src', 'main', 'workspace.ts')
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest)
    const first = (name: string): string => {
      let found = ''
      source.forEachChild((node) => {
        if (ts.isFunctionDeclaration(node) && node.name?.text === name && node.body)
          found = node.body.statements[0]?.getText(source) ?? ''
      })
      return found
    }
    expect(first('runAction')).toMatch(/refusalFor\(action, /)
  })
})
