// what wakes a parent. A child entering `blocked`, or leaving `working` for
// `idle` or `done`, is an event; per parent they wait 3 s and go together in one message.
import { describe, expect, test } from 'vitest'
import {
  type RouteInput,
  route,
  WAKE_DELAY_MS,
  WakeBatcher,
  type WakeEntry,
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

// Decision 1.178: a review wake has a key of its own, so a child's second event inside the wait
// never replaces it, and the batch's entries reach the sender with their keys.
describe("a wake's own key", () => {
  function batcher(starred: (child: string) => boolean = () => false) {
    const sent: [string, string, readonly WakeEntry[]][] = []
    const clock = fakeTimers()
    const b = new WakeBatcher((...args) => sent.push(args), clock.timers, starred)
    return { sent, clock, b }
  }

  test('two wakes of one child with two keys inside the wait both arrive, in order', () => {
    const { sent, clock, b } = batcher()
    b.wake('orch:p1', 'w1', 'review:w1:4', 'w set task 4 to review: done')
    clock.advance(1000)
    b.wake('orch:p1', 'w1', 'review:w1:5', 'w set task 5 to review: also')
    clock.advance(WAKE_DELAY_MS)
    expect(sent).toEqual([
      [
        'orch:p1',
        'w set task 4 to review: done; w set task 5 to review: also',
        [
          { key: 'review:w1:4', text: 'w set task 4 to review: done' },
          { key: 'review:w1:5', text: 'w set task 5 to review: also' },
        ],
      ],
    ])
  })

  test('a wake and a state change of one child both arrive', () => {
    const { sent, clock, b } = batcher()
    b.wake('orch', 'w1', 'review:w1:4', 'w set task 4 to review: done')
    b.note('orch', 'w1', 'w', 'working', 'done')
    clock.advance(WAKE_DELAY_MS)
    expect(sent[0]?.[2]).toEqual([
      { key: 'review:w1:4', text: 'w set task 4 to review: done' },
      { key: 'w1', text: 'w finished its turn' },
    ])
  })

  test("a ★ child's wake comes before an unstarred child's state change", () => {
    const { sent, clock, b } = batcher((child) => child === 'b1')
    b.note('orch', 'a1', 'A', 'working', 'done')
    b.wake('orch', 'b1', 'review:b1:2', 'B set task 2 to review: ok')
    clock.advance(WAKE_DELAY_MS)
    expect(sent[0]?.[1]).toBe('B set task 2 to review: ok; A finished its turn')
  })
})

// Decision 1.178: in the orchestrator's project, what wakes it and what waits in its inbox.
describe('routing an event to the orchestrator', () => {
  const turnEnd: RouteInput = {
    event: 'turn-end',
    parentIsOrchestrator: true,
    reviewPending: false,
    renewing: false,
    onlyTeamUpdates: false,
    reportedToParent: false,
  }
  test.each([
    [
      'a pending review whose turn a SendMessage to the parent closed → wake',
      { reviewPending: true, reportedToParent: true },
      'wake',
    ],
    [
      'a pending review with a renew in flight → wake',
      { reviewPending: true, renewing: true },
      'wake',
    ],
    [
      'a pending review in a turn only team updates opened → wake',
      { reviewPending: true, onlyTeamUpdates: true },
      'wake',
    ],
    [
      'a pending review of a session that is not a child → wake',
      { reviewPending: true, parentIsOrchestrator: false },
      'wake',
    ],
    ['a renew alone → none', { renewing: true }, 'none'],
    ['team updates alone → none', { onlyTeamUpdates: true }, 'none'],
    ['a SendMessage to the parent → none', { reportedToParent: true }, 'none'],
    ['a child ending its turn without a report, an ask earlier or not → inbox', {}, 'inbox'],
    ['a non-child with nothing pending → none', { parentIsOrchestrator: false }, 'none'],
    ['a child at a permission prompt → inbox', { event: 'blocked' }, 'inbox'],
    [
      'a non-child at a permission prompt → none',
      { event: 'blocked', parentIsOrchestrator: false },
      'none',
    ],
    ["the human's own news → inbox", { event: 'human', parentIsOrchestrator: false }, 'inbox'],
  ] as const)('%s', (_, change, expected) => {
    expect(route({ ...turnEnd, ...change })).toBe(expected)
  })

  // Any other parent — the mode off, or a parent that is not the orchestrator — is woken as today.
  test("another parent's events are today's: a prompt and a turn end wake", async () => {
    expect(wakeEvent('w', 'working', 'blocked')).toBe('w is waiting at a permission prompt')
    expect(wakeEvent('w', 'working', 'idle')).toBe('w finished its turn')
    expect(
      await wakesParent(
        'working',
        'idle',
        false,
        async () => false,
        async () => false,
      ),
    ).toBe(true)
  })
})
