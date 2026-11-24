// D1 for Cursor, which has no channel into a running chat: a wake is held for the pane and the
// session's next completed turn hands it over through the stop hook's `followup_message`; an idle
// session whose box is empty is ended and resumed with it as its first message, at once or once its
// box empties. A turn running, a card open or a draft in the box is never touched, so nothing is
// typed and no draft is lost. A team update is only held (1.159, S7): it never restarts a session.
// The stop is the real hook program's, on the same folder.
import { existsSync, mkdtempSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { runHook } from '../../../../src/core/agents/cursor/hooks'
import {
  CursorWakes,
  RESTART_GAP_MAX_MS,
  RESTART_GAP_MS,
  SETTLE_MS,
} from '../../../../src/main/agents/cursor/waker'
import type { WakePane } from '../../../../src/main/agents/types'

const SESSION = '0b7d4c2e-1f0a-4e55-9b1a-2a3c4d5e6f70'
const FOOTER = '\n\n  Auto · 4.1%\n  /home/demo/api · main\n'
const EMPTY = `  Done.\n\n  → Add a follow-up${FOOTER}`
const DRAFT = `  Done.\n\n  → also update the READ${FOOTER}`
const WORKING = `  ⠠⠛ Working 1200 tokens\n\n  → Add a follow-up\n  ctrl+c to stop${FOOTER}`
// Cursor's screen once its plan's requests ran out (measured by `cursor` on 2026.11.13-eacade1,
// 2026-11-24): every turn ends in this error, and the refused prompt is put back in the box as text.
const LIMIT = `  → [Menkar] from orch (Claude Code); reply with send_message: look at a.txt
  Auto
  ~/work
  Error: You've hit your usage limit
  Get Cursor Pro for more Agent usage, unlimited Tab, and more.
  fallbackModel:
  spendLimitHit: false
  limitType: included_usage
  chatMessage: *You've hit your free requests limit. [Upgrade to
  Pro](https://example.com/upgrade) for more usage, frontier models, Cloud Agents,
  and more. Your usage limits will reset when your monthly cycle ends on 12/14/2026.*
  spendLimits: [50,100,200]
`
const CARD =
  '  Run this command?\n  → Run (once) (y)\n    Skip & tell the agent what to do instead (esc or n)\n'

let root = ''
let cache = ''

beforeEach(() => {
  const base = mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', 'cursor-waker-'))
  root = join(base, 'held-wakes')
  cache = join(base, 'cache')
})
afterEach(() => {
  vi.useRealTimers()
})

interface FakePane extends WakePane {
  shown: string
  readonly resumed: string[]
  // What resume answers: the new pane's id, or null for a restart that did not happen.
  next: string | null
  draw(screen: string): void
}

function paneOf(id: string, shown: string): FakePane {
  const listeners = new Set<() => void>()
  const pane: FakePane = {
    id,
    shown,
    resumed: [],
    next: `${id}-resumed`,
    screen: () => pane.shown,
    onScreen: (changed) => {
      listeners.add(changed)
      return () => listeners.delete(changed)
    },
    resume: async (prompt) => {
      pane.resumed.push(prompt)
      return pane.next
    },
    draw: (screen) => {
      pane.shown = screen
      for (const listener of listeners) listener()
    },
  }
  return pane
}

// The pane's turn ends as Cursor ends it: the stop hook runs in the pane, with its status.
function stop(pane: string, status: string, generation = 'gen-1'): unknown {
  const out = runHook(
    JSON.stringify({
      hook_event_name: 'stop',
      session_id: SESSION,
      generation_id: generation,
      status,
    }),
    { MENKAR_PANE: pane },
    { cache, turnEnds: join(cache, 'turn-ends'), state: join(cache, 'state.json'), held: root },
  )
  return out === '' ? null : (JSON.parse(out) as { followup_message: string }).followup_message
}

const files = (pane: string) =>
  existsSync(join(root, pane)) ? readdirSync(join(root, pane)).sort() : []

test('a wake for a session in a turn is held, and its completed turn hands it over as the followup', async () => {
  const wakes = new CursorWakes(() => root)
  const pane = paneOf('p1', WORKING)
  expect(await wakes.waker.wake(SESSION, 'menkar-t2 ended its turn', undefined, pane)).toBe(
    'posted',
  )
  expect(await wakes.waker.wake(SESSION, 'menkar-t3 is waiting', undefined, pane)).toBe('posted')
  expect(pane.resumed).toEqual([])
  expect(files('p1')).toHaveLength(2)
  const followup = String(stop('p1', 'completed'))
  expect(followup).toMatch(/^\[Menkar\] menkar-t2 ended its turn \([^)]*\)\n\n\[Menkar\] menkar-t3/)
  expect(wakes.held('p1')).toEqual([])
  expect(stop('p1', 'completed', 'gen-2')).toBeNull()
})

