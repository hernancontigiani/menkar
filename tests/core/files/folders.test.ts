import { describe, expect, test } from 'vitest'
import {
  clashFree,
  insideFolder,
  safeFolderName,
  uniqueFolderName,
} from '../../../src/core/files/folders'

describe("a project's folder name, safe on every platform", () => {
  test.each([
    ['Guardian AI', 'Guardian AI'],
    ['a/b:c?', 'a-b-c-'],
    ['x<y>"z|w\\v*', 'x-y--z-w-v-'],
    ['tab\there', 'tab-here'],
    ['con', 'con_'],
    ['Nul.txt', 'Nul.txt_'],
    ['COM1', 'COM1_'],
    ['name. ', 'name'],
    ['', '_'],
    ['...', '_'],
  ])('%j → %j', (name, safe) => {
    expect(safeFolderName(name)).toBe(safe)
  })

  test('a name another project already took, in any case, gets (2), then (3)', () => {
    expect(uniqueFolderName('api', ['API'])).toBe('api (2)')
    expect(uniqueFolderName('api', ['API', 'api (2)'])).toBe('api (3)')
    expect(uniqueFolderName('web', ['API'])).toBe('web')
  })
})

describe('a file moved in, or moved back', () => {
  test('a name already there gets (2) before the extension, then (3)', () => {
    expect(clashFree('a.pdf', (n) => n === 'a.pdf')).toBe('a (2).pdf')
    expect(clashFree('a.pdf', (n) => n === 'a.pdf' || n === 'a (2).pdf')).toBe('a (3).pdf')
    expect(clashFree('notes', (n) => n === 'notes')).toBe('notes (2)')
    expect(clashFree('a.tar.gz', (n) => n === 'a.tar.gz')).toBe('a.tar (2).gz')
    expect(clashFree('free.pdf', () => false)).toBe('free.pdf')
  })
})

describe('the drag guard: only a file of the folder itself', () => {
  test.each(['../x', '/etc/passwd', 'C:\\Windows\\x', '.env', 'sub/a.pdf', 'sub\\a.pdf', '', '..'])(
    '%j is refused',
    (name) => {
      expect(insideFolder('/h/Menkar/P/files', name)).toBeNull()
    },
  )

  test('a plain name resolves inside the folder', () => {
    expect(insideFolder('/h/Menkar/P/files', 'report (2).pdf')).toBe(
      '/h/Menkar/P/files/report (2).pdf',
    )
  })
})
