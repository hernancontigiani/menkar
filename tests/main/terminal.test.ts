// A line of Menkar's own in a pane's terminal: shown and kept for a replay as the program's output
// is, with the offsets a window replays from still right, and never written to the program. At a
// start it waits for the program's first screen. The pty is the one thing faked: a test cannot run
// node-pty's native module outside Electron.
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const fake = vi.hoisted(() => ({
  data: (_: string) => {},
  written: [] as string[],
}))

vi.mock('node-pty', () => ({
  spawn: () => ({
    pid: 1,
    process: 'bash',
    onData: (listener: (data: string) => void) => {
      fake.data = listener
    },
    onExit: () => {},
    write: (data: string) => fake.written.push(data),
    resize: () => {},
  }),
}))

const { Terminal } = await import('../../src/main/terminal')

let chunks: { data: string; end: number }[] = []
const make = () =>
  new Terminal(
    { cwd: null, cols: 80, rows: 24 },
    { data: (data, end) => chunks.push({ data, end }), exit: () => {} },
  )

beforeEach(() => {
  chunks = []
  fake.written = []
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

test('a said line is in the display and the replay, its offsets follow on, and the program never gets it', () => {
  const terminal = make()
  fake.data('hello ')
  terminal.say('[Menkar] a line')
  fake.data('world')
  expect(chunks).toEqual([
    { data: 'hello ', end: 6 },
    { data: '[Menkar] a line', end: 21 },
    { data: 'world', end: 26 },
  ])
  expect(terminal.buffer).toBe('hello [Menkar] a lineworld')
  expect(terminal.end).toBe(26)
  expect(fake.written).toEqual([])
})

test("at a start the line waits until the program's output has been quiet, or until the latest", () => {
  const terminal = make()
  terminal.sayWhenQuiet('LINE', 1_000, 30_000)
  fake.data('first screen')
  vi.advanceTimersByTime(900)
  fake.data('more of it')
  vi.advanceTimersByTime(900)
  expect(terminal.buffer).toBe('first screenmore of it')
  vi.advanceTimersByTime(100)
  expect(terminal.buffer).toBe('first screenmore of itLINE')
  // shown once
  vi.advanceTimersByTime(60_000)
  expect(terminal.buffer).toBe('first screenmore of itLINE')

  const busy = make()
  busy.sayWhenQuiet('LATE', 1_000, 3_000)
  for (let n = 0; n < 5; n += 1) {
    fake.data('.')
    vi.advanceTimersByTime(700)
  }
  expect(busy.buffer).toBe('.....LATE')
  expect(fake.written).toEqual([])
})