test('an interrupted turn leaves the wake held, and an empty box afterwards resumes the session with it', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const wakes = new CursorWakes(() => root)
  const pane = paneOf('p1', WORKING)
  await wakes.waker.wake(SESSION, 'menkar-t2 ended its turn', undefined, pane)
  expect(stop('p1', 'aborted')).toBeNull()
  expect(stop('p1', 'error')).toBeNull()
  // Ctrl+C put the prompt back in the box: not empty, so nothing happens
  pane.draw(`  Interrupted.\n\n  → Write a poem${FOOTER}`)
  await vi.advanceTimersByTimeAsync(SETTLE_MS)
  expect(pane.resumed).toEqual([])
  pane.draw(EMPTY)
  await vi.advanceTimersByTimeAsync(SETTLE_MS)
  expect(pane.resumed).toHaveLength(1)
  expect(pane.resumed[0]).toContain('[Menkar] menkar-t2 ended its turn')
})

test('an idle session with an empty box is resumed at once with every wake held for it', async () => {
  const wakes = new CursorWakes(() => root)
  const pane = paneOf('p1', CARD)
  await wakes.waker.wake(SESSION, 'first', undefined, pane)
  pane.shown = EMPTY
  await wakes.waker.wake(SESSION, 'second', undefined, pane)
  expect(pane.resumed).toHaveLength(1)
  expect(pane.resumed[0]).toMatch(/^\[Menkar\] first .*\n\n\[Menkar\] second /s)
  expect(existsSync(join(root, 'p1'))).toBe(false)
  expect(wakes.held('p1')).toEqual([])
})

test('a draft in the box is never lost: the wake waits, through any redraw, until the box is empty', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const wakes = new CursorWakes(() => root)
  const pane = paneOf('p1', DRAFT)
  await wakes.waker.wake(SESSION, 'menkar-t2 ended its turn', undefined, pane)
  for (const screen of [DRAFT, `${DRAFT} `, CARD, WORKING]) {
    pane.draw(screen)
    await vi.advanceTimersByTimeAsync(SETTLE_MS)
  }
  expect(pane.resumed).toEqual([])
  expect(files('p1')).toHaveLength(1)
  pane.draw(EMPTY)
  await vi.advanceTimersByTimeAsync(SETTLE_MS)
  expect(pane.resumed).toHaveLength(1)
})

test('a resume that does not happen keeps everything held, and the next stop hands it over', async () => {
  const wakes = new CursorWakes(() => root)
  const pane = paneOf('p1', EMPTY)
  pane.next = null
  await wakes.waker.wake(SESSION, 'menkar-t2 ended its turn', undefined, pane)
  expect(pane.resumed).toHaveLength(1)
  expect(files('p1')).toHaveLength(1)
  expect(String(stop('p1', 'completed'))).toContain('menkar-t2 ended its turn')
})

test('wakes that come while the session restarts wait for the new pane', async () => {
  const wakes = new CursorWakes(() => root)
  const pane = paneOf('p1', EMPTY)
  let finish: (id: string) => void = () => {}
  pane.resume = (prompt) => {
    pane.resumed.push(prompt)
    return new Promise((resolve) => {
      finish = resolve
    })
  }
  const first = wakes.waker.wake(SESSION, 'first', undefined, pane)
  await vi.waitFor(() => expect(pane.resumed).toHaveLength(1))
  expect(await wakes.waker.wake(SESSION, 'during', undefined, pane)).toBe('posted')
  wakes.waker.release?.('p1')
  finish('p2')
  await first
  expect(files('p1')).toEqual([])
  expect(String(stop('p2', 'completed'))).toContain('[Menkar] during')
})

test('a team update is only held: it never restarts a session, and goes with the next wake', async () => {
  const wakes = new CursorWakes(() => root)
  const delivered = vi.fn()
  const held = { pane: 'p1', delivered }
  expect(await wakes.teller.tell(SESSION, 'team update: old facts', undefined, null, held)).toBe(
    'held',
  )
  const later = vi.fn()
  await wakes.teller.tell(SESSION, 'team update: new facts', undefined, null, {
    pane: 'p1',
    delivered: later,
  })
  expect(files('p1')).toHaveLength(1)
  const pane = paneOf('p1', EMPTY)
  expect(pane.resumed).toEqual([])
  await wakes.waker.wake(SESSION, 'menkar-t2 ended its turn', undefined, pane)
  expect(pane.resumed).toHaveLength(1)
  expect(pane.resumed[0]).toMatch(/^\[Menkar\] team update: new facts .*\n\n\[Menkar\] menkar-t2/s)
  expect(delivered).not.toHaveBeenCalled()
  expect(later).toHaveBeenCalledOnce()
})

