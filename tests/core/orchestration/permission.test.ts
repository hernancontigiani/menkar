// Decision 1.178 (Q6, Q7): a session of the orchestrator at a permission prompt wakes nobody;
// Menkar raises one blocking topic for it, unless it is "with you" or its pane is seen, and closes
// it 3 s after the prompt is answered.
import { describe, expect, test } from 'vitest'
import {
  openPermissionTopic,
  PERMISSION_ANSWERED,
  PERMISSION_CLOSE_MS,
  type PermissionSubject,
  PermissionTopics,
  permissionTopic,
} from '../../../src/core/orchestration/permission'
import {
  addTopic,
  closeTopic,
  emptyTopics,
  parseTopics,
  serializeTopics,
  type Topics,
  topicsOf,
  updateTopic,
} from '../../../src/core/orchestration/topics'

const AT = '2026-11-18T23:59:59.000-03:00'

function manyTimers() {
  let now = 0
  const pending = new Set<{ fn: () => void; at: number }>()
  return {
    timers: {
      set: (fn: () => void, ms: number) => {
        const handle = { fn, at: now + ms }
        pending.add(handle)
        return handle
      },
      clear: (handle: unknown) => {
        pending.delete(handle as { fn: () => void; at: number })
      },
    },
    advance(ms: number) {
      now += ms
      for (const handle of [...pending].sort((a, b) => a.at - b.at)) {
        if (handle.at > now) continue
        pending.delete(handle)
        handle.fn()
      }
    },
  }
}

// The topics of one project, with the calls main makes for them.
function project() {
  let topics: Topics = emptyTopics()
  const raised: number[] = []
  const closed: number[] = []
  const clock = manyTimers()
  const topicsNow = new PermissionTopics(
    {
      openTopic: (session) => openPermissionTopic(topicsOf(topics, 'p1'), session)?.number ?? null,
      raise: (subject) => {
        const added = addTopic(topics, 'p1', permissionTopic('worker', subject.session, 7), AT)
        topics = added.topics
        raised.push(added.number)
        return added.number
      },
      close: (_, number) => {
        topics = closeTopic(topics, 'p1', number, PERMISSION_ANSWERED, AT)?.topics ?? topics
        closed.push(number)
      },
    },
    clock.timers,
  )
  return {
    get topics() {
      return topics
    },
    set topics(value: Topics) {
      topics = value
    },
    raised,
    closed,
    clock,
    p: topicsNow,
  }
}

const worker: PermissionSubject = {
  pane: 'pane-1',
  session: 's1',
  parentIsOrchestrator: true,
  withYou: false,
  seen: false,
}

describe("Menkar's permission topic", () => {
  test('blocked → one blocking topic, with its English title and context', () => {
    const x = project()
    x.p.blocked(worker)
    expect(x.raised).toEqual([1])
    expect(topicsOf(x.topics, 'p1')[0]).toMatchObject({
      title: 'worker is waiting at a permission prompt',
      context: 'Answer it in its tab. Menkar closes this topic once it is answered.',
      from: 's1',
      blocking: true,
      task: 7,
      kind: 'permission',
      status: 'open',
    })
  })

  test('blocked again while it is open → nothing new', () => {
    const x = project()
    x.p.blocked(worker)
    x.p.blocked(worker)
    expect(x.raised).toEqual([1])
  })

  test('blocked while its topic is being discussed → nothing new', () => {
    const x = project()
    const added = addTopic(emptyTopics(), 'p1', permissionTopic('worker', 's1'), AT)
    x.topics = updateTopic(added.topics, 'p1', 1, { status: 'discussing' }, AT)?.topics ?? x.topics
    x.p.blocked(worker)
    expect(x.raised).toEqual([])
  })

  test('out of the prompt → closed after 3 s, still open at 2,999 ms', () => {
    expect(PERMISSION_CLOSE_MS).toBe(3000)
    const x = project()
    x.p.blocked(worker)
    x.p.unblocked(worker.pane)
    x.clock.advance(PERMISSION_CLOSE_MS - 1)
    expect(x.closed).toEqual([])
    x.clock.advance(1)
    expect(x.closed).toEqual([1])
    expect(topicsOf(x.topics, 'p1')[0]).toMatchObject({
      status: 'closed',
      decision: 'The prompt was answered',
    })
  })

  test('another prompt within the 3 s → no close and no second topic', () => {
    const x = project()
    x.p.blocked(worker)
    x.p.unblocked(worker.pane)
    x.clock.advance(2000)
    x.p.blocked(worker)
    x.clock.advance(PERMISSION_CLOSE_MS * 2)
    expect(x.closed).toEqual([])
    expect(x.raised).toEqual([1])
  })

  test("the pane's exit → closed at once", () => {
    const x = project()
    x.p.blocked(worker)
    x.p.exited(worker.pane)
    expect(x.closed).toEqual([1])
  })

  test('closed by hand → not closed again; the next prompt raises a new one', () => {
    const x = project()
    x.p.blocked(worker)
    x.topics = closeTopic(x.topics, 'p1', 1, 'handled', AT)?.topics ?? x.topics
    x.p.unblocked(worker.pane)
    x.clock.advance(PERMISSION_CLOSE_MS)
    expect(x.closed).toEqual([])
    x.p.blocked(worker)
    expect(x.raised).toEqual([1, 2])
  })

  test.each([
    ['"with you"', { withYou: true }],
    ["not the orchestrator's child", { parentIsOrchestrator: false }],
    ['its pane seen by the human', { seen: true }],
  ] as const)('%s → no topic', (_, change) => {
    const x = project()
    x.p.blocked({ ...worker, ...change })
    x.p.exited(worker.pane)
    expect(x.raised).toEqual([])
    expect(x.closed).toEqual([])
  })
})

describe("a topic's kind in the topics file", () => {
  const read = (t: Topics) => parseTopics(JSON.parse(JSON.stringify(serializeTopics(t))))

  test("kind 'permission' is kept across a write and a read", () => {
    const t = addTopic(emptyTopics(), 'p1', permissionTopic('w', 's1'), AT).topics
    expect(topicsOf(read(t), 'p1')[0]?.kind).toBe('permission')
  })

  test('a topic without it reads as before; an unknown kind reads as none', () => {
    const t = addTopic(
      emptyTopics(),
      'p1',
      { title: 'a', context: '', from: 's1', blocking: false },
      AT,
    ).topics
    const written = serializeTopics(t) as {
      projects: Record<string, { topics: Record<string, unknown>[] }>
    }
    const plain = parseTopics(JSON.parse(JSON.stringify(written)))
    expect(topicsOf(plain, 'p1')[0]).not.toHaveProperty('kind')
    const raw = JSON.parse(JSON.stringify(written))
    raw.projects.p1.topics[0].kind = 'later'
    expect(topicsOf(parseTopics(raw), 'p1')[0]).not.toHaveProperty('kind')
  })
})
