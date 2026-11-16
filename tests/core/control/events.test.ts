// what wakes a parent. A child entering `blocked`, or leaving `working` for
// `idle` or `done`, is an event; per parent they wait 3 s and go together in one message.
import { describe, expect, test } from 'vitest'
import {
  WAKE_DELAY_MS,
  WakeBatcher,
  wakeEvent,
  wakesParent,
} from '../../../src/core/control/events'
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

  // Decision 1.173: the human's own posts join the batch, first; the latest per key wins.
  test("the human's posts go in the same message, before ★ children and the rest", () => {
    const sent: [string, string][] = []
    const clock = fakeTimers()
    const batcher = new WakeBatcher(
      (parent, text) => sent.push([parent, text]),
      clock.timers,
      (child) => child === 'b1',
    )
    batcher.note('orch', 'a1', 'A', 'working', 'done')
    batcher.post('orch', 'presence', 'The human is away')
    batcher.note('orch', 'b1', 'B', 'working', 'done')
    batcher.post('orch', 'topic:4', 'The human wants to discuss topic 4')
    batcher.post('orch', 'presence', 'The human is back')
    clock.advance(WAKE_DELAY_MS - 1)
    expect(sent).toEqual([])
    clock.advance(1)
    expect(sent).toEqual([
      [
        'orch',
        'The human wants to discuss topic 4; The human is back; B finished its turn; A finished its turn',
      ],
    ])
  })

  test("a human's post alone goes after the same wait", () => {
    const sent: [string, string][] = []
    const clock = fakeTimers()
    const batcher = new WakeBatcher((parent, text) => sent.push([parent, text]), clock.timers)
    batcher.post('orch', 'control:w1', 'The human took control of w1')
    batcher.post('orch', 'control:w1', 'The human handed w1 back')
    clock.advance(WAKE_DELAY_MS)
    expect(sent).toEqual([['orch', 'The human handed w1 back']])
  })

  // human_back: the orchestrator that cleared it is not told it was away a moment ago.
  test('a forgotten post is not sent; the rest of the message still goes', () => {
    const sent: [string, string][] = []
    const clock = fakeTimers()
    const batcher = new WakeBatcher((parent, text) => sent.push([parent, text]), clock.timers)
    batcher.post('orch', 'presence', 'The human is away')
    batcher.forget('orch', 'presence')
    batcher.post('other', 'presence', 'The human is away')
    batcher.forget('other', 'presence')
    batcher.note('other', 'a1', 'A', 'working', 'done')
    clock.advance(WAKE_DELAY_MS)
    expect(sent).toEqual([['other', 'A finished its turn']])
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

// A team post starts a turn. A turn opened only by team updates wakes no parent;
// one that also had a peer's or the human's message does. The transcript is read only for a pane
// that was delivered a team post since its last turn end.
describe("a team post's turn", () => {
  const reads = (only: boolean) => {
    const calls: number[] = []
    return {
      calls,
      read: async () => {
        calls.push(1)
        return only
      },
    }
  }
  const noReport = async () => false
  test('only team updates since the last turn → no wake', async () => {
    const r = reads(true)
    expect(await wakesParent('working', 'idle', true, r.read, noReport)).toBe(false)
    expect(await wakesParent('working', 'done', true, r.read, noReport)).toBe(false)
  })
  test("a peer's or the human's message too → the wake", async () => {
    expect(await wakesParent('working', 'idle', true, reads(false).read, noReport)).toBe(true)
  })
  test('a pane delivered no team post reads nothing', async () => {
    const r = reads(true)
    expect(await wakesParent('working', 'idle', false, r.read, noReport)).toBe(true)
    expect(r.calls).toEqual([])
  })
  test('a permission prompt always wakes, unread', async () => {
    const r = reads(true)
    const report = reads(true)
    expect(await wakesParent('working', 'blocked', true, r.read, report.read)).toBe(true)
    expect(r.calls).toEqual([])
    expect(report.calls).toEqual([])
  })
})

// Decision 1.173: one notice per report. A turn the child's report to its parent closed ends
// without "finished its turn".
describe('a turn closed by a report', () => {
  test('the report closed the turn → no wake', async () => {
    expect(
      await wakesParent(
        'working',
        'idle',
        false,
        async () => false,
        async () => true,
      ),
    ).toBe(false)
  })
  test('no report → the wake', async () => {
    expect(
      await wakesParent(
        'working',
        'done',
        false,
        async () => false,
        async () => false,
      ),
    ).toBe(true)
  })
})
