// Menkar wakes a parent by posting one line to the messaging socket Claude
// Code publishes for the session; the frame is the one measured on Claude Code 2.1.322.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { postToSession, wakeFrame } from '../../../src/core/control/post'

const servers: Server[] = []
afterEach(() => {
  vi.useRealTimers()
  for (const s of servers.splice(0)) s.close()
})

function registry(entry: Record<string, unknown>): { sessions: string; socket: string } {
  const root = mkdtempSync(join(tmpdir(), 'menkar-post-'))
  const sessions = join(root, 'sessions')
  mkdirSync(sessions)
  const socket = join(root, 'peer.sock')
  writeFileSync(join(sessions, '4242.json'), JSON.stringify({ pid: 4242, sessionId: 'other' }))
  writeFileSync(
    join(sessions, '4343.json'),
    JSON.stringify({ pid: 4343, messagingSocketPath: socket, ...entry }),
  )
  // Claude Code's per-session key file sits beside: not a registry entry.
  writeFileSync(join(sessions, '4343.abc.key'), '{}')
  return { sessions, socket }
}

function listen(socket: string): Promise<{ lines: () => string; closed: Promise<void> }> {
  let data = ''
  let closed: () => void = () => {}
  const done = new Promise<void>((resolve) => {
    closed = resolve
  })
  const server = createServer((c) => {
    c.on('data', (d) => {
      data += d
    })
    c.on('end', () => closed())
  })
  servers.push(server)
  return new Promise((resolve) =>
    server.listen(socket, () => resolve({ lines: () => data, closed: done })),
  )
}

describe('posting to a session', () => {
  test('the frame is the measured one line, the local time closing the text', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 13, 14, 32, 5))
    expect(wakeFrame('api finished its turn', 'm-1')).toBe(
      '{"type":"user","message":{"content":"[Menkar] api finished its turn (14:32:05)"},"from":"menkar","msg_id":"m-1"}\n',
    )
  })

  // Claude Code drops a message identical to the sender's previous one: a child that finishes two
  // turns in a row would wake its parent once.
  test('two identical events in a row are two different texts, across midnight too', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const content = (frame: string) => JSON.parse(frame).message.content as string
    vi.setSystemTime(new Date(2026, 10, 12, 23, 59, 59))
    const first = content(wakeFrame('b1 finished its turn', 'm-1'))
    vi.setSystemTime(new Date(2026, 10, 13, 0, 0, 0))
    const second = content(wakeFrame('b1 finished its turn', 'm-2'))
    expect(first).toBe('[Menkar] b1 finished its turn (23:59:59)')
    expect(second).toBe('[Menkar] b1 finished its turn (00:00:00)')
  })

  test('the session’s socket receives exactly one line, and the client closes', async () => {
    const { sessions, socket } = registry({ sessionId: 'parent', peerProtocol: 1 })
    const peer = await listen(socket)
    expect(await postToSession(sessions, 'parent', 'api finished its turn', 'm-2')).toBe('posted')
    await peer.closed
    expect(peer.lines()).toBe(wakeFrame('api finished its turn', 'm-2'))
  })

  test('another protocol, or no running session, posts nothing', async () => {
    const { sessions, socket } = registry({ sessionId: 'parent', peerProtocol: 2 })
    const peer = await listen(socket)
    expect(await postToSession(sessions, 'parent', 'x', 'm-3')).toBe('protocol')
    expect(await postToSession(sessions, 'nobody', 'x', 'm-4')).toBe('no session')
    expect(peer.lines()).toBe('')
  })
})
