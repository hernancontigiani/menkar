// Classifying earlier turns: the count, the estimate, the run with its progress and its stop
// (docs/spec/classifier.md, CLS-27 to CLS-29, CLS-33 to CLS-36).
process.env.TZ = 'America/Argentina/Buenos_Aires'

import { rmSync, truncateSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { type Call, classifyEarlier, estimate } from '../../../src/core/classifier/run'
import { estimateLines } from '../../../src/core/classifier/text'
import { UsageCache } from '../../../src/core/usage/cache'
import { UsageHistory } from '../../../src/core/usage/history'
import { runPass } from '../../../src/core/usage/pass'
import { memberships, prompt, usageDirs } from '../../factories/usage'

const secs = (time: string) => new Date(`2026-11-08T${time}`).getTime() / 1000
const NOW = secs('23:30:00')

type Dirs = ReturnType<typeof usageDirs>

// Turns ten seconds apart from 08:00, so a thousand of them stay within the day.
function turns(count: number, origin = 'human', from = 0) {
  return Array.from({ length: count }, (_, k) => {
    const i = k + from
    const total = 8 * 3600 + i * 10
    const time = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
      .map((n) => String(n).padStart(2, '0'))
      .join(':')
    return {
      ...prompt(time),
      uuid: `t${i}`,
      turnOrigin: origin,
      message: { content: `turn ${i} long enough to stand alone` },
    }
  })
}

function open(dirs: Dirs) {
  runPass(memberships(), {
    claudeProjects: dirs.claudeProjects,
    cache: dirs.cache,
    history: dirs.history,
  })
  const history = new UsageHistory(dirs.history)
  const cache = new UsageCache(dirs.cache)
  return {
    history,
    cache,
    close() {
      history.close()
      cache.close()
    },
    rows: () =>
      Object.fromEntries(
        (
          history.handle?.raw.prepare('SELECT uuid, category, category_tries FROM turns').all() ??
          []
        ).map((r) => [String(r.uuid), [r.category, r.category_tries]]),
      ),
  }
}

function answering() {
  const sizes: number[] = []
  const call: Call = (input) => {
    const batch = JSON.parse(input.slice(input.indexOf('\n') + 1)) as { id: number }[]
    sizes.push(batch.length)
    return JSON.stringify({
      result: JSON.stringify(batch.map((t) => ({ id: t.id, category: 'plan' }))),
    })
  }
  return { call, sizes }
}

const estimateOf = (count: number, unavailable = 0) => ({
  turns: count,
  calls: Math.ceil(count / 30),
  unavailable,
  dollars: (count * 0.021) / 141,
  seconds: (Math.ceil(count / 30) * 68) / 5,
})

describe('the estimate', () => {
  test('CLS-27 nine turns: under a cent and under a minute', () => {
    expect(estimateLines(estimateOf(9))).toEqual([
      'Turns to send: 9',
      'Estimated use of your plan: under US$0.01',
      'Estimated time: under a minute, in the background',
    ])
  })

  test('CLS-28 300 turns: US$0.04, about 2 min; 1,000 turns: US$0.15, about 8 min', () => {
    const dirs = usageDirs('cls28')
    dirs.transcript('s1', turns(1000))
    const db = open(dirs)
    const all = estimate(db.history, db.cache, 0, NOW)
    expect(all).toMatchObject({ turns: 1000, calls: 34 })
    expect(all.seconds).toBeCloseTo(462.4, 6)
    expect(all.dollars).toBeCloseTo(0.148936, 5)
    expect(estimateLines(all).slice(1)).toEqual([
      'Estimated use of your plan: US$0.15',
      'Estimated time: about 8 min, in the background',
    ])
    const later = estimate(db.history, db.cache, secs('09:56:40'), NOW)
    expect(later.turns).toBe(300)
    expect(estimateLines(later).slice(1)).toEqual([
      'Estimated use of your plan: US$0.04',
      'Estimated time: about 2 min, in the background',
    ])
    db.close()
  })

  test('CLS-29 turns whose transcript is gone are counted apart', () => {
    expect(estimateLines(estimateOf(40, 5))).toContain(
      'Left unclassified, their transcript is gone: 5',
    )
    expect(estimateLines(estimateOf(40)).some((l) => l.startsWith('Left'))).toBe(false)
  })

  test('CLS-33 the count takes unknown turns, not classified ones, not spent ones, not a fresh last one', () => {
    const dirs = usageDirs('cls33')
    dirs.transcript('s1', [...turns(3), ...turns(2, 'unknown', 3), ...turns(1, 'peer', 5)])
    dirs.transcript('s2', [
      { ...prompt('23:10:00'), uuid: 'fresh', message: { content: 'just typed' } },
    ])
    const db = open(dirs)
    db.history.setCategories(new Map([['t0', 'build']]))
    for (let i = 0; i < 3; i += 1) db.history.countTry(['t1'])
    const found = estimate(db.history, db.cache, secs('00:00:00'), NOW)
    expect(found).toMatchObject({ turns: 3, unavailable: 0, calls: 1 })
    db.close()
  })

  test('a turn whose transcript is gone, or cut shorter than its offset, is unavailable', () => {
    const dirs = usageDirs('unavailable')
    const cut = dirs.transcript('s1', turns(3))
    const gone = dirs.transcript('s2', turns(2, 'human', 10))
    const db = open(dirs)
    rmSync(gone)
    // the first two lines and a little of the third remain: the third turn's line starts past the end
    const first = Buffer.byteLength(`${JSON.stringify(turns(1)[0])}\n`)
    const second = Buffer.byteLength(`${JSON.stringify(turns(1, 'human', 1)[0])}\n`)
    truncateSync(cut, first + second)
    expect(estimate(db.history, db.cache, 0, NOW)).toMatchObject({ turns: 2, unavailable: 3 })
    db.close()
  })
})

describe('the run', () => {
  test('CLS-34 75 turns go in calls of 30, 30 and 15, with their progress', () => {
    const dirs = usageDirs('cls34')
    dirs.transcript('s1', turns(75))
    const db = open(dirs)
    const fake = answering()
    const progress: string[] = []
    const result = classifyEarlier(db.history, db.cache, 0, NOW, fake.call, (sent, total) =>
      progress.push(`${sent} of ${total}`),
    )
    expect(fake.sizes).toEqual([30, 30, 15])
    expect(progress).toEqual(['0 of 75', '30 of 75', '60 of 75', '75 of 75'])
    expect(result).toEqual({ at: NOW, classified: 75, failed: false })
    db.close()
  })

  test('CLS-35 a stop ends the run after the call in flight; running again sends only what is left', () => {
    const dirs = usageDirs('cls35')
    dirs.transcript('s1', turns(150))
    const db = open(dirs)
    const fake = answering()
    let stop = false
    const call: Call = (input) => {
      const out = fake.call(input)
      if (fake.sizes.length === 2) stop = true
      return out
    }
    const result = classifyEarlier(
      db.history,
      db.cache,
      0,
      NOW,
      call,
      () => {},
      () => stop,
    )
    expect(fake.sizes).toEqual([30, 30])
    expect(result).toEqual({ at: NOW, classified: 60, failed: false })
    const again = answering()
    classifyEarlier(db.history, db.cache, 0, NOW, again.call)
    expect(again.sizes).toEqual([30, 30, 30])
    expect(Object.values(db.rows()).every(([c]) => c === 'plan')).toBe(true)
    db.close()
  })

  test('CLS-36 a turn whose transcript went missing during the run is skipped, its tries unchanged', () => {
    const dirs = usageDirs('cls36')
    dirs.transcript('s1', turns(30))
    const lost = dirs.transcript('s2', turns(30, 'human', 100))
    const db = open(dirs)
    const fake = answering()
    const call: Call = (input) => {
      rmSync(lost, { force: true })
      return fake.call(input)
    }
    classifyEarlier(db.history, db.cache, 0, NOW, call)
    expect(fake.sizes).toEqual([30])
    const rows = db.rows()
    expect(rows.t100).toEqual([null, 0])
    expect(rows.t0).toEqual(['plan', 0])
    db.close()
  })

  test('with no claude the run fails at once and sends nothing', () => {
    const dirs = usageDirs('earlier-noclaude')
    dirs.transcript('s1', turns(3))
    const db = open(dirs)
    expect(classifyEarlier(db.history, db.cache, 0, NOW, null)).toEqual({
      at: NOW,
      classified: 0,
      failed: true,
    })
    expect(Object.values(db.rows()).every(([c, tries]) => c === null && tries === 0)).toBe(true)
    db.close()
  })
})
