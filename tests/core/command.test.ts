import { describe, expect, test } from 'vitest'
import { buildCommand, shellQuote } from '../../src/core/command'

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

  test('TRM-4 continue last', () => {
    expect(buildCommand('claude', { kind: 'continue' }, opts)).toBe(
      `${CLI} --continue --settings ${SETTINGS} && exit\n`,
    )
  })

  test('TRM-5 the advanced flags come first, in order', () => {
    expect(
      buildCommand(
        'claude',
        {
          kind: 'new',
          model: 'opus',
          mode: 'acceptEdits',
          addDir: '/home/ana/docs',
          id: 'id1',
          name: 'api',
        },
        opts,
      ),
    ).toBe(
      `${CLI} --model opus --permission-mode acceptEdits --add-dir /home/ana/docs --session-id id1 -n api --settings ${SETTINGS} && exit\n`,
    )
  })

  test('TRM-6 with every advanced field at Default, none of those flags', () => {
    const line = buildCommand('claude', { kind: 'new', id: 'id1', name: 'api' }, opts)
    expect(line).not.toMatch(/--model|--permission-mode|--add-dir/)
  })

  test('TRM-7 a new Cursor session: model and mode, no id, no name, no --settings', () => {
    expect(
      buildCommand(
        'cursor',
        { kind: 'new', model: 'gpt-5', mode: 'ask', id: 'x', name: 'spike' },
        { cli: '/bin/cursor-agent', settings: SETTINGS },
      ),
    ).toBe('/bin/cursor-agent --model gpt-5 --mode ask && exit\n')
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
})
