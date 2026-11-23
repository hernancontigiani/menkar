// The captures' seed: both locales write the same world, its time is its own, and it writes only
// under the root it is given.
process.env.TZ = 'America/Argentina/Buenos_Aires'

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { LOCALES, type Locale } from '../../e2e/captures/registry'
import {
  SCREENS_ENV,
  seed,
  seedClock,
  TODAY_SPAN_MINUTES,
  vocabulary,
} from '../../e2e/captures/seed'
import { openDb } from '../../src/core/db'

const MINUTE = 60_000
const local = (day: number, hour: number, minute: number) =>
  new Date(2026, 10, day, hour, minute).getTime()

function newRoot(name: string) {
  const root = mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', `seed-${name}-`))
  const home = join(root, 'home')
  mkdirSync(home)
  return { root, home }
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name))
}

// Every text of the locale replaced by its name, whole words first and the longest first, so
// what is left is the structure.
function normalizer(locale: Locale, root: string): (text: string) => string {
  const words = Object.entries(vocabulary(locale)).sort((a, b) => b[1].length - a[1].length)
  return (text) => {
    let out = text
      .split(root)
      .join('<root>')
      .split(root.replace(/[^A-Za-z0-9]/g, '-'))
      .join('<root>')
    for (const [key, value] of words) {
      const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      out = out.replace(new RegExp(`(?<![A-Za-z0-9-])${escaped}(?![A-Za-z0-9-])`, 'gu'), `{${key}}`)
    }
    return out
  }
}

function dumpDb(path: string): string {
  const db = openDb(path)
  try {
    const tables = db.raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => String(row.name))
    return JSON.stringify(
      tables.map((t) => [
        t,
        db.raw
          .prepare(`SELECT * FROM ${t}`)
          .all()
          // Byte positions and inodes follow each text's length, not the structure.
          .map((row) =>
            JSON.stringify({
              ...row,
              ...('offset' in row ? { offset: 0 } : {}),
              ...('inode' in row ? { inode: 0 } : {}),
            }),
          )
          .sort(),
      ]),
    )
  } finally {
    db.close()
  }
}

// What one seed wrote, by normalised path: its text, or a dump of a database.
async function seeded(locale: Locale, now: number): Promise<Map<string, string>> {
  const dirs = newRoot(locale)
  await seed(dirs, locale, 'dark', now)
  const norm = normalizer(locale, dirs.root)
  const written = new Map<string, string>()
  for (const file of filesUnder(dirs.root)) {
    const path = relative(dirs.root, file)
    if (path.startsWith('node-bin')) continue
    const text = file.endsWith('.sqlite')
      ? dumpDb(file)
      : readFileSync(file, 'utf8').replace(`"language": "${locale}"`, '"language": "<locale>"')
    written.set(norm(path), norm(text))
  }
  return written
}

describe('the two locales', () => {
  test('seed the same rows, in the same order, in the same states', async () => {
    const now = local(20, 12, 0)
    const [en, es] = await Promise.all(LOCALES.map((l) => seeded(l, now)))
    if (!en || !es) throw new Error('two locales expected')
    // A floor: the world is there, not an empty comparison.
    expect([...en.keys()].filter((p) => p.endsWith('.jsonl')).length).toBeGreaterThanOrEqual(11)
    for (const file of [
      'projects.json',
      'tasks.json',
      'topics.json',
      'state.json',
      'history.sqlite',
    ])
      expect(
        [...en.keys()].some((p) => p.endsWith(file)),
        file,
      ).toBe(true)
    expect([...es.keys()].sort()).toEqual([...en.keys()].sort())
    for (const [path, text] of en) expect(es.get(path), path).toBe(text)
  })

  test('are not the same text', async () => {
    const now = local(20, 12, 0)
    const raw = async (locale: Locale) => {
      const dirs = newRoot(`raw-${locale}`)
      await seed(dirs, locale, 'light', now)
      return readFileSync(join(dirs.root, 'config', 'menkar', 'tasks.json'), 'utf8')
    }
    expect(await raw('es')).not.toBe(await raw('en'))
  })
})

