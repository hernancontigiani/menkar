// OpenCode's sessions in the built app: its catalog reads opencode.db on a worker thread whose file
// is built beside main's entry, whichever chunk the catalog itself lands in. The database is the
// one a killed OpenCode leaves (both sidecars), so the read goes through the copy in Menkar's cache
// and leaves OpenCode's files as they were.
import { cpSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { launchApp } from './app'
import { prepare } from './fixtures'
import { opencodeStandIn } from './standins/opencode'

const KILLED = join(
  import.meta.dirname,
  '..',
  'tests',
  'data',
  'agents',
  'opencode',
  'killed',
  '.local',
  'share',
  'opencode',
)

const files = (dir: string) =>
  readdirSync(dir)
    .sort()
    .map((name) => ({
      name,
      mtime: statSync(join(dir, name)).mtimeMs,
      bytes: readFileSync(join(dir, name)).toString('base64'),
    }))

interface Listed {
  agent: string
  id: string
  name: string
}

test("OpenCode's sessions are listed from its database, read on the built worker, and its files stay as they were", async () => {
  let data = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      const env = prepare(dirs)
      opencodeStandIn(join(dirs.root, 'bin'))
      data = join(dirs.root, 'data', 'opencode')
      cpSync(KILLED, data, { recursive: true, preserveTimestamps: true })
      return env
    },
  })
  try {
    const before = files(data)
    const page = launched.window
    const listed = async () =>
      (
        (await page.evaluate(() =>
          (
            globalThis as unknown as { menkar: { sessions: { list(): Promise<unknown> } } }
          ).menkar.sessions.list(),
        )) as Listed[]
      )
        .filter((s) => s.agent === 'opencode')
        .map((s) => s.name)
        .sort()
    await expect
      .poll(listed, { timeout: 15_000 })
      .toEqual(['Rename the cart module', 'checkout-fix, with tests', 'payment refactor'])
    expect(files(data)).toEqual(before)
  } finally {
    await launched.close()
  }
})
