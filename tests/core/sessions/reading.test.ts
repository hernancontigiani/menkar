import { describe, expect, test } from 'vitest'
import { badgeOf } from '../../../src/core/sessions/badges'
import { cursorCwd } from '../../../src/core/sessions/cursor'
import { readHead } from '../../../src/core/sessions/head'
import { messageText, parseLine } from '../../../src/core/sessions/lines'
import { applyNameLines, emptyNames, sessionName } from '../../../src/core/sessions/names'
import {
  aiTitle,
  assistant,
  cursorAssistant,
  cursorUser,
  customTitle,
  ID,
  jsonl,
  text,
  toolResult,
  toolUse,
  user,
} from '../../factories/transcript'

describe('transcript lines', () => {
  test('a line that is not JSON or not an object is skipped', () => {
    expect(parseLine('not json')).toBeNull()
    expect(parseLine('[1,2]')).toBeNull()
    expect(parseLine('"x"')).toBeNull()
    expect(parseLine('{"type":"user"}')).toEqual({ type: 'user' })
  })

  test('the text of a message is its string content or its text blocks joined by one space', () => {
    expect(messageText(user('hello'))).toBe('hello')
    expect(messageText(user([text('a'), toolUse('Read') as never, text('b')]))).toBe('a b')
    expect(messageText(toolResult())).toBeNull()
    expect(messageText({ type: 'custom-title' })).toBeNull()
  })
})

describe('preview and folder', () => {
  test('SES-10 injected lines are skipped and whitespace collapsed', () => {
    const head = jsonl([
      user('<command-name>/clear</command-name>', { cwd: '/home/demo/api' }),
      user('  fix   the\nlogin bug '),
    ])
    expect(readHead(head, 'claude')).toEqual({
      cwd: '/home/demo/api',
      preview: 'fix the login bug',
    })
  })

  test('SES-12 a first typed message of 300 characters gives its first 120', () => {
    const long = 'x'.repeat(300)
    expect(readHead(jsonl([user(long)]), 'claude').preview).toBe('x'.repeat(120))
  })

  test('SES-13 a first typed message on line 51 gives no preview', () => {
    const lines = [...Array.from({ length: 50 }, () => toolResult()), user('too late')]
    expect(readHead(jsonl(lines), 'claude').preview).toBe('')
    expect(readHead(jsonl(lines.slice(1)), 'claude').preview).toBe('too late')
  })

  test('the folder is the first line carrying a cwd, and a tool result is not a message', () => {
    const head = jsonl([
      { type: 'summary' },
      toolResult(),
      user('hi', { cwd: '/a' }),
      user('x', { cwd: '/b' }),
    ])
    expect(readHead(head, 'claude')).toEqual({ cwd: '/a', preview: 'hi' })
  })

  test("Cursor's preview is the first user query without its tags", () => {
    const head = jsonl([cursorAssistant('hello'), cursorUser('  make it   faster ')])
    expect(readHead(head, 'cursor')).toEqual({ cwd: null, preview: 'make it faster' })
  })
})

