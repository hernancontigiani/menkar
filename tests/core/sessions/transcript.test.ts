import { describe, expect, test } from 'vitest'
import {
  details,
  exportMarkdown,
  replayTurns,
  safeFileName,
} from '../../../src/core/sessions/transcript'
import {
  assistant,
  cursorAssistant,
  cursorUser,
  jsonl,
  text,
  toolResult,
  toolUse,
  user,
} from '../../factories/transcript'

describe('details', () => {
  test('SES-48 typed user lines, assistant lines, tool calls and MCP servers used', () => {
    const file = jsonl([
      user('one', { timestamp: '2026-11-08T10:00:00Z' }),
      user('two'),
      user('three'),
      toolResult(),
      toolResult(),
      assistant([text('a'), toolUse('mcp__github__search')], {
        message: { content: [text('a'), toolUse('mcp__github__search')], model: 'claude-x' },
      }),
      assistant('b'),
      assistant([toolUse('Bash', { command: 'ls' })]),
      assistant('c'),
      assistant('d', { timestamp: '2026-11-08T11:00:00Z' }),
    ])
    const d = details(file, 'claude')
    expect([d.user, d.assistant, d.toolCalls]).toEqual([3, 5, 2])
    expect(d.mcpUsed).toEqual([['github', 1]])
    expect([d.created, d.lastActivity]).toEqual(['2026-11-08T10:00:00Z', '2026-11-08T11:00:00Z'])
  })

  test('SES-49 Cursor: messages counted by role; no times, models or tool calls', () => {
    const d = details(jsonl([cursorUser('q'), cursorAssistant('a'), cursorUser('r')]), 'cursor')
    expect([d.user, d.assistant, d.toolCalls, d.created, d.models]).toEqual([2, 1, 0, null, []])
  })

  test('SES-51 recent activity: the last 12 messages, oldest first; a Claude message cut at 500', () => {
    const lines = Array.from({ length: 20 }, (_, i) =>
      i % 2 === 0 ? user(`u${i}`) : assistant(`a${i}`),
    )
    lines.push(assistant('x'.repeat(900)))
    const recent = details(jsonl(lines), 'claude').recent
    expect(recent).toHaveLength(12)
    expect(recent[0]?.text).toBe('a9')
    expect(recent.at(-1)?.text).toHaveLength(500)
  })
})

describe('export as Markdown', () => {
  test.each([
    ['Fix: login/OAuth?', 'Fix_ login_OAuth_.md'],
    ['???', '___.md'],
    ['   ', 'session.md'],
  ])('SES-52 %j is proposed as %s', (name, file) => {
    expect(safeFileName(name)).toBe(file)
  })

  test('SES-53 the exact file for one typed message and one assistant line with a tool', () => {
    const file = jsonl([
      user('hi', { cwd: '/home/demo/api', timestamp: '2026-11-08T10:00:00Z' }),
      assistant([text('Hello'), toolUse('Read', { file_path: '/a/b.py' })], {
        timestamp: '2026-11-08T10:01:00Z',
      }),
    ])
    expect(exportMarkdown('api work', 'abc', file, 'claude')).toBe(
      '# api work\n\n- **Session:** `abc`\n- **Project:** `/home/demo/api`\n- **Created:** 2026-11-08T10:00:00Z\n- **Last activity:** 2026-11-08T10:01:00Z\n\n---\n\n### You\n\nhi\n\n### Claude\n\nHello\n\n*Used `Read`*\n',
    )
  })

  test('SES-54 no messages', () => {
    expect(exportMarkdown('x', 'abc', jsonl([toolResult()]), 'claude')).toBe(
      '# x\n\n- **Session:** `abc`\n\n---\n\n_No messages._\n',
    )
  })
})

describe('replay', () => {
  test('SES-56 a user message, then text, a Read chip, text', () => {
    const file = jsonl([
      user('look at c'),
      assistant([text('Let me look.'), toolUse('Read', { file_path: '/a/b/c.py' }), text('Done.')]),
    ])
    expect(replayTurns(file, 'claude')).toEqual([
      { kind: 'user', text: 'look at c' },
      { kind: 'assistant', text: 'Let me look.' },
      { kind: 'tool', text: '🔧 Read c.py' },
      { kind: 'assistant', text: 'Done.' },
    ])
  })

  test('SES-58 only injected lines and "(no content)" give nothing to replay', () => {
    expect(
      replayTurns(
        jsonl([user('<command-name>/clear</command-name>'), assistant('(no content)')]),
        'claude',
      ),
    ).toEqual([])
  })

  test('SES-59 a Bash chip shows the first 60 characters of the collapsed command', () => {
    const command = `echo ${'x'.repeat(95)}`
    expect(replayTurns(jsonl([assistant([toolUse('Bash', { command })])]), 'claude')).toEqual([
      { kind: 'tool', text: `🔧 Bash: ${command.slice(0, 60)}` },
    ])
  })

  test('an AskUserQuestion shows its first question and options', () => {
    const ask = toolUse('AskUserQuestion', {
      questions: [
        { header: 'Scope', question: 'Which one?', options: [{ label: 'A' }, { label: 'B' }] },
      ],
    })
    expect(replayTurns(jsonl([assistant([ask])]), 'claude')).toEqual([
      { kind: 'assistant', text: '❓ Scope\nWhich one?\n- A\n- B' },
    ])
  })

  test('Cursor turns strip the user query', () => {
    expect(replayTurns(jsonl([cursorUser('do it'), cursorAssistant('ok')]), 'cursor')).toEqual([
      { kind: 'user', text: 'do it' },
      { kind: 'assistant', text: 'ok' },
    ])
  })
})
