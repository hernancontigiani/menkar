// The switch's settings, and the lock the hourly pass and the earlier-turns run share
// (docs/spec/classifier.md, CLS-1, CLS-2, CLS-37).
import { expect, test } from 'vitest'
import { ClassifierLock } from '../../../src/core/classifier/lock'
import type { RunResult } from '../../../src/core/classifier/run'
import {
  classifyLast,
  classifySince,
  withLastRun,
  withSwitch,
} from '../../../src/core/classifier/settings'

const done = (at: number): RunResult => ({ at, classified: 1, failed: false })

function deferred() {
  let resolve: (value: RunResult) => void = () => {}
  const promise = new Promise<RunResult>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

test('CLS-1 with no classify_since the classification is off', () => {
  expect(classifySince({})).toBeNull()
  expect(classifySince({ settings: { classify_since: null } })).toBeNull()
  expect(classifySince({ settings: 'odd' })).toBeNull()
  expect(classifySince({ settings: { classify_since: '10' } })).toBeNull()
})

test('CLS-2 turning the switch on stores the moment, off stores null, on again the new moment', () => {
  const ten = Date.UTC(2026, 10, 8, 13) / 1000
  const on = withSwitch({ names: { a: 'b' }, settings: { font: 'x' } }, true, ten)
  expect(on).toEqual({ names: { a: 'b' }, settings: { font: 'x', classify_since: ten } })
  expect(classifySince(on)).toBe(ten)
  const off = withSwitch(on, false, ten + 60)
  expect(classifySince(off)).toBeNull()
  expect((off.settings as Record<string, unknown>).classify_since).toBeNull()
  expect(classifySince(withSwitch(off, true, ten + 3600))).toBe(ten + 3600)
})

test("a run's result is kept as classify_last, the other settings untouched", () => {
  const rest = withLastRun(
    { settings: { classify_since: 5 } },
    { at: 9, classified: 12, failed: false },
  )
  expect(classifyLast(rest)).toEqual({ at: 9, classified: 12, failed: false })
  expect(classifySince(rest)).toBe(5)
})

test('CLS-37 an hourly pass during an earlier-turns run is skipped and records nothing', async () => {
  const lock = new ClassifierLock()
  const earlier = deferred()
  const running = lock.earlier(() => earlier.promise)
  await Promise.resolve()
  expect(lock.classifyingEarlier).toBe(true)
  let hourlyRan = false
  expect(
    await lock.hourly(async () => {
      hourlyRan = true
      return done(2)
    }),
  ).toBeNull()
  expect(hourlyRan).toBe(false)
  earlier.resolve(done(1))
  expect(await running).toEqual(done(1))
  expect(lock.busy).toBe(false)
})

test('CLS-37 an earlier-turns run confirmed during an hourly pass starts only after it ends', async () => {
  const lock = new ClassifierLock()
  const hourly = deferred()
  const events: string[] = []
  const pass = lock.hourly(() =>
    hourly.promise.then((r) => {
      events.push('hourly done')
      return r
    }),
  )
  const earlier = lock.earlier(async () => {
    events.push('earlier started')
    return done(3)
  })
  await new Promise((r) => setTimeout(r, 5))
  expect(events).toEqual([])
  hourly.resolve(done(2))
  await pass
  await earlier
  expect(events).toEqual(['hourly done', 'earlier started'])
})