test('a held team update is counted handed over when the stop hook takes it, and a withdrawn one never goes', async () => {
  const wakes = new CursorWakes(() => root)
  const delivered = vi.fn()
  await wakes.teller.tell(SESSION, 'team update: facts', undefined, null, { pane: 'p1', delivered })
  expect(String(stop('p1', 'completed'))).toContain('team update: facts')
  // the folder's watch sees it gone
  await vi.waitFor(() => expect(delivered).toHaveBeenCalledOnce())

  const withdrawn = vi.fn()
  await wakes.teller.tell(SESSION, 'team update: again', undefined, null, {
    pane: 'p1',
    delivered: withdrawn,
  })
  wakes.teller.withdraw?.('p1')
  expect(stop('p1', 'completed', 'gen-2')).toBeNull()
  expect(withdrawn).not.toHaveBeenCalled()
})

test("a pane's end drops what was held for it; with no pane there is nowhere to hold", async () => {
  const wakes = new CursorWakes(() => root)
  await wakes.waker.wake(SESSION, 'menkar-t2 ended its turn', undefined, paneOf('p1', WORKING))
  wakes.waker.release?.('p1')
  expect(existsSync(join(root, 'p1'))).toBe(false)
  expect(wakes.held('p1')).toEqual([])
  expect(await wakes.waker.wake(SESSION, 'x', undefined)).toBe('no session')
  expect(await wakes.teller.tell(SESSION, 'x', undefined, null)).toBe('no session')
})

test('on Cursor’s free-requests limit screen, its refused prompt back in the box above the error, a wake is held and the session is not restarted', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const wakes = new CursorWakes(() => root)
  const pane = paneOf('p1', LIMIT)
  await wakes.waker.wake(SESSION, 'menkar-t2 ended its turn', undefined, pane)
  await wakes.waker.wake(SESSION, 'menkar-t3 is waiting', undefined, pane)
  for (let i = 0; i < 5; i++) {
    pane.draw(`${LIMIT} `)
    await vi.advanceTimersByTimeAsync(SETTLE_MS)
  }
  expect(pane.resumed).toEqual([])
  expect(files('p1')).toHaveLength(2)
})

test('a session whose resumed turns keep ending idle with an empty box is never restarted in a loop: each restart waits twice as long as the one before', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  const wakes = new CursorWakes(() => root)
  // Each restart gives a new pane, idle again at once.
  const resumes: string[] = []
  let pane = paneOf('p0', EMPTY)
  const follow = (p: FakePane) => {
    const resume = p.resume
    p.resume = async (prompt) => {
      resumes.push(prompt)
      const next = await resume(prompt)
      pane = follow(paneOf(String(next), EMPTY))
      return next
    }
    return p
  }
  pane = follow(pane)
  await wakes.waker.wake(SESSION, 'w1', undefined, pane)
  expect(resumes).toHaveLength(1)

  // A wake right after: held, its restart put off by the gap, then made by the timer.
  await wakes.waker.wake(SESSION, 'w2', undefined, pane)
  await wakes.waker.wake(SESSION, 'w3', undefined, pane)
  await vi.advanceTimersByTimeAsync(RESTART_GAP_MS - 1)
  expect(resumes).toHaveLength(1)
  await vi.advanceTimersByTimeAsync(1)
  expect(resumes).toHaveLength(2)
  expect(resumes[1]).toMatch(/w2 .*\n\n\[Menkar\] w3 /s)

  // The next waits twice as long, the one after four times.
  for (const gap of [2, 4].map((n) => n * RESTART_GAP_MS)) {
    const before = resumes.length
    await wakes.waker.wake(SESSION, `after ${gap}`, undefined, pane)
    await vi.advanceTimersByTimeAsync(gap - 1)
    expect(resumes).toHaveLength(before)
    await vi.advanceTimersByTimeAsync(1)
    expect(resumes).toHaveLength(before + 1)
  }
  // Many wakes in a burst make no more than one restart.
  const before = resumes.length
  for (let i = 0; i < 10; i++) await wakes.waker.wake(SESSION, `burst ${i}`, undefined, pane)
  for (let i = 0; i < 10; i++) {
    pane.draw(EMPTY)
    await vi.advanceTimersByTimeAsync(SETTLE_MS)
  }
  expect(resumes).toHaveLength(before)
  await vi.advanceTimersByTimeAsync(8 * RESTART_GAP_MS - 10 * SETTLE_MS)
  expect(resumes).toHaveLength(before + 1)

  // Left alone for four gaps, a session is restarted at once again.
  await vi.advanceTimersByTimeAsync(4 * RESTART_GAP_MAX_MS)
  await wakes.waker.wake(SESSION, 'much later', undefined, pane)
  expect(resumes).toHaveLength(before + 2)
})
