import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { launchApp } from './app'

// Every agent and terminal the app looks for on the PATH; a real one there would change what a
// test sees with nothing in the test saying so.
const LOOKED_FOR = ['claude', 'cursor-agent', 'codex', 'opencode', 'agy', 'gemini', 'ghostty']

test('the launched app finds no agent of the machine: its PATH holds no executable the test did not put there', async () => {
  const launched = await launchApp()
  try {
    const path = await launched.app.evaluate(() => process.env.PATH ?? '')
    const found = path
      .split(':')
      .flatMap((dir) => LOOKED_FOR.map((name) => join(dir, name)))
      .filter((file) => existsSync(file))
    expect(found).toEqual([])
  } finally {
    await launched.close()
  }
})

test('a test that hands the app the inherited PATH is refused before the app starts', async () => {
  await expect(
    launchApp({
      prepare: ({ root }) => ({ PATH: `${join(root, 'bin')}:${process.env.PATH ?? ''}` }),
    }),
  ).rejects.toThrow("e2e PATH reaches the machine's own folders")
})
