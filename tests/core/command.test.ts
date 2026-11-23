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

  test('decision 1.106: a model given is passed as --model; none, no flag', () => {
    expect(
      buildCommand('claude', { kind: 'new', id: 'n1', name: 'w', model: 'sonnet' }, opts),
    ).toBe(`${CLI} --session-id n1 -n w --model sonnet --settings ${SETTINGS} && exit\n`)
    expect(buildCommand('claude', { kind: 'new', id: 'n1', name: 'w' }, opts)).not.toContain(
      '--model',
    )
    expect(
      buildCommand('claude', { kind: 'new', id: 'n1', model: 'claude-opus-4-1[1m]' }, opts),
    ).toContain("--model 'claude-opus-4-1[1m]'")
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

  // Plan 39 P3.2: Cursor takes the id Menkar chose, never a name or Claude's settings.
  test('TRM-7 a new Cursor session: its id, no name, no --settings', () => {
    expect(
      buildCommand(
        'cursor',
        { kind: 'new', id: 'x', name: 'spike' },
        { cli: '/bin/cursor-agent', settings: SETTINGS },
      ),
    ).toBe('/bin/cursor-agent --new-session-id x && exit\n')
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

  // Claude Code 2.1.326 stops a session at a trust dialog for each --add-dir, "No, exit" by default;
  // the project's folder goes in the --settings file instead.
  test('the command line never carries --add-dir', () => {
    for (const start of [
      { kind: 'new', id: 'n1' },
      { kind: 'resume', id: 'r1' },
      { kind: 'fork', source: 's', id: 'f1' },
    ] as const)
      expect(buildCommand('claude', start, opts)).not.toContain('--add-dir')
  })

  // a prompt Menkar starts a session with is read from a file by the shell,
  // never interpolated into the line, so nothing in it needs quoting.
  describe('a first prompt from a file', () => {
    // --mcp-config takes every word up to the next option (measured on 2.1.322 with --add-dir, which
    // did the same), so the prompt comes right after the identity.
    test('it goes as "$(cat \'<file>\')" right after the identity, before --mcp-config and --settings', () => {
      expect(
        buildCommand(
          'claude',
          { kind: 'new', id: 'n1', name: 'w' },
          { ...opts, mcpConfig: '{"a":1}', promptFile: '/c/p 1.md' },
        ),
      ).toBe(
        `${CLI} --session-id n1 -n w "$(cat '/c/p 1.md')" --mcp-config '{"a":1}' --settings ${SETTINGS} && exit\n`,
      )
      expect(
        buildCommand('claude', { kind: 'new', id: 'n1' }, { ...opts, promptFile: "/c/it's.md" }),
      ).toBe(`${CLI} --session-id n1 "$(cat '/c/it'"'"'s.md')" --settings ${SETTINGS} && exit\n`)
    })

    // Plan 39 P3.2: after `--`, so a prompt that starts with `-` is not an option.
    test('Cursor gets its prompt file last, after --', () => {
      expect(
        buildCommand('cursor', { kind: 'new' }, { cli: '/bin/c', promptFile: '/c/p.md' }),
      ).toBe(`/bin/c -- "$(cat /c/p.md)" && exit\n`)
    })
  })

  // Plan 31, decision 1: Menkar's MCP server reaches every Claude session it starts as inline JSON,
  // beside the user's own servers (no --strict-mcp-config).
  describe("Menkar's MCP server", () => {
    test('--mcp-config takes the JSON as one word, before --settings', () => {
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
        buildCommand('claude', { kind: 'resume', id: 'r1' }, { ...opts, mcpConfig: '{"a":1}' }),
      ).toBe(`${CLI} --resume r1 --mcp-config '{"a":1}' --settings ${SETTINGS} && exit\n`)
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

  // Decisions 1.150, 1.157: the team block reaches Claude as a file appended to its
  // system prompt, last on the line; a resume also rebuilds it rather than keep the recorded one.
  describe('the team block', () => {
    const teamFile = '/cache/menkar/control/team/p 1.md'
    const all = { ...opts, mcpConfig: '{"a":1}', pluginDir: '/p' }
    const tail = `--mcp-config '{"a":1}' --plugin-dir /p --settings ${SETTINGS}`
    test.each([
      [{ kind: 'new', id: 'n1', name: 'w1' } as const, '--session-id n1 -n w1', ''],
      [
        { kind: 'fork', source: 's1', id: 'f1' } as const,
        '--resume s1 --fork-session --session-id f1',
        '',
      ],
      [{ kind: 'resume', id: 'r1' } as const, '--resume r1', '--system-prompt-snapshot off '],
    ])('%o carries the file last', (start, identity, snapshot) => {
      expect(buildCommand('claude', start, { ...all, teamFile })).toBe(
        `${CLI} ${identity} ${tail} ${snapshot}--append-system-prompt-file '${teamFile}' && exit\n`,
      )
    })
    test('without the file the line is the one without the team', () => {
      expect(buildCommand('claude', { kind: 'resume', id: 'r1' }, all)).toBe(
        `${CLI} --resume r1 ${tail} && exit\n`,
      )
    })
    test('Cursor ignores it', () => {
      expect(
        buildCommand('cursor', { kind: 'resume', id: 'r1' }, { cli: '/bin/c', teamFile }),
      ).toBe('/bin/c --resume r1 && exit\n')
    })
  })
})
