import { describe, expect, test } from 'vitest'
import { buildCommand, mcpConfig, shellQuote } from '../../src/core/command'

const CLI = '/usr/local/bin/claude'
const SETTINGS = '/home/ana/.config/menkar/claude-settings.json'
const opts = { cli: CLI, settings: SETTINGS }

describe('command lines', () => {
  test('TRM-1 a new Claude Code session with a name', () => {
    expect(
      buildCommand('claude', { kind: 'new', id: '0b6c-e1', name: 'checkout flow' }, opts),
    ).toBe(`${CLI} --session-id 0b6c-e1 -n 'checkout flow' --settings ${SETTINGS} && exit\n`)
  })

  test('TRM-2 a resume', () => {
    expect(buildCommand('claude', { kind: 'resume', id: '7f3a' }, opts)).toBe(
      `${CLI} --resume 7f3a --settings ${SETTINGS} && exit\n`,
    )
  })

  test('TRM-3 a fork never carries Remote Control', () => {
    expect(
      buildCommand(
        'claude',
        { kind: 'fork', source: '7f3a', id: 'c41d' },
        { ...opts, remoteControl: 'x' },
      ),
    ).toBe(`${CLI} --resume 7f3a --fork-session --session-id c41d --settings ${SETTINGS} && exit\n`)
  })

  test('TRM-7 a new Cursor session: no id, no name, no --settings', () => {
    expect(
      buildCommand(
        'cursor',
        { kind: 'new', id: 'x', name: 'spike' },
        { cli: '/bin/cursor-agent', settings: SETTINGS },
      ),
    ).toBe('/bin/cursor-agent && exit\n')
  })

  test('TRM-8 a Cursor resume', () => {
    expect(
      buildCommand('cursor', { kind: 'resume', id: 'ab12' }, { cli: '/bin/cursor-agent' }),
    ).toBe('/bin/cursor-agent --resume ab12 && exit\n')
  })

  test('TRM-9 a name with an apostrophe is one shell word', () => {
    expect(shellQuote("Ana's")).toBe(`'Ana'"'"'s'`)
    expect(shellQuote('plain-word_1.2@x')).toBe('plain-word_1.2@x')
    expect(shellQuote('')).toBe("''")
  })

  test('Remote Control is one argument, after the identity, before --settings', () => {
    expect(
      buildCommand('claude', { kind: 'resume', id: 'r1' }, { ...opts, remoteControl: 'my phone' }),
    ).toBe(`${CLI} --resume r1 '--remote-control=my phone' --settings ${SETTINGS} && exit\n`)
  })

  test('without the settings file the line simply has no --settings', () => {
    expect(buildCommand('claude', { kind: 'resume', id: 'r1' }, { cli: CLI })).toBe(
      `${CLI} --resume r1 && exit\n`,
    )
  })

  describe('the project files folder (decision 1.51)', () => {
    const dirs = { ...opts, addDirs: ['/h/Menkar/p/files'] }
    test.each<[string, Parameters<typeof buildCommand>[1], string]>([
      ['new', { kind: 'new', id: 'n1' }, '--session-id n1'],
      ['resume', { kind: 'resume', id: 'r1' }, '--resume r1'],
      [
        'fork',
        { kind: 'fork', source: 's', id: 'f1' },
        '--resume s --fork-session --session-id f1',
      ],
    ])('a %s Claude session gets --add-dir before --settings', (_, start, identity) => {
      expect(buildCommand('claude', start, dirs)).toBe(
        `${CLI} ${identity} --add-dir /h/Menkar/p/files --settings ${SETTINGS} && exit\n`,
      )
    })

    test('a path with a space is quoted; Cursor gets no --add-dir', () => {
      expect(
        buildCommand(
          'claude',
          { kind: 'resume', id: 'r1' },
          { cli: CLI, addDirs: ['/h/My Files'] },
        ),
      ).toBe(`${CLI} --resume r1 --add-dir '/h/My Files' && exit\n`)
      expect(buildCommand('cursor', { kind: 'resume', id: 'r1' }, { ...dirs, cli: '/bin/c' })).toBe(
        '/bin/c --resume r1 && exit\n',
      )
    })
  })

  // a prompt Menkar starts a session with is read from a file by the shell,
  // never interpolated into the line, so nothing in it needs quoting.
  describe('a first prompt from a file', () => {
    // --add-dir and --mcp-config take every word up to the next option (measured on 2.1.322: a
    // prompt after --add-dir never reached the session), so the prompt comes right after the identity.
    test('it goes as "$(cat \'<file>\')" right after the identity, before --add-dir and --settings', () => {
      expect(
        buildCommand(
          'claude',
          { kind: 'new', id: 'n1', name: 'w' },
          { ...opts, addDirs: ['/h/f'], promptFile: '/c/p 1.md' },
        ),
      ).toBe(
        `${CLI} --session-id n1 -n w "$(cat '/c/p 1.md')" --add-dir /h/f --settings ${SETTINGS} && exit\n`,
      )
      expect(
        buildCommand('claude', { kind: 'new', id: 'n1' }, { ...opts, promptFile: "/c/it's.md" }),
      ).toBe(`${CLI} --session-id n1 "$(cat '/c/it'"'"'s.md')" --settings ${SETTINGS} && exit\n`)
    })

    test('Cursor gets no prompt file', () => {
      expect(
        buildCommand('cursor', { kind: 'new' }, { cli: '/bin/c', promptFile: '/c/p.md' }),
      ).toBe('/bin/c && exit\n')
    })
  })

  // Plan 31, decision 1: Menkar's MCP server reaches every Claude session it starts as inline JSON,
  // beside the user's own servers (no --strict-mcp-config).
  describe("Menkar's MCP server", () => {
    test('--mcp-config takes the JSON as one word, after --add-dir, before --settings', () => {
      const json = mcpConfig('/opt/Menkar/menkar', '/opt/Menkar/resources/mcp-server.js')
      expect(JSON.parse(json)).toEqual({
        mcpServers: {
          menkar: {
            type: 'stdio',
            command: '/opt/Menkar/menkar',
            args: ['/opt/Menkar/resources/mcp-server.js'],
            env: { ELECTRON_RUN_AS_NODE: '1' },
          },
        },
      })
      expect(
        buildCommand(
          'claude',
          { kind: 'resume', id: 'r1' },
          { ...opts, addDirs: ['/h/f'], mcpConfig: '{"a":1}' },
        ),
      ).toBe(
        `${CLI} --resume r1 --add-dir /h/f --mcp-config '{"a":1}' --settings ${SETTINGS} && exit\n`,
      )
      expect(
        buildCommand('cursor', { kind: 'resume', id: 'r1' }, { cli: '/bin/c', mcpConfig: '{}' }),
      ).toBe('/bin/c --resume r1 && exit\n')
    })
  })

  // Plan 33, decision 8: Menkar's skills reach every Claude session as a plugin folder, before
  // --settings; Cursor gets nothing.
  describe("Menkar's skills plugin", () => {
    const pluginDir = '/opt/Menkar/resources/plugin'
    test.each([
      [{ kind: 'new', id: 'n1', name: 'w1' } as const, `--session-id n1 -n w1`],
      [{ kind: 'resume', id: 'r1' } as const, '--resume r1'],
      [
        { kind: 'fork', source: 's1', id: 'f1' } as const,
        '--resume s1 --fork-session --session-id f1',
      ],
    ])('%o carries --plugin-dir after --mcp-config, before --settings', (start, identity) => {
      expect(buildCommand('claude', start, { ...opts, mcpConfig: '{"a":1}', pluginDir })).toBe(
        `${CLI} ${identity} --mcp-config '{"a":1}' --plugin-dir ${pluginDir} --settings ${SETTINGS} && exit\n`,
      )
    })
    test('Cursor gets no --plugin-dir', () => {
      expect(
        buildCommand('cursor', { kind: 'resume', id: 'r1' }, { cli: '/bin/c', pluginDir }),
      ).toBe('/bin/c --resume r1 && exit\n')
    })
  })
})
