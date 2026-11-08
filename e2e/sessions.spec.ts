import { appendFileSync, chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import type { MenkarApi, SessionInfo } from '../src/shared/ipc'
import { launchApp } from './app'

const A = '1b4e28ba-2fa1-11d2-883f-0016d3cca427'
const B = '9c2d5f10-3e4b-4c5d-8e6f-7a8b9c0d1e2f'
const line = (value: object) => `${JSON.stringify(value)}\n`

// The page's globals, as the preload exposes them and as this test stores what it receives.
type PageGlobals = { menkar: MenkarApi; changed?: string[] }

test('the renderer receives the sessions of a temporary HOME, and an update when one grows', async () => {
  let transcriptA = ''
  const launched = await launchApp({
    prepare: ({ root, home }) => {
      const bin = join(root, 'bin')
      mkdirSync(bin)
      writeFileSync(join(bin, 'claude'), '#!/bin/sh\nexit 0\n')
      chmodSync(join(bin, 'claude'), 0o755)
      const folder = join(home, '.claude', 'projects', '-tmp-demo')
      mkdirSync(folder, { recursive: true })
      transcriptA = join(folder, `${A}.jsonl`)
      writeFileSync(
        transcriptA,
        line({ type: 'user', cwd: '/tmp/demo', message: { content: 'first one' } }),
      )
      writeFileSync(
        join(folder, `${B}.jsonl`),
        line({ type: 'user', cwd: '/tmp/demo', message: { content: 'second one' } }),
      )
      return { PATH: `${bin}:${process.env.PATH ?? ''}` }
    },
  })
  const page = launched.window
  try {
    const names = async () => {
      const list: readonly SessionInfo[] = await page.evaluate(() =>
        (globalThis as unknown as PageGlobals).menkar.sessions.list(),
      )
      return list.map((s) => s.name).sort()
    }
    await expect.poll(names).toEqual(['first one', 'second one'])

    await page.evaluate(() => {
      const store = globalThis as unknown as PageGlobals
      store.menkar.sessions.onChanged((list) => {
        store.changed = list.map((s) => s.name).sort()
      })
    })
    appendFileSync(transcriptA, line({ type: 'custom-title', customTitle: 'Renamed by Claude' }))
    await expect
      .poll(() => page.evaluate(() => (globalThis as unknown as PageGlobals).changed), {
        timeout: 10_000,
      })
      .toEqual(['Renamed by Claude', 'second one'])
  } finally {
    await launched.close()
  }
})
