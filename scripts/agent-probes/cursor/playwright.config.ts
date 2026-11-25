// The Cursor probes run only by hand (README.md), never by `npm run ui-check`, whose testDir is
// e2e/.
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: /\.spec\.ts$/,
  timeout: 900_000,
  workers: 1,
  reporter: 'list',
  // Outside the tree: a failure's traces stay readable without dirtying the work tree.
  outputDir: join(tmpdir(), 'menkar-probe-cursor-results'),
})
