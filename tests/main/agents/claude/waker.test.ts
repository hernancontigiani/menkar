// §2.3 of the multi-agent architecture: waking a session is its main kit's concern. Claude's posts
// one line to the messaging socket Claude Code publishes for the session (its registry under
// ~/.claude/sessions); the frame is wakeFrame's, the bytes R10 holds. Cursor has no waker yet.
import { mkdirSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:net'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { wakeFrame } from '../../../../src/core/control/post'
import { mainKitOf } from '../../../../src/main/agents/registry'

const SESSION = '5c1e7a2b-0f3d-4e6a-8b9c-1d2e3f4a5b6c'
const home = join(process.env.MENKAR_TEST_ROOT ?? '', 'waker', 'home')
const registry = join(home, '.claude', 'sessions')
const socket = join(process.env.MENKAR_TEST_ROOT ?? '', 'waker', 'peer.sock')

const servers: Server[] = []
beforeEach(() => vi.stubEnv('HOME', home))
afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
  for (const s of servers.splice(0)) s.close()
})

function listen(): Promise<{ received: Promise<string> }> {
  let resolve: (data: string) => void = () => {}
  const received = new Promise<string>((r) => {
    resolve = r
  })
  const server = createServer((c) => {
    let data = ''
    c.on('data', (d) => {
      data += d
    })
    c.on('end', () => resolve(data))
  })
  servers.push(server)
  return new Promise((r) => server.listen(socket, () => r({ received })))
}

describe("Claude's waker", () => {
  test('posts wakeFrame’s bytes to the session’s socket, with the counts', async () => {
    mkdirSync(registry, { recursive: true })
    writeFileSync(
      join(registry, '4343.json'),
      JSON.stringify({
        pid: 4343,
        sessionId: SESSION,
        messagingSocketPath: socket,
        peerProtocol: 1,
      }),
    )
    const { received } = await listen()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 17, 9, 5, 7))
    const counts = { topics: 1, working: 2, waiting: 0 }
    const waker = mainKitOf('claude').waker
    expect(await waker?.wake(SESSION, '`worker` finished a turn.', counts)).toBe('posted')
    const frame = await received
    const id = JSON.parse(frame).msg_id as string
    expect(frame).toBe(wakeFrame('`worker` finished a turn.', id, counts))
  })

  test('a session with no socket in the registry is not posted to', async () => {
    mkdirSync(registry, { recursive: true })
    expect(await mainKitOf('claude').waker?.wake('no-such-session', 'hello', undefined)).toBe(
      'no session',
    )
  })

  test("Claude's team updates are told the same way", () => {
    expect(mainKitOf('claude').team?.tell).toBe(mainKitOf('claude').waker?.wake)
  })
})

describe("Cursor's waker", () => {
  test('there is none', () => {
    expect(mainKitOf('cursor').waker).toBeNull()
  })
})
