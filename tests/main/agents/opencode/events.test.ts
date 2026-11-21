// What Menkar reads of its OpenCode server's events (measured on v2.3.0): a subagent runs in a
// session of its own whose parent's execution ends while it works and starts again when it is
// done, so a root counts as running while anything under it does, and its turn ends only when
// nothing under it runs.
import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  Executions,
  parseFrame,
  SETTLE_MS,
  type ServerEvent,
} from '../../../../src/main/agents/opencode/events'

const event = (type: string, sessionId: string, parentId: string | null = null): ServerEvent => ({
  type,
  sessionId,
  parentId,
})
const started = (id: string) => event('session.execution.started', id)
const succeeded = (id: string) => event('session.execution.succeeded', id)

function executions() {
  const ended: string[] = []
  const changed: string[] = []
  const runs = new Executions({
    turnEnded: (root) => ended.push(root),
    changed: (root) => changed.push(root),
  })
  return { runs, ended, changed }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('a frame of the stream', () => {
  test('gives its type, its session and a created session’s parent; a heartbeat gives nothing', () => {
    expect(
      parseFrame(
        'data: {"id":"evt_1","type":"session.created","data":{"sessionID":"ses_c","parentID":"ses_r"}}',
      ),
    ).toEqual({ type: 'session.created', sessionId: 'ses_c', parentId: 'ses_r' })
    expect(parseFrame('data: {"id":"evt_0","type":"server.connected","data":{}}')).toEqual({
      type: 'server.connected',
      sessionId: null,
      parentId: null,
    })
    expect(parseFrame(': heartbeat')).toBeNull()
    expect(parseFrame('data: {"type":')).toBeNull()
  })
})

describe("a session's executions", () => {
  test("a root's own execution is its turn, which ends with it", () => {
    const { runs, ended } = executions()
    runs.see(started('ses_r'))
    expect(runs.runningUnder('ses_r')).toBe(true)
    runs.see(succeeded('ses_r'))
    expect(runs.runningUnder('ses_r')).toBe(false)
    expect(ended).toEqual(['ses_r'])
  })

  test('a root waiting on its subagent runs, and its turn ends after the subagent and its own last execution', () => {
    vi.useFakeTimers()
    const { runs, ended, changed } = executions()
    runs.see(started('ses_r'))
    runs.see(event('session.created', 'ses_c', 'ses_r'))
    runs.see(started('ses_c'))
    // OpenCode ends the parent's execution before its child's.
    runs.see(succeeded('ses_r'))
    expect(runs.runningUnder('ses_r')).toBe(true)
    expect(ended).toEqual([])
    runs.see(succeeded('ses_c'))
    // The parent starts again at once with the child's report.
    runs.see(started('ses_r'))
    vi.advanceTimersByTime(SETTLE_MS)
    expect(ended).toEqual([])
    runs.see(succeeded('ses_r'))
    expect(ended).toEqual(['ses_r'])
    expect(new Set(changed)).toEqual(new Set(['ses_r']))
  })

  test("a subagent's end with no execution of its root after it ends the root's turn once settled", () => {
    vi.useFakeTimers()
    const { runs, ended } = executions()
    runs.see(event('session.created', 'ses_c', 'ses_r'))
    runs.see(event('session.created', 'ses_g', 'ses_c'))
    runs.see(started('ses_g'))
    expect(runs.rootOf('ses_g')).toBe('ses_r')
    expect(runs.runningUnder('ses_r')).toBe(true)
    runs.see(event('session.execution.failed', 'ses_g'))
    expect(ended).toEqual([])
    vi.advanceTimersByTime(SETTLE_MS)
    expect(ended).toEqual(['ses_r'])
  })

  test('a server that ended runs nothing any more, and says so for each root it ran', () => {
    const { runs, changed } = executions()
    runs.see(started('ses_a'))
    runs.see(started('ses_b'))
    changed.length = 0
    runs.clear()
    expect(runs.runningUnder('ses_a')).toBe(false)
    expect(changed.sort()).toEqual(['ses_a', 'ses_b'])
  })
})
