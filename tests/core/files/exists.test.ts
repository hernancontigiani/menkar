// A path printed in a terminal is a link only when it is on disk (decision 1.64).
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { terminalPathExists } from '../../../src/core/files/exists'

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
