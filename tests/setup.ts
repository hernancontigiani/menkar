import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll } from 'vitest'

// Every test resolves the app's directories under a fresh temporary HOME, so a test that forgets
// to set up its own reads an empty directory instead of the developer's files.
const root = mkdtempSync(join(tmpdir(), 'menkar-test-'))
process.env.MENKAR_TEST_ROOT = root
process.env.HOME = join(root, 'home')
process.env.XDG_CONFIG_HOME = join(root, 'config')
process.env.XDG_CACHE_HOME = join(root, 'cache')
process.env.XDG_DATA_HOME = join(root, 'data')

afterAll(() => {
  rmSync(root, { recursive: true, force: true })
})