describe('badges', () => {
  test('SES-19 the last text-bearing line is an assistant question → waiting', () => {
    expect(
      badgeOf(
        jsonl([user('go'), assistant([text('Should I also update the tests?  ')])]),
        'claude',
        true,
      ),
    ).toBe('waiting')
  })

  test('SES-20 an assistant question answered by the user → no badge', () => {
    expect(badgeOf(jsonl([assistant('Should I?'), user('yes')]), 'claude', true)).toBeNull()
  })

  test('SES-21 the user interrupted → interrupted', () => {
    expect(
      badgeOf(
        jsonl([assistant('Working'), user([text('[Request interrupted by user]')])]),
        'claude',
        true,
      ),
    ).toBe('interrupted')
  })

  test('SES-22 tool results after a question carry no text → still waiting', () => {
    expect(
      badgeOf(jsonl([assistant('Which file?'), toolResult(), toolResult()]), 'claude', true),
    ).toBe('waiting')
  })

  test('an injected user line does not answer a question, and a statement is not waiting', () => {
    expect(
      badgeOf(
        jsonl([assistant('Which?'), user('<system-reminder>x</system-reminder>')]),
        'claude',
        true,
      ),
    ).toBe('waiting')
    expect(badgeOf(jsonl([assistant('Done.')]), 'claude', true)).toBeNull()
  })

  test('a tail cut mid-line drops its first, partial line', () => {
    const whole = jsonl([assistant('Is this cut?'), user('answered')])
    const cut = whole.slice(whole.indexOf('answered') - 5)
    expect(badgeOf(cut, 'claude', false)).toBeNull()
    expect(badgeOf(whole.slice(10), 'claude', false)).toBe(
      badgeOf(jsonl([user('answered')]), 'claude', true),
    )
  })

  test('Cursor reads role, strips the user query, and is never interrupted', () => {
    expect(
      badgeOf(jsonl([cursorUser('go'), cursorAssistant('Ready to apply?')]), 'cursor', true),
    ).toBe('waiting')
    expect(
      badgeOf(jsonl([cursorAssistant('Ready?'), cursorUser('yes')]), 'cursor', true),
    ).toBeNull()
    expect(badgeOf(jsonl([cursorUser('[Request interrupted by user]')]), 'cursor', true)).toBeNull()
  })
})

describe("a session's name", () => {
  const base = { agent: 'claude' as const, id: ID, preview: 'fix the login bug' }

  test('SES-8 the last custom-title wins over the generated title', () => {
    const names = applyNameLines(
      emptyNames(),
      jsonl([customTitle('alpha'), customTitle('beta'), aiTitle('Fix login')]),
    )
    expect(sessionName({ ...base, ...names }, undefined)).toBe('beta')
  })

  test("SES-9 the app's name comes before the generated title; cleared, the title shows", () => {
    const names = applyNameLines(emptyNames(), jsonl([aiTitle('Fix login')]))
    expect(sessionName({ ...base, ...names }, 'Mine')).toBe('Mine')
    expect(sessionName({ ...base, ...names }, undefined)).toBe('Fix login')
  })

  test('SES-10 with no titles and no app name, the preview', () => {
    expect(sessionName({ ...base, ...emptyNames() }, '')).toBe('fix the login bug')
  })

  test("SES-11 with nothing else, the id's first 8 characters", () => {
    expect(sessionName({ ...base, preview: '', ...emptyNames() }, undefined)).toBe('1b4e28ba')
  })

  test('titles are trimmed, and a blank one does not count', () => {
    const names = applyNameLines(
      emptyNames(),
      jsonl([customTitle('  gamma  '), aiTitle('t'), customTitle('   ')]),
    )
    expect(names).toEqual({ customTitle: 'gamma', aiTitle: 't' })
  })

  test("Cursor sessions have no Claude name: the app's, else the preview, else the id", () => {
    const cursor = {
      agent: 'cursor' as const,
      id: 'abcdef1234',
      preview: 'p',
      customTitle: 'x',
      aiTitle: 'y',
    }
    expect(sessionName(cursor, 'Mine')).toBe('Mine')
    expect(sessionName(cursor, undefined)).toBe('p')
    expect(sessionName({ ...cursor, preview: '' }, undefined)).toBe('abcdef12')
  })
})

describe("Cursor's folder", () => {
  test('SES-6 the dashes are placed against the real filesystem', () => {
    const dirs = new Set(['/home', '/home/demo', '/home/demo/my-app'])
    expect(cursorCwd('home-demo-my-app', (p) => dirs.has(p))).toBe('/home/demo/my-app')
    expect(cursorCwd('home-demo-my-app', () => false)).toBe('/home/demo/my/app')
  })

  test('the longest run that exists is taken at each level', () => {
    const dirs = new Set(['/srv', '/srv/a', '/srv/a-b', '/srv/a-b/c'])
    expect(cursorCwd('srv-a-b-c', (p) => dirs.has(p))).toBe('/srv/a-b/c')
  })
})
