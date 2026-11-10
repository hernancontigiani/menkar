// After a pty's hang-up nothing of its session may be left: what outlives the hang-up gets SIGCONT
// and SIGTERM after 3 s, what outlives that gets SIGKILL 2 s later, and each escalation is logged.
import { spawn } from 'node:child_process'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { addSink } from '../../src/core/log'
import {
  KILL_AFTER_MS,
  type Proc,
  parseStat,
  processes,
  reaping,
  reapSession,
  TERM_AFTER_MS,
} from '../../src/main/reap'

const proc = (pid: number, sid: number, state = 'S'): Proc => ({ pid, sid, state, tpgid: -1 })

let lines: string[] = []
let removeSink = () => {}
beforeEach(() => {
  lines = []
  removeSink = addSink((line) => lines.push(line))
})
afterEach(() => {
  removeSink()
  vi.useRealTimers()
})

test('/proc/<pid>/stat is read after the command name, whatever the name holds', () => {
  expect(parseStat(7, '7 (claude) S 1 7 40 34817 41 4194304 …')).toEqual({
    pid: 7,
    state: 'S',
    sid: 40,
    tpgid: 41,
  })
  expect(parseStat(8, '8 (a) b (c) ) T 1 8 40 0 -1 0')).toEqual({
    pid: 8,
    state: 'T',
    sid: 40,
    tpgid: -1,
  })
  expect(parseStat(9, 'garbage')).toBeNull()
})

test('a session that empties within the grace gets no signal', async () => {
  vi.useFakeTimers()
  let list = [proc(41, 40), proc(99, 98)]
  const kill = vi.fn()
  const done = reapSession(40, { list: () => list, kill })
  expect(reaping()).toBe(true)
  await vi.advanceTimersByTimeAsync(1000)
  list = [proc(99, 98)]
  await vi.advanceTimersByTimeAsync(500)
  await done
  expect(kill).not.toHaveBeenCalled()
  expect(reaping()).toBe(false)
})

test('survivors, a stopped one included, get SIGCONT and SIGTERM at 3 s, then SIGKILL at 5 s; other sessions and zombies are left alone; each is logged', async () => {
  vi.useFakeTimers()
  const list = [proc(41, 40), proc(42, 40, 'T'), proc(43, 40, 'Z'), proc(99, 98)]
  const sent: string[] = []
  const done = reapSession(40, {
    list: () => list,
    kill: (pid, signal) => void sent.push(`${pid} ${signal}`),
  })
  await vi.advanceTimersByTimeAsync(TERM_AFTER_MS - 200)
  expect(sent).toEqual([])
  await vi.advanceTimersByTimeAsync(400)
  expect(sent).toEqual(['41 SIGCONT', '41 SIGTERM', '42 SIGCONT', '42 SIGTERM'])
  await vi.advanceTimersByTimeAsync(KILL_AFTER_MS)
  await done
  expect(sent.slice(4)).toEqual(['41 SIGKILL', '42 SIGKILL'])
  const logged = lines.filter((l) => l.includes('outlived'))
  expect(logged).toHaveLength(4)
  expect(logged.some((l) => l.includes('42') && l.includes('SIGKILL') && l.includes('T'))).toBe(
    true,
  )
})

// A real process in a session of its own that ignores SIGHUP and SIGTERM, as a stuck agent would.
test.skipIf(process.platform !== 'linux')(
  'a real process that ignores SIGHUP and SIGTERM is gone after the two graces',
  async () => {
    const child = spawn(
      process.execPath,
      [
        '-e',
        "process.on('SIGHUP',()=>{});process.on('SIGTERM',()=>{});setInterval(()=>{},1000);console.log('ready')",
      ],
      { detached: true, stdio: ['ignore', 'pipe', 'ignore'] },
    )
    const pid = child.pid ?? 0
    await new Promise((resolve) => child.stdout?.once('data', resolve))
    await vi.waitUntil(() => processes().some((p) => p.pid === pid && p.sid === pid), {
      timeout: 3000,
    })
    process.kill(pid, 'SIGHUP')
    await reapSession(pid)
    await vi.waitUntil(() => !processes().some((p) => p.pid === pid && p.state !== 'Z'), {
      timeout: 2000,
    })
    expect(lines.some((l) => l.includes('SIGKILL') && l.includes(String(pid)))).toBe(true)
  },
  12_000,
)
