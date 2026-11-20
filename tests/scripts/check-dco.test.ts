import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { signedBy, unsignedCommits } from '../../scripts/check-dco.mjs'

const AUTHOR = 'Ada Example <ada@example.invalid>'

function repo() {
  const root = mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', 'repo-'))
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 'ada@example.invalid')
  git('config', 'user.name', 'Ada Example')
  let n = 0
  const commit = (message: string) => {
    n += 1
    writeFileSync(join(root, `f${n}`), `${n}\n`)
    git('add', '.')
    git('commit', '-q', '-m', message)
    return git('rev-parse', '--short', 'HEAD').trim()
  }
  commit('base')
  const base = git('rev-parse', 'HEAD').trim()
  return { root, git, commit, base }
}

describe('check-dco', () => {
  test('a sign-off counts only with the author’s email, in any case', () => {
    expect(signedBy(`Fix\n\nSigned-off-by: ${AUTHOR}\n`, 'ada@example.invalid')).toBe(true)
    expect(
      signedBy('Fix\n\nSigned-off-by: Ada <ADA@example.invalid>\n', 'ada@example.invalid'),
    ).toBe(true)
    expect(signedBy('Fix\n\nSigned-off-by: Bo <bo@example.invalid>\n', 'ada@example.invalid')).toBe(
      false,
    )
    expect(signedBy(`Fix: Signed-off-by: ${AUTHOR}`, 'ada@example.invalid')).toBe(false)
  })

  test('signed commits pass', () => {
    const { root, commit, base } = repo()
    commit(`One\n\nSigned-off-by: ${AUTHOR}`)
    commit(`Two\n\nSigned-off-by: ${AUTHOR}`)
    expect(unsignedCommits(root, base)).toEqual([])
  })

  test('an unsigned commit fails, named by hash and subject', () => {
    const { root, commit, base } = repo()
    commit(`One\n\nSigned-off-by: ${AUTHOR}`)
    const hash = commit('Two, unsigned')
    expect(unsignedCommits(root, base)).toEqual([`${hash} Two, unsigned`])
  })

  test('a sign-off with another email fails', () => {
    const { root, commit, base } = repo()
    const hash = commit('One\n\nSigned-off-by: Bo Example <bo@example.invalid>')
    expect(unsignedCommits(root, base)).toEqual([`${hash} One`])
  })

  test('an unsigned merge commit is ignored', () => {
    const { root, git, commit, base } = repo()
    git('checkout', '-q', '-b', 'side')
    commit(`Side\n\nSigned-off-by: ${AUTHOR}`)
    git('checkout', '-q', 'main')
    commit(`Main\n\nSigned-off-by: ${AUTHOR}`)
    git('merge', '-q', '--no-ff', '-m', 'Merge side', 'side')
    expect(unsignedCommits(root, base)).toEqual([])
  })

  test('an empty range passes', () => {
    const { root, base } = repo()
    expect(unsignedCommits(root, base)).toEqual([])
  })
})
