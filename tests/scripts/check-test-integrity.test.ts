import { describe, expect, test } from 'vitest'
import { countTests, removedExpects } from '../../scripts/check-test-integrity.mjs'

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
})
