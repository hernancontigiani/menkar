import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { baseline, countTests, removedExpects } from '../../scripts/check-test-integrity.mjs'

describe('check-test-integrity', () => {
  test.each([
    ["test('a', () => {})", 1],
    ["it('a', async () => {})", 1],
    ["test.skip('a', function () {})", 1],
    ["test.each([1, 2])('a %s', (n) => {})", 1],
    ["describe('group', () => { test('a', () => {}); it('b', () => {}) })", 2],
    ["test.describe('group', () => { test('a', () => {}) })", 1],
    ['test.beforeEach(() => {})', 0],
    ["// test('in a comment', () => {})\nconst s = \"test('in a string', () => {})\"", 0],
    ['expect.poll(() => 1).toBe(1)', 0],
  ])('counts the test declarations of %s', (source, count) => {
    expect(countTests(source)).toBe(count)
  })

  test('an expect line taken out or rewritten counts as removed; one added does not', () => {
    const diff = [
      'diff --git a/x.test.ts b/x.test.ts',
      '--- a/x.test.ts',
      '+++ b/x.test.ts',
      '@@ -3 +3 @@',
      '-  expect(total).toBe(5)',
      '+  expect(total).toBeTruthy()',
      '@@ -9,0 +10 @@',
      '+  expect(other).toBe(1)',
    ].join('\n')
    expect(removedExpects(diff)).toEqual(['-  expect(total).toBe(5)'])
  })

  // B4: a branch that merged `main` is compared with the merge, so a test line `main` removed and
  // the merge brought in is not the branch's; an explicit baseline still wins.
  test('the baseline is the merge base of main and HEAD, unless MENKAR_TEST_BASELINE names one', () => {
    const repo = mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', 'integrity-git-'))
    const git = (...args: string[]) =>
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], {
        cwd: repo,
        encoding: 'utf8',
      }).trim()
    const commit = (file: string) => {
      writeFileSync(join(repo, file), file)
      git('add', file)
      git('commit', '-q', '-m', file)
      return git('rev-parse', 'HEAD')
    }
    git('init', '-q', '-b', 'main')
    const fork = commit('a')
    expect(baseline({}, repo)).toBe(fork)
    git('checkout', '-q', '-b', 'branch')
    commit('b')
    git('checkout', '-q', 'main')
    commit('c')
    git('checkout', '-q', 'branch')
    expect(baseline({}, repo)).toBe(fork)
    git('merge', '-q', '--no-edit', 'main')
    const merged = git('rev-parse', 'main')
    expect(baseline({}, repo)).toBe(merged)
    expect(baseline({ MENKAR_TEST_BASELINE: 'main~1' }, repo)).toBe('main~1')
  })
})
