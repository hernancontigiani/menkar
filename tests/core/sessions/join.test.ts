import { describe, expect, it } from 'vitest'
import type { SessionInfo } from '../../../src/core/sessions/info'
import { lookUp, type Pending, UNKNOWN_ID_TRIES } from '../../../src/core/sessions/join'

const session = (over: Partial<SessionInfo>): SessionInfo =>
  ({
    agent: 'claude',
    id: 'id',
    name: 'n',
    claudeNamed: false,
    file: '/f.jsonl',
    folder: '-w',
    cwd: '/w',
    preview: '',
    badge: null,
    mtimeMs: 0,
    size: 0,
    hidden: false,
    ...over,
  }) as SessionInfo

const STARTED = 1_000_000

describe('a started tab waiting for its transcript', () => {
  it('TRM-19 a new session waits however long it takes, and joins after its first typed message', () => {
    let pending: Pending = {
      startedIn: 'p',
      expectedId: 'new-id',
      folder: '/w',
      startedAt: STARTED,
      tries: 0,
    }
    // Ten minutes at one lookup per 1.5 s, with the transcript not yet written, then written
    // without a typed message.
    for (let i = 0; i < 400; i += 1) {
      const result = lookUp(pending, i < 399 ? [] : [session({ id: 'new-id', preview: '' })])
      expect(result.kind).toBe('waiting')
      if (result.kind === 'waiting') pending = result.pending
    }
    expect(lookUp(pending, [session({ id: 'new-id', preview: 'hello' })])).toEqual({
      kind: 'joined',
      sessionId: 'new-id',
    })
  })

  it('TRM-20 Continue last with no transcript stops looking after 120 lookups', () => {
    let pending: Pending = {
      startedIn: 'p',
      expectedId: null,
      folder: '/w',
      startedAt: STARTED,
      tries: 0,
    }
    // Another folder's session, and an older one in the same folder, never match.
    const others = [
      session({ id: 'elsewhere', cwd: '/other', preview: 'x', mtimeMs: STARTED + 5 }),
      session({ id: 'older', cwd: '/w', preview: 'x', mtimeMs: STARTED - 5000 }),
    ]
    for (let i = 1; i < UNKNOWN_ID_TRIES; i += 1) {
      const result = lookUp(pending, others)
      expect(result.kind).toBe('waiting')
      if (result.kind === 'waiting') pending = result.pending
    }
    expect(UNKNOWN_ID_TRIES).toBe(120)
    expect(lookUp(pending, others)).toEqual({ kind: 'gaveUp' })
  })

  it('TRM-20 Continue last joins the newest typed session of its folder started since', () => {
    const pending: Pending = {
      startedIn: 'p',
      expectedId: null,
      folder: '/w',
      startedAt: STARTED,
      tries: 3,
    }
    expect(
      lookUp(pending, [
        session({ id: 'a', preview: 'x', mtimeMs: STARTED + 10 }),
        session({ id: 'b', preview: 'x', mtimeMs: STARTED + 20 }),
      ]),
    ).toEqual({ kind: 'joined', sessionId: 'b' })
  })
})