describe("the seed's time", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  test.each([
    ['00:03', local(20, 0, 3)],
    ['12:00', local(20, 12, 0)],
  ])("at %s, today's events are today, in order, and none is after now", (_, now) => {
    const clock = seedClock(now)
    const floor = local(20, 0, 1)
    let previous = Number.POSITIVE_INFINITY
    for (let minutes = 0; minutes <= TODAY_SPAN_MINUTES; minutes += 5) {
      const at = clock.today(minutes)
      expect(at).toBeGreaterThanOrEqual(floor)
      expect(at).toBeLessThanOrEqual(now)
      expect(at).toBeLessThan(previous)
      previous = at
    }
  })

  test('at 12:00, an event two hours ago is exactly two hours ago', () => {
    const now = local(20, 12, 0)
    expect(seedClock(now).today(120)).toBe(now - 120 * MINUTE)
  })

  test('days ago are local wall times', () => {
    const at = new Date(seedClock(local(20, 0, 3)).daysAgo(3, 14, 30))
    expect([at.getDate(), at.getHours(), at.getMinutes()]).toEqual([17, 14, 30])
  })

  test('at 00:03, what the seed writes for today is today, and the real clock reaches nothing', async () => {
    const now = local(20, 0, 3)
    const write = async (real: number) => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(real)
      try {
        const dirs = newRoot(`clock-${real}`)
        await seed(dirs, 'en', 'dark', now)
        return dirs
      } finally {
        vi.useRealTimers()
      }
    }
    const a = await write(local(1, 9, 0) + 123)
    const b = await write(local(28, 18, 30) + 777)
    const config = (root: string, file: string) =>
      readFileSync(join(root, 'config', 'menkar', file), 'utf8')
    for (const file of ['projects.json', 'tasks.json', 'topics.json', 'state.json'])
      expect(config(b.root, file), file).toBe(config(a.root, file))
    const tasks = JSON.parse(config(a.root, 'tasks.json'))
    const done = tasks.projects['4e0a7d1c9b2f'].tasks.find(
      (t: { number: number }) => t.number === 1,
    )
    expect(Date.parse(done.closed)).toBeGreaterThanOrEqual(local(20, 0, 1))
    expect(Date.parse(done.closed)).toBeLessThanOrEqual(now)
    const mtimes = (root: string) =>
      filesUnder(join(root, 'home'))
        .map((f) => statSync(f).mtimeMs)
        .sort()
    expect(mtimes(b.root)).toEqual(mtimes(a.root))
    expect(Math.max(...mtimes(a.root))).toBeLessThanOrEqual(now)
  })
})

test('the seed writes under its root only, and hands the launch its stand-in', async () => {
  const dirs = newRoot('paths')
  // The process's own directories, fresh and empty: a writer that resolves its path from the
  // environment would land here.
  const own = newRoot('own')
  const keys = ['HOME', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'XDG_DATA_HOME'] as const
  const saved = keys.map((k) => process.env[k])
  process.env.HOME = own.home
  for (const k of keys.slice(1)) process.env[k] = join(own.root, k)
  try {
    const env = await seed(dirs, 'es', 'dark', local(20, 12, 0))
    expect(filesUnder(own.root)).toEqual([])
    expect(env.PATH?.split(':')[0]).toBe(join(dirs.root, 'bin'))
    expect(existsSync(join(dirs.root, 'bin', 'claude'))).toBe(true)
    expect(env[SCREENS_ENV]).toBe(join(dirs.root, 'stand-in'))
    expect(existsSync(join(dirs.root, 'stand-in', 'default.json'))).toBe(true)
  } finally {
    keys.forEach((k, i) => {
      process.env[k] = saved[i]
    })
  }
})
