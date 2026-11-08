import { describe, expect, test } from 'vitest'
import {
  countLine,
  filterSearch,
  folderName,
  groupByFolder,
  recentFolders,
  relativeTime,
  sessionSearchText,
} from '../../../src/core/sessions/history'
import type { SessionInfo } from '../../../src/core/sessions/info'

const H = 3600_000
const NOW = Date.UTC(2026, 10, 8, 12, 0, 0)

function s(
  id: string,
  cwd: string | null,
  ageMs: number,
  extra: Partial<SessionInfo> = {},
): SessionInfo {
  return {
    agent: 'claude',
    id,
    name: id,
    claudeNamed: false,
    file: `/x/${id}.jsonl`,
    folder: '/home/demo/.claude/projects/-transcript-dir',
    cwd,
    preview: '',
    badge: null,
    mtimeMs: NOW - ageMs,
    size: 100,
    hidden: false,
    ...extra,
  }
}

describe('the history', () => {
  test('SES-23 groups by folder, the group with the newest session first, sessions newest first', () => {
    const groups = groupByFolder([
      s('a1', '/home/demo/api', 2 * H),
      s('w1', '/home/demo/web', 5 * 60_000),
      s('a2', '/home/demo/api', H),
    ])
    expect(groups.map((g) => [g.name, g.sessions.map((x) => x.id)])).toEqual([
      ['web', ['w1']],
      ['api', ['a2', 'a1']],
    ])
  })

  test('SES-25 two folders with the same last name share one group', () => {
    expect(
      groupByFolder([s('a', '/home/demo/api', 1), s('b', '/srv/api', 2)]).map((g) => [
        g.name,
        g.sessions.length,
      ]),
    ).toEqual([['api', 2]])
  })

  test('a folder name: the last component of cwd, the whole cwd for /, the transcript folder without one', () => {
    expect(folderName(s('a', '/home/demo/api', 0))).toBe('api')
    expect(folderName(s('a', '/', 0))).toBe('/')
    expect(folderName(s('a', null, 0))).toBe('-transcript-dir')
  })

  test('SES-26, SES-27 search: a lowercased substring of name, folder, preview and id', () => {
    const a = s('1b4e28ba-2fa1-11d2-883f-0016d3cca427', '/home/demo/api', 0, {
      name: 'Payments',
      preview: 'fix the login bug',
    })
    expect(filterSearch([a], 'LOGIN', sessionSearchText)).toEqual([a])
    expect(filterSearch([a], '1b4e28ba', sessionSearchText)).toEqual([a])
    expect(filterSearch([a], 'zzz', sessionSearchText)).toEqual([])
  })

  test('AST-33 at most 50 rows; an empty query keeps all (up to the limit)', () => {
    const many = Array.from({ length: 80 }, (_, i) => s(`s${i}`, '/a', i))
    expect(filterSearch(many, 's', sessionSearchText)).toHaveLength(50)
    expect(filterSearch(many.slice(0, 3), '  ', sessionSearchText)).toHaveLength(3)
  })

  test('SES-28 the count line: sessions, distinct folder names, total size, open', () => {
    const sizes = [10_000, 10_000, 10_000, 5_000, 2_000, 274, 0]
    const list = sizes.map((size, i) => s(`s${i}`, `/f${i % 5}`, i, { size }))
    expect(countLine(list, 1)).toEqual({ sessions: 7, projects: 5, size: '36.4 KB', open: 1 })
  })

  test.each([
    [30_000, { key: 'time.justNow' }],
    [45 * 60_000, { key: 'time.minutes', params: { n: 45 } }],
    [10 * H, { key: 'time.hours', params: { n: 10 } }],
    [3 * 24 * H, { key: 'time.days', params: { n: 3 } }],
  ])('SES-29 %d ms ago reads as %j', (age, expected) => {
    expect(relativeTime(NOW - age, NOW)).toEqual(expected)
  })

  test('SES-29 a week or more is the date', () => {
    expect(relativeTime(Date.UTC(2026, 9, 31, 12), NOW)).toEqual({ date: '2026-10-31' })
  })

  test('SES-36 folders by their newest session, each once', () => {
    const list = [s('x1', '/a/x', 2 * H), s('y', '/b/y', H), s('x2', '/a/x', 3 * H)]
    expect(recentFolders(list)).toEqual(['/b/y', '/a/x'])
  })
})
