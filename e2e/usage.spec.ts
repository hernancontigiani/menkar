import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { expect, test } from '@playwright/test'
import { launchApp } from './app'

function turnsIn(path: string): string[] {
  try {
    const db = new DatabaseSync(path, { readOnly: true })
    try {
      return db
        .prepare('SELECT uuid FROM turns')
        .all()
        .map((row) => String(row.uuid))
    } finally {
      db.close()
    }
  } catch {
    return [] // not written yet
  }
}

test('on start the app reads the transcripts into the usage history, off its main thread', async () => {
  const launched = await launchApp({
    prepare: ({ home }) => {
      const dir = join(home, '.claude', 'projects', '-home-demo-app')
      mkdirSync(dir, { recursive: true })
      const lines = [
        { type: 'user', uuid: 'turn-1', timestamp: '2026-11-08T13:00:00Z', turnOrigin: 'human' },
        {
          type: 'assistant',
          timestamp: '2026-11-08T13:00:30Z',
          requestId: 'req_1',
          message: { id: 'msg_1', model: 'claude-opus-5-5', usage: { output_tokens: 7 } },
        },
      ]
      writeFileSync(
        join(dir, 'session-1.jsonl'),
        `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`,
      )
      return undefined
    },
  })
  try {
    const history = join(launched.root, 'data', 'menkar', 'history.sqlite')
    await expect.poll(() => turnsIn(history)).toEqual(['turn-1'])
    await expect(launched.window).toHaveTitle('Menkar')
  } finally {
    await launched.close()
  }
})
