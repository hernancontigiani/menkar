import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { outcomeBefore, trashAnswer, trashCheck, trashPath } from '../../../src/core/control/trash'

const FOLDER = join('/home', 'someone', 'Menkar', 'Client work', 'files')

describe('trash_files', () => {
  it('is refused with the mode off and to a session that is not the orchestrator', () => {
    expect(trashCheck(null, 'orch', ['a.png'])).toEqual({
      ok: false,
      text: 'The orchestration mode is off in this project.',
    })
    expect(trashCheck('orch', 'worker', ['a.png'])).toMatchObject({ ok: false })
  })

  it('takes a non-empty list of names, each once', () => {
    expect(trashCheck('orch', 'orch', [])).toMatchObject({ ok: false })
    expect(trashCheck('orch', 'orch', 'a.png')).toMatchObject({ ok: false })
    expect(trashCheck('orch', 'orch', ['a.png', 3])).toMatchObject({ ok: false })
    expect(trashCheck('orch', 'orch', ['a.png', 'b.md', 'a.png'])).toEqual({
      ok: true,
      names: ['a.png', 'b.md'],
    })
  })

  it('accepts only a plain file name of the folder itself', () => {
    expect(trashPath(FOLDER, 'menkar-t9-shot.png')).toBe(join(FOLDER, 'menkar-t9-shot.png'))
    for (const name of [
      '../x',
      '..',
      '.',
      '',
      'sub/a.png',
      '/etc/passwd',
      'a\\b',
      '.hidden',
      'C:x',
    ])
      expect(trashPath(FOLDER, name)).toBe(null)
  })

  it('a name outside, missing, or a folder or a link is not trashed', () => {
    expect(outcomeBefore(null, 'file')).toBe('outside')
    expect(outcomeBefore('/f/a', 'missing')).toBe('missing')
    expect(outcomeBefore('/f/a', 'other')).toBe('not-a-file')
    expect(outcomeBefore('/f/a', 'file')).toBe(null)
  })

  it('answers which were trashed and which were not, and why', () => {
    expect(
      trashAnswer([
        { name: 'a.png', outcome: 'trashed' },
        { name: 'b.md', outcome: 'trashed' },
      ]),
    ).toEqual({ ok: true, text: 'Trashed: a.png, b.md.' })
    expect(
      trashAnswer([
        { name: 'a.png', outcome: 'trashed' },
        { name: '../x', outcome: 'outside' },
        { name: 'gone.txt', outcome: 'missing' },
        { name: 'link', outcome: 'not-a-file' },
        { name: 'busy.txt', outcome: 'failed' },
      ]),
    ).toEqual({
      ok: false,
      text: "Trashed: a.png. Not trashed: ../x (not a file of this project's files folder), gone.txt (no such file), link (a folder or a link, not a file), busy.txt (the system refused to trash it).",
    })
    expect(trashAnswer([{ name: '../x', outcome: 'outside' }]).text).toBe(
      "Nothing was trashed. Not trashed: ../x (not a file of this project's files folder).",
    )
  })
})
