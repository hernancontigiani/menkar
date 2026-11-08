import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { expect, test } from '@playwright/test'
import { launchApp } from './app'

// The real `claude` is never run: the stand-in in tests/data/classifier answers from a reply file.
const FAKE_DIR = resolve('tests/data/classifier')

function categories(path: string): Record<string, unknown> {
  try {
    const db = new DatabaseSync(path, { readOnly: true })
    try {
      return Object.fromEntries(
        db
          .prepare('SELECT uuid, category FROM turns')
          .all()
          .map((r) => [String(r.uuid), r.category]),
      )
    } finally {
      db.close()
    }
  } catch {
    return {} // not written yet
  }
}

test('with the switch on, the start-up usage pass is followed by a classification in the background', async () => {
  let root = ''
  const launched = await launchApp({
    prepare: ({ root: base, home }) => {
      root = base
      const projects = join(home, '.claude', 'projects', '-home-demo-app')
      mkdirSync(projects, { recursive: true })
      const lines = [
        {
          type: 'user',
          uuid: 'turn-1',
          timestamp: '2026-11-08T13:00:00Z',
          turnOrigin: 'human',
          message: { content: 'Add a retry to the upload worker, please' },
        },
        {
          type: 'user',
          uuid: 'turn-2',
          timestamp: '2026-11-08T13:30:00Z',
          turnOrigin: 'human',
          message: { content: 'next' },
        },
      ]
      writeFileSync(
        join(projects, 'session-1.jsonl'),
        `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`,
      )
      const config = join(base, 'config', 'menkar')
      mkdirSync(config, { recursive: true })
      writeFileSync(join(config, 'state.json'), JSON.stringify({ settings: { classify_since: 1 } }))
      const fakeLog = join(base, 'fake-log')
      const replies = join(base, 'fake-replies')
      mkdirSync(fakeLog)
      mkdirSync(replies)
      writeFileSync(
        join(replies, '1.json'),
        JSON.stringify({ result: '[{"id":0,"category":"build"}]' }),
      )
      return {
        PATH: `${FAKE_DIR}:${process.env.PATH ?? ''}`,
        FAKE_CLAUDE_LOG: fakeLog,
        FAKE_CLAUDE_REPLIES: replies,
      }
    },
  })
  try {
    const history = join(root, 'data', 'menkar', 'history.sqlite')
    await expect.poll(() => categories(history)).toEqual({ 'turn-1': 'build', 'turn-2': null })
    const state = join(root, 'config', 'menkar', 'state.json')
    await expect
      .poll(() => JSON.parse(readFileSync(state, 'utf8')).settings?.classify_last)
      .toMatchObject({ classified: 1, failed: false })
  } finally {
    await launched.close()
  }
})

test('the earlier-turns estimate and run answer through the preload, with the switch off', async () => {
  let root = ''
  const launched = await launchApp({
    prepare: ({ root: base, home }) => {
      root = base
      const projects = join(home, '.claude', 'projects', '-home-demo-app')
      mkdirSync(projects, { recursive: true })
      const lines = [0, 1, 2].map((i) => ({
        type: 'user',
        uuid: `old-${i}`,
        timestamp: `2026-10-0${i + 1}T13:00:00Z`,
        message: { content: `an old prompt from before turnOrigin, number ${i}` },
      }))
      writeFileSync(
        join(projects, 'session-old.jsonl'),
        `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`,
      )
      const fakeLog = join(base, 'fake-log')
      const replies = join(base, 'fake-replies')
      mkdirSync(fakeLog)
      mkdirSync(replies)
      const answers = [0, 1, 2].map((id) => ({ id, category: 'design' }))
      writeFileSync(join(replies, '1.json'), JSON.stringify({ result: JSON.stringify(answers) }))
      return {
        PATH: `${FAKE_DIR}:${process.env.PATH ?? ''}`,
        FAKE_CLAUDE_LOG: fakeLog,
        FAKE_CLAUDE_REPLIES: replies,
      }
    },
  })
  try {
    const history = join(root, 'data', 'menkar', 'history.sqlite')
    await expect.poll(() => Object.keys(categories(history)).length).toBe(3)
    const estimate = await launched.window.evaluate(() =>
      (
        window as unknown as { menkar: { classifier: { estimate(day: string): Promise<unknown> } } }
      ).menkar.classifier.estimate('2026-09-01'),
    )
    expect(estimate).toEqual({
      turns: 3,
      lines: [
        'Turns to send: 3',
        'Estimated use of your plan: under US$0.01',
        'Estimated time: under a minute, in the background',
      ],
    })
    await launched.window.evaluate(() =>
      (
        window as unknown as {
          menkar: { classifier: { classifyEarlier(day: string): Promise<void> } }
        }
      ).menkar.classifier.classifyEarlier('2026-09-01'),
    )
    await expect
      .poll(() => categories(history))
      .toEqual({ 'old-0': 'design', 'old-1': 'design', 'old-2': 'design' })
    await expect
      .poll(() =>
        launched.window.evaluate(() =>
          (
            window as unknown as {
              menkar: {
                classifier: { status(): Promise<{ status: string; progress: string | null }> }
              }
            }
          ).menkar.classifier.status(),
        ),
      )
      .toMatchObject({
        on: false,
        progress: null,
        status: expect.stringMatching(/^3 turns classified · \d\d:\d\d$/),
      })
  } finally {
    await launched.close()
  }
})
