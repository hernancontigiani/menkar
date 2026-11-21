// What a session of an agent that records its block held when it last ran, kept per session in
// the cache so a resume starts from it.
import { existsSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { controlPaths, writeTextAtomic } from '../../../src/core/control/files'
import type { TeamText } from '../../../src/core/team/posts'
import { forgetRecorded, readRecorded, writeRecorded } from '../../../src/core/team/recorded'

const A: TeamText = { facts: '# Your team in Menkar\nYou are `w`.', block: '# Your team…\n\nx\n' }
const id = (n: number) => `019a3f1e-7c2d-7b40-9e11-00000000000${n}`

describe('the recorded block', () => {
  test('what was written is read back, and a session that held nothing reads as nothing', async () => {
    await writeRecorded(id(1), A)
    expect(await readRecorded(id(1))).toEqual(A)
    await writeRecorded(id(1), null)
    expect(await readRecorded(id(1))).toBeNull()
    expect(existsSync(join(controlPaths().teamHeld, `${id(1)}.json`))).toBe(true)
  })

  test('a later write replaces the earlier one whole', async () => {
    const B = { facts: 'B', block: 'B\n' }
    await writeRecorded(id(2), A)
    await writeRecorded(id(2), B)
    expect(
      JSON.parse(readFileSync(join(controlPaths().teamHeld, `${id(2)}.json`), 'utf8')),
    ).toEqual(B)
  })

  test('nothing recorded, or a file that is not one, reads as nothing', async () => {
    expect(await readRecorded(id(3))).toBeNull()
    for (const text of ['{', '{"facts":1,"block":"x"}', '[]', '"x"']) {
      await writeTextAtomic(controlPaths().teamHeld, `${id(4)}.json`, text)
      expect(await readRecorded(id(4)), text).toBeNull()
    }
  })

  test('an id that is not a plain name writes and reads nothing outside the folder', async () => {
    await writeRecorded('../escape', A)
    expect(existsSync(join(controlPaths().root, 'escape.json'))).toBe(false)
    await writeFile(join(controlPaths().root, 'escape.json'), JSON.stringify(A))
    expect(await readRecorded('../escape')).toBeNull()
  })

  test('a session removed is forgotten, and forgetting one never recorded is no error', async () => {
    await writeRecorded(id(5), A)
    await forgetRecorded(id(5))
    expect(await readRecorded(id(5))).toBeNull()
    await expect(forgetRecorded(id(6))).resolves.toBeUndefined()
  })
})
