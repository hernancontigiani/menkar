// Plan 39 P3.2 (set, 2026-11-23, option b): a CLI that refuses the id a new session was started
// with says so once, at once, before its first screen; the start of the pane's output is read for
// it, the line possibly split across reads and coloured, and nothing later is.
import { afterEach, expect, test, vi } from 'vitest'
import {
  IdRefusal,
  REFUSAL_WINDOW_CHARS,
  REFUSAL_WINDOW_MS,
} from '../../../src/core/agents/refusal'
import { kitOf } from '../../../src/core/agents/registry'

const REFUSED = kitOf('cursor').ids.refused ?? /never/

afterEach(() => {
  vi.useRealTimers()
})

function watch() {
  const told = vi.fn()
  return { refusal: new IdRefusal(REFUSED, told), told }
}

test("Cursor's refusal of --new-session-id is told once, split across reads and coloured", () => {
  const { refusal, told } = watch()
  refusal.read('$ cursor-agent --new-session-id 1b4e… \r\n\x1b[31merror: unknown opt')
  expect(told).not.toHaveBeenCalled()
  refusal.read("ion '--new-session-id'\x1b[39m\r\n$ ")
  refusal.read("error: unknown option '--new-session-id'\r\n")
  expect(told).toHaveBeenCalledTimes(1)
})

test('another unknown option, or the TUI drawing, is not a refusal of the id', () => {
  const { refusal, told } = watch()
  refusal.read("error: unknown option '--bogus-flag'\r\n")
  refusal.read('  Cursor Agent\r\n  → Add a follow-up\r\n')
  expect(told).not.toHaveBeenCalled()
})

test('nothing is read after the window: a session that started talks about the option freely', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  const start = new Date('2026-11-23T23:59:50Z').getTime()
  vi.setSystemTime(start)
  const late = watch()
  vi.setSystemTime(start + REFUSAL_WINDOW_MS + 1)
  late.refusal.read("error: unknown option '--new-session-id'")
  expect(late.told).not.toHaveBeenCalled()
  const long = watch()
  long.refusal.read('x'.repeat(REFUSAL_WINDOW_CHARS + 1))
  long.refusal.read("error: unknown option '--new-session-id'")
  expect(long.told).not.toHaveBeenCalled()
})

test('only Cursor takes its id through an option it may drop', () => {
  expect(kitOf('cursor').ids.refused).toBeInstanceOf(RegExp)
  for (const id of ['claude', 'codex', 'opencode'] as const)
    expect(kitOf(id).ids.refused).toBeUndefined()
})
