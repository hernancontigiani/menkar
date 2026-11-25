import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { r10Problems } from '../../scripts/ci.mjs'

const R10_FILE = 'tests/core/r10/claude.txt'

function repo(): { root: string; git: (...args: string[]) => string } {
  const root = mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', 'repo-'))
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 'test@example.invalid')
  git('config', 'user.name', 'test')
  write(root, R10_FILE, 'recorded\n')
  git('add', '.')
  git('commit', '-q', '-m', 'R10 recorded on main')
  return { root, git }
}

function write(root: string, path: string, content: string): void {
  mkdirSync(join(root, path, '..'), { recursive: true })
  writeFileSync(join(root, path), content)
}

describe('R10 unchanged', () => {
  test('on main with no base it is skipped, as the local gate always did', () => {
    const { root } = repo()
    expect(r10Problems(root, undefined)).toEqual({ skipped: true })
  })

  test('off main with no base, the local branch main is the reference', () => {
    const { root, git } = repo()
    git('checkout', '-q', '-b', 'feature')
    write(root, R10_FILE, 'changed\n')
    expect(r10Problems(root, undefined)).toEqual({
      ref: 'main',
      count: 1,
      problems: [`differs from main: ${R10_FILE}`],
    })
  })

  test('MENKAR_R10_BASE is the reference, and a checkout without a local main works', () => {
    const { root, git } = repo()
    const recorded = git('rev-parse', 'HEAD').trim()
    write(root, R10_FILE, 'changed\n')
    write(root, 'tests/core/r10/added.txt', 'new\n')
    git('add', '.')
    git('commit', '-q', '-m', 'R10 changed')
    git('checkout', '-q', '--detach')
    git('branch', '-q', '-D', 'main')
    expect(r10Problems(root, recorded)).toEqual({
      ref: recorded,
      count: 1,
      problems: [
        `differs from ${recorded}: ${R10_FILE}`,
        `not on ${recorded}: tests/core/r10/added.txt`,
      ],
    })
    expect(r10Problems(root, 'HEAD')).toEqual({ ref: 'HEAD', count: 2, problems: [] })
  })

  // Plan 39 §2.10: R10's Cursor rows guard P0–P2 only; P3.2 rewrites them on the branch with set's
  // sign-off, so they may differ from main's, but none may go missing.
  test("a Cursor row may differ from main's on the branch, never go missing", () => {
    const { root, git } = repo()
    write(root, 'tests/core/r10/cursor-new-team.txt', 'recorded\n')
    write(root, 'tests/core/r10/e2e/on-cursor-new.txt', 'recorded\n')
    write(root, 'tests/core/r10/e2e/on-cursor-resume.txt', 'recorded\n')
    git('add', '.')
    git('commit', '-q', '-m', 'Cursor rows recorded on main')
    git('checkout', '-q', '-b', 'multi-agent')
    write(root, 'tests/core/r10/cursor-new-team.txt', 'rewritten by P3.2\n')
    write(root, 'tests/core/r10/e2e/on-cursor-new.txt', 'rewritten by P3.2\n')
    git('rm', '-q', 'tests/core/r10/e2e/on-cursor-resume.txt')
    expect(r10Problems(root, undefined)).toEqual({
      ref: 'main',
      count: 4,
      problems: ['missing: tests/core/r10/e2e/on-cursor-resume.txt'],
    })
  })
})
