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
    ['CLAUDE.md', 'docs/history/root/CLAUDE.md'],
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
      'CLAUDE.md': '# Rules\n\n- keep this\n- drop this\n',
      'docs/history/root/CLAUDE.md': '# History\n',
    })
    write(root, { 'CLAUDE.md': '# Rules\n\n- keep this\n' })
    expect(check(root, 'CLAUDE.md')).toEqual([
      'CLAUDE.md:4: not in docs/history/root/CLAUDE.md: - drop this',
    ])
    write(root, {
      'docs/history/root/CLAUDE.md': '# History\n\n> Left on 2026-11-08.\n- drop this\n',
    })
    expect(check(root, 'CLAUDE.md')).toEqual([])
  })

  test('the history only grows', () => {
    const root = repo({
      'CLAUDE.md': '# Rules\n',
      'docs/history/root/CLAUDE.md': '# History\n- old\n',
    })
    write(root, { 'docs/history/root/CLAUDE.md': '# History\n' })
    expect(check(root, 'CLAUDE.md')).toEqual([
      'docs/history/root/CLAUDE.md:2: the mirror lost a line: - old',
    ])
  })

  test('every tracked decision document is checked, including one deleted from the working tree', () => {
    const root = repo({
      'CLAUDE.md': 'a\n',
      'docs/toolchain.md': 'b\n',
      'plans/00-STATUS.md': 'c\n',
      'plans/01-x.md': 'd\n',
      'README.md': 'e\n',
    })
    rmSync(join(root, 'docs/toolchain.md'))
    expect(mirroredDocuments(root)).toEqual([
      'CLAUDE.md',
      'docs/toolchain.md',
      'plans/00-STATUS.md',
    ])
  })
})
