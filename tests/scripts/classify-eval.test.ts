// The classifier's evaluation script (docs/spec/classifier.md, CLS-39), run as a developer runs
// it, against the stand-in `claude` in tests/data/classifier: never the real one.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { expect, test } from 'vitest'

const SCRIPT = resolve('scripts/classify-eval.mjs')
const FAKE_DIR = resolve('tests/data/classifier')
const CATEGORIES = ['plan', 'design', 'build', 'test', 'deploy', 'maintain', 'other']

function setup() {
  const root = mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', 'classify-eval-'))
  const log = join(root, 'log')
  const replies = join(root, 'replies')
  mkdirSync(log)
  mkdirSync(replies)
  // Synthetic labels: turn i is labelled with category i % 7.
  const labels = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      prompt: `synthetic prompt ${i}`,
      prev_prompt: '',
      tools: [{ name: 'Bash', command: 'npm test' }],
      label: CATEGORIES[i % 7],
    }))
  writeFileSync(join(root, 'sample.json'), JSON.stringify(labels(50)))
  writeFileSync(join(root, 'silver.json'), JSON.stringify(labels(91)))
  // Every reply answers "build" for each turn of a batch of up to 30.
  for (let n = 1; n <= 6; n += 1) {
    const answers = Array.from({ length: 30 }, (_, id) => ({ id, category: 'build' }))
    writeFileSync(join(replies, `${n}.json`), JSON.stringify({ result: JSON.stringify(answers) }))
  }
  const dataHome = join(root, 'user-data')
  return {
    root,
    log,
    dataHome,
    run: (args: string[]) =>
      spawnSync(process.execPath, [SCRIPT, ...args], {
        encoding: 'utf8',
        env: {
          PATH: `${FAKE_DIR}:${process.env.PATH ?? ''}`,
          HOME: join(root, 'home'),
          XDG_DATA_HOME: dataHome,
          FAKE_CLAUDE_LOG: log,
          FAKE_CLAUDE_REPLIES: replies,
        },
      }),
  }
}

test('CLS-39 with no arguments it prints its usage and exits 2', () => {
  const result = setup().run([])
  expect(result.status).toBe(2)
  expect(result.stderr).toContain('usage: node scripts/classify-eval.mjs')
})

test('CLS-39 two label files: a line each, all, answered, seven recalls, six calls, user data untouched', () => {
  const s = setup()
  const result = s.run([join(s.root, 'sample.json'), join(s.root, 'silver.json')])
  expect(result.status).toBe(0)
  // build is category 2: labelled on turns 2, 9, 16… — 7 of the 50, 13 of the 91
  expect(result.stdout.split('\n').filter(Boolean)).toEqual([
    'sample     7/50 = 14%',
    'silver     13/91 = 14%',
    'all        20/141 = 14%',
    'answered   141/141',
    '  plan      recall 0/21 = 0%',
    '  design    recall 0/20 = 0%',
    '  build     recall 20/20 = 100%',
    '  test      recall 0/20 = 0%',
    '  deploy    recall 0/20 = 0%',
    '  maintain  recall 0/20 = 0%',
    '  other     recall 0/20 = 0%',
  ])
  expect(readdirSync(s.log).sort()).toEqual([
    'call-1',
    'call-2',
    'call-3',
    'call-4',
    'call-5',
    'call-6',
  ])
  expect(existsSync(s.dataHome)).toBe(false)
})
