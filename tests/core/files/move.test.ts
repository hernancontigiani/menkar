// A file brought into a project's folder, or moved back on Undo, never replaces one already at
// its target, even when that file appeared after the free name was chosen.
import { copyFile, type link, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { moveExclusive } from '../../../src/core/files/move'

let dir = ''
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'menkar-move-'))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

const crossDevice = {
  link: (async () => {
    throw Object.assign(new Error('cross-device'), { code: 'EXDEV' })
  }) as unknown as typeof link,
  copyFile,
  unlink,
}

describe('moving a file without replacing one', () => {
  test('a free target: the file is moved', async () => {
    await writeFile(join(dir, 'a'), 'mine')
    await moveExclusive(join(dir, 'a'), join(dir, 'b'))
    expect(await readFile(join(dir, 'b'), 'utf8')).toBe('mine')
    await expect(readFile(join(dir, 'a'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  test.each([
    ['on the same file system', undefined],
    ['across file systems (the copy path)', crossDevice],
  ])('%s, a target that appeared meanwhile is kept and the source stays', async (_, ops) => {
    await writeFile(join(dir, 'a'), 'mine')
    await writeFile(join(dir, 'b'), 'already there')
    await expect(moveExclusive(join(dir, 'a'), join(dir, 'b'), ops)).rejects.toMatchObject({
      code: 'EEXIST',
    })
    expect(await readFile(join(dir, 'b'), 'utf8')).toBe('already there')
    expect(await readFile(join(dir, 'a'), 'utf8')).toBe('mine')
  })

  test('across file systems, a free target: copied, then the source removed', async () => {
    await writeFile(join(dir, 'a'), 'mine')
    await moveExclusive(join(dir, 'a'), join(dir, 'b'), crossDevice)
    expect(await readFile(join(dir, 'b'), 'utf8')).toBe('mine')
    await expect(readFile(join(dir, 'a'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
