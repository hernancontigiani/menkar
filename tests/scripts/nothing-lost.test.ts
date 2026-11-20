import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { check, mirroredDocuments, mirrorOf, removedLines } from '../../scripts/nothing-lost.mjs'

function repo(files: Record<string, string>): string {
  const root = mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', 'repo-'))
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
  git('init', '-q')
  git('config', 'user.email', 'test@example.invalid')
  git('config', 'user.name', 'test')
  write(root, files)
  git('add', '.')
  git('commit', '-q', '-m', 'base')
  return root
}

function write(root: string, files: Record<string, string>): void {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true })
    writeFileSync(join(root, path), content)
  }
}

describe('nothing-lost', () => {
  test.each([
    ['AGENTS.md', 'docs/history/root/AGENTS.history.md'],
    ['CLAUDE.md', null],
    ['plans/00-STATUS.md', 'docs/history/plans/00-STATUS.md'],
    ['docs/spec/sessions.md', 'docs/history/spec/sessions.md'],
    ['docs/history/README.md', null],
    ['plans/01-scaffold.md', null],
    ['README.md', null],
  ])('%s is mirrored at %s', (path, mirror) => {
    expect(mirrorOf(path)).toBe(mirror)
  })

  test('blank lines, rules, table separators and fences are not content', () => {
    const diff = ['@@ -4,4 +3,0 @@', '-', '-|---|---|', '-```ts', '-a rule'].join('\n')
    expect(removedLines(diff)).toEqual([[7, 'a rule']])
  })

  test('a line that left a document without reaching its history is lost; once there, it is not', () => {
    const root = repo({
      'AGENTS.md': '# Rules\n\n- keep this\n- drop this\n',
      'docs/history/root/AGENTS.history.md': '# History\n',
    })
    write(root, { 'AGENTS.md': '# Rules\n\n- keep this\n' })
    expect(check(root, 'AGENTS.md')).toEqual([
      'AGENTS.md:4: not in docs/history/root/AGENTS.history.md: - drop this',
    ])
    write(root, {
      'docs/history/root/AGENTS.history.md': '# History\n\n> Left on 2026-11-08.\n- drop this\n',
    })
    expect(check(root, 'AGENTS.md')).toEqual([])
  })

  test('on a clean checkout of a commit that dropped a line, only MENKAR_HISTORY_BASE sees the loss', () => {
    const root = repo({
      'AGENTS.md': '# Rules\n\n- keep this\n- drop this\n',
      'docs/history/root/AGENTS.history.md': '# History\n',
    })
    const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
    const base = git('rev-parse', 'HEAD').trim()
    write(root, { 'AGENTS.md': '# Rules\n\n- keep this\n' })
    git('commit', '-q', '-am', 'drop a rule')
    expect(check(root, 'AGENTS.md')).toEqual([])
    expect(check(root, 'AGENTS.md', base)).toEqual([
      'AGENTS.md:4: not in docs/history/root/AGENTS.history.md: - drop this',
    ])
    write(root, {
      'docs/history/root/AGENTS.history.md': '# History\n\n> Left on 2026-11-20.\n- drop this\n',
    })
    git('commit', '-q', '-am', 'its history')
    expect(check(root, 'AGENTS.md', base)).toEqual([])
  })

  test('the history only grows', () => {
    const root = repo({
      'AGENTS.md': '# Rules\n',
      'docs/history/root/AGENTS.history.md': '# History\n- old\n',
    })
    write(root, { 'docs/history/root/AGENTS.history.md': '# History\n' })
    expect(check(root, 'AGENTS.md')).toEqual([
      'docs/history/root/AGENTS.history.md:2: the mirror lost a line: - old',
    ])
  })

  describe('the rules file moved from CLAUDE.md to AGENTS.md', () => {
    const before = {
      'CLAUDE.md': '# CLAUDE.md\n\n- keep this\n- drop this\n',
      'docs/history/root/CLAUDE.history.md': '# History\n- old\n',
    }
    function moved(root: string, history: string): void {
      write(root, {
        'CLAUDE.md': '@AGENTS.md\n',
        'AGENTS.md': '# AGENTS.md\n\n- keep this\n',
        'docs/history/root/AGENTS.history.md': history,
      })
      rmSync(join(root, 'docs/history/root/CLAUDE.history.md'), { force: true })
    }

    test('moving the text is not losing it: only what left both files counts', () => {
      const root = repo(before)
      moved(root, '# History\n- old\n')
      expect(check(root, 'AGENTS.md')).toEqual([
        'AGENTS.md:1: not in docs/history/root/AGENTS.history.md: # CLAUDE.md',
        'AGENTS.md:4: not in docs/history/root/AGENTS.history.md: - drop this',
      ])
      moved(root, '# History\n- old\n# CLAUDE.md\n- drop this\n')
      expect(check(root, 'AGENTS.md')).toEqual([])
    })

    test('the moved history still only grows', () => {
      const root = repo(before)
      moved(root, '# History\n# CLAUDE.md\n- drop this\n')
      expect(check(root, 'AGENTS.md')).toEqual([
        'docs/history/root/AGENTS.history.md:2: the mirror lost a line: - old',
      ])
    })

    test('the new document is checked before it is staged', () => {
      const root = repo(before)
      moved(root, '# History\n- old\n')
      expect(mirroredDocuments(root)).toEqual(['AGENTS.md'])
    })

    test('once AGENTS.md is in HEAD, CLAUDE.md is no longer its past', () => {
      const root = repo({ ...before, 'AGENTS.md': '# AGENTS.md\n\n- keep this\n- drop this\n' })
      write(root, { 'AGENTS.md': '# AGENTS.md\n\n- keep this\n- drop this\n- added\n' })
      expect(check(root, 'AGENTS.md')).toEqual([])
      write(root, { 'AGENTS.md': '# AGENTS.md\n' })
      expect(check(root, 'AGENTS.md')).toEqual([
        'AGENTS.md:3: not in docs/history/root/AGENTS.history.md: - keep this',
        'AGENTS.md:4: not in docs/history/root/AGENTS.history.md: - drop this',
      ])
    })
  })

  test('every tracked decision document is checked, including one deleted from the working tree', () => {
    const root = repo({
      'AGENTS.md': 'a\n',
      'docs/toolchain.md': 'b\n',
      'plans/00-STATUS.md': 'c\n',
      'plans/01-x.md': 'd\n',
      'README.md': 'e\n',
    })
    rmSync(join(root, 'docs/toolchain.md'))
    expect(mirroredDocuments(root)).toEqual([
      'AGENTS.md',
      'docs/toolchain.md',
      'plans/00-STATUS.md',
    ])
  })
})
