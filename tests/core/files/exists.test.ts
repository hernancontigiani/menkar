// A path printed in a terminal is a link only when it is on disk (decision 1.64).
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { terminalOpensIn, terminalPathExists } from '../../../src/core/files/exists'

test('a file or folder on disk is found, ~/ under the home folder; a missing one is not', async () => {
  const home = mkdtempSync(join(tmpdir(), 'menkar-exists-'))
  mkdirSync(join(home, 'vis'))
  writeFileSync(join(home, 'vis', 'pick-1-default.png'), '')
  const file = join(home, 'vis', 'pick-1-default.png')
  expect(await terminalPathExists(file, '/nowhere')).toBe(file)
  expect(await terminalPathExists('~/vis/pick-1-default.png', home)).toBe(file)
  expect(await terminalPathExists('~/vis', home)).toBe(join(home, 'vis'))
  expect(await terminalPathExists(join(home, 'vis', 'missing.png'), home)).toBeNull()
  expect(await terminalPathExists(`${file}/below`, home)).toBeNull()
  expect(await terminalPathExists('vis', home)).toBeNull()
})

// Decision 1.192: what the editor opens goes to a file tab, the rest to the system's app.
test('Ctrl+click opens text and Markdown in a tab; a folder, a PDF, an image or a missing file in the system app; Shift always there', async () => {
  const home = mkdtempSync(join(tmpdir(), 'menkar-opens-in-'))
  const at = (name: string) => join(home, name)
  writeFileSync(at('notes.txt'), 'plain text\n')
  writeFileSync(at('README.md'), '# Title\n\nBody.\n')
  mkdirSync(at('folder'))
  // A PDF's binary marker line and an image's header: neither is text the editor shows.
  writeFileSync(at('report.pdf'), Buffer.from('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n', 'latin1'))
  writeFileSync(
    at('pick.png'),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]),
  )
  expect(await terminalOpensIn(at('notes.txt'), home, false)).toBe('tab')
  expect(await terminalOpensIn(at('README.md'), home, false)).toBe('tab')
  expect(await terminalOpensIn(at('folder'), home, false)).toBe('system')
  expect(await terminalOpensIn(at('report.pdf'), home, false)).toBe('system')
  expect(await terminalOpensIn(at('pick.png'), home, false)).toBe('system')
  expect(await terminalOpensIn(at('missing.md'), home, false)).toBe('system')
  // A missing file is no link at all: it never gets as far as the choice.
  expect(await terminalPathExists(at('missing.md'), home)).toBeNull()
  for (const name of ['notes.txt', 'README.md', 'folder', 'report.pdf', 'pick.png'])
    expect(await terminalOpensIn(at(name), home, true)).toBe('system')
})
