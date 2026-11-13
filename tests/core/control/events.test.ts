// what wakes a parent. A child entering `blocked`, or leaving `working` for
// `idle` or `done`, is an event; per parent they wait 3 s and go together in one message.
import { describe, expect, test } from 'vitest'
import { WAKE_DELAY_MS, WakeBatcher, wakeEvent } from '../../../src/core/control/events'
import { addTask, emptyTasks, onStarredTask, tasksOf } from '../../../src/core/orchestration/tasks'

function fakeTimers() {
  let pending: { fn: () => void; at: number } | null = null
  let now = 0
  return {
    timers: {
      set: (fn: () => void, ms: number) => {
        pending = { fn, at: now + ms }
        return pending
      },
      clear: (handle: unknown) => {
        if (handle === pending) pending = null
      },
    },
    advance(ms: number) {
      now += ms
      if (pending && pending.at <= now) {
        const { fn } = pending
        pending = null
        fn()
      }
    },
  }
}

describe('waking a parent', () => {
  test.each([
    ['working', 'blocked', 'api is waiting at a permission prompt'],
    ['idle', 'blocked', 'api is waiting at a permission prompt'],
    ['working', 'done', 'api finished its turn'],
    ['working', 'idle', 'api finished its turn'],
    ['idle', 'idle', null],
    ['blocked', 'working', null],
    ['done', 'idle', null],
    ['idle', 'working', null],
  ] as const)('%s → %s', (previous, next, text) => {
    expect(wakeEvent('api', previous, next)).toBe(text)
  })

  test('two events within 3 s go in one message; one child keeps only its latest', () => {
    const sent: [string, string][] = []
    const clock = fakeTimers()
    const batcher = new WakeBatcher((parent, text) => sent.push([parent, text]), clock.timers)
    batcher.note('orch', 'a1', 'api', 'working', 'blocked')
    clock.advance(1000)
    batcher.note('orch', 'w2', 'web', 'working', 'done')
    batcher.note('orch', 'a1', 'api', 'blocked', 'working')
    batcher.note('orch', 'a1', 'api', 'working', 'done')
    clock.advance(WAKE_DELAY_MS - 1)
    expect(sent).toEqual([])
    clock.advance(1)
    expect(sent).toEqual([['orch', 'web finished its turn; api finished its turn']])
  })

  test('in one message, the events of ★ children come first; otherwise the order stays', () => {
    const sent: [string, string][] = []
    const clock = fakeTimers()
    const batcher = new WakeBatcher(
      (parent, text) => sent.push([parent, text]),
      clock.timers,
      (child) => child === 'b1',
    )
    batcher.note('orch', 'a1', 'A', 'working', 'done')
    batcher.note('orch', 'c1', 'C', 'working', 'done')
    batcher.note('orch', 'b1', 'B', 'working', 'done')
    clock.advance(WAKE_DELAY_MS)
    expect(sent).toEqual([
      ['orch', 'B finished its turn; A finished its turn; C finished its turn'],
    ])
  })

  // Decision 1.114: the ★ belongs to a task; a child whose current task has it speaks first.
  test('wake order by task ★: A (no task) and B (★ task) finish together → "B …; A …"', () => {
    const sent: [string, string][] = []
    const clock = fakeTimers()
    let t = addTask(emptyTasks(), 'p1', { title: 'urgent', assignee: 'b1', star: true }, '').tasks
    t = addTask(t, 'p1', { title: 'calm', assignee: 'c1', star: false }, '').tasks
    const list = tasksOf(t, 'p1')
    const batcher = new WakeBatcher(
      (parent, text) => sent.push([parent, text]),
      clock.timers,
      (child) => onStarredTask(list, child),
    )
    batcher.note('orch', 'a1', 'A', 'working', 'done')
    batcher.note('orch', 'c1', 'C', 'working', 'done')
    batcher.note('orch', 'b1', 'B', 'working', 'done')
    clock.advance(WAKE_DELAY_MS)
    expect(sent).toEqual([
      ['orch', 'B finished its turn; A finished its turn; C finished its turn'],
    ])
  })

  test('no parent, or a transition that is no event, sends nothing', () => {
    const sent: unknown[] = []
    const clock = fakeTimers()
    const batcher = new WakeBatcher((...args) => sent.push(args), clock.timers)
    batcher.note(null, 'a1', 'api', 'working', 'blocked')
    batcher.note('orch', 'a1', 'api', 'idle', 'idle')
    clock.advance(WAKE_DELAY_MS * 2)
    expect(sent).toEqual([])
  })
})
