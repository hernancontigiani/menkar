import { chmod, mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { beforeEach, describe, expect, test } from 'vitest'
import { checkFile, checkTyped, expandInput, isClaudeData } from '../../../src/core/files/check'

let home = ''
beforeEach(async () => {
  home = await mkdtemp(join(process.env.MENKAR_TEST_ROOT ?? '', 'files-'))
})

describe('the typed path', () => {
  test('FIL-2 a relative path is refused', () => {
    expect(expandInput('notes.md', home)).toEqual({ refusal: 'files.needFullPath' })
    expect(expandInput('   ', home)).toEqual({ refusal: 'files.needFullPath' })
  })

  test('FIL-3 ~ and ~/ are the home folder; ~bob is not expanded', () => {
    expect(expandInput(' ~/notes.md ', home)).toEqual({ path: join(home, 'notes.md') })
    expect(expandInput('~', home)).toEqual({ path: home })
    expect(expandInput('~bob/x', home)).toEqual({ refusal: 'files.needFullPath' })
    expect(expandInput('/etc/hosts', home)).toEqual({ path: '/etc/hosts' })
  })

  test('FIL-4 a folder, and a missing path, are refused with their own sentence', async () => {
    await mkdir(join(home, 'dir'))
    expect(await checkTyped(join(home, 'dir'))).toBe('files.isFolder')
    expect(await checkTyped(join(home, 'nope.md'))).toBe('files.missing')
  })
})

describe('the file check', () => {
  test('FIL-5 too large, binary, not UTF-8, unreadable', async () => {
    const big = join(home, 'big.txt')
    await writeFile(big, Buffer.alloc(12 * 1024 * 1024, 0x61))
    const nul = Buffer.from('a'.repeat(200))
    nul[100] = 0
    await writeFile(join(home, 'bin.dat'), nul)
    await writeFile(join(home, 'latin.txt'), Buffer.from([0x63, 0x61, 0x66, 0xe9]))
    await writeFile(join(home, 'secret.txt'), 'x')
    await chmod(join(home, 'secret.txt'), 0o000)
    expect(await checkFile(big, home)).toEqual({ refusal: 'files.tooLarge' })
    expect(await checkFile(join(home, 'bin.dat'), home)).toEqual({ refusal: 'files.binary' })
    expect(await checkFile(join(home, 'latin.txt'), home)).toEqual({ refusal: 'files.notUtf8' })
    expect(await checkFile(join(home, 'secret.txt'), home)).toEqual({ refusal: 'files.unreadable' })
    expect(await checkFile(home, home)).toEqual({ refusal: 'files.notFile' })
  })

  test('FIL-6 a NUL only after the first 8 KiB opens', async () => {
    const data = Buffer.from('a'.repeat(9 * 1024))
    data[8 * 1024 + 10] = 0
    await writeFile(join(home, 'late.txt'), data)
    expect(await checkFile(join(home, 'late.txt'), home)).toMatchObject({ readOnly: null })
  })

  test('FIL-10 a link and its target are one file: the resolved path', async () => {
    await writeFile(join(home, 'real.md'), '# hi')
    await symlink(join(home, 'real.md'), join(home, 'link.md'))
    expect(await checkFile(join(home, 'link.md'), home)).toMatchObject({
      path: join(home, 'real.md'),
      text: '# hi',
    })
  })

  test('FIL-12 the agents’ data is read only, also through a link', async () => {
    await mkdir(join(home, '.claude'), { recursive: true })
    await writeFile(join(home, '.claude', 'settings.json'), '{}')
    await writeFile(join(home, '.claude.json'), '{}')
    await symlink(join(home, '.claude', 'settings.json'), join(home, 'cfg.json'))
    for (const path of [
      join(home, '.claude', 'settings.json'),
      join(home, '.claude.json'),
      join(home, 'cfg.json'),
    ]) {
      expect(await checkFile(path, home)).toMatchObject({ readOnly: 'files.readOnlyClaude' })
    }
    expect(await isClaudeData(join(home, 'other.json'), home)).toBe(false)
  })

  test('FIL-12 a ~/.claude reached through a dotfile manager’s link counts as the agents’ data', async () => {
    const dotfiles = join(home, 'dotfiles', 'claude')
    await mkdir(dotfiles, { recursive: true })
    await writeFile(join(dotfiles, 'settings.json'), '{}')
    await symlink(dotfiles, join(home, '.claude'))
    expect(await checkFile(join(dotfiles, 'settings.json'), home)).toMatchObject({
      readOnly: 'files.readOnlyClaude',
    })
  })

  test('FIL-13 a file the user cannot write opens read only', async () => {
    await writeFile(join(home, 'ro.txt'), 'x')
    await chmod(join(home, 'ro.txt'), 0o444)
    expect(await checkFile(join(home, 'ro.txt'), home)).toMatchObject({
      readOnly: 'files.readOnlyPermission',
    })
  })
})
