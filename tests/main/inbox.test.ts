// Decision 1.188: while the human is away the orchestrator's inbox file carries it on every
// prompt, as a standing key that no delivery removes; it leaves the file only when they are back.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { INBOX_KEYS } from '../../src/core/context/statusline'
import { controlPaths } from '../../src/core/control/files'
import { inbox as claudeInbox } from '../../src/main/agents/claude/inbox'
import { Inboxes, type OrchestratorPane } from '../../src/main/inbox'
import { assistant, hookContext, jsonl, sendMessage } from '../factories/transcript'

const SINCE = Date.UTC(2026, 10, 19, 13, 5, 0)
const fileOf = (pane: string) => join(controlPaths().inbox, `${pane}.json`)
const read = (pane: string) => JSON.parse(readFileSync(fileOf(pane), 'utf8'))

describe("Claude's inbox file", () => {
  test('no entry and not away → no file; no entry and away → the file with away_since', async () => {
    await claudeInbox.publish('k1', 's1', 0, [], SINCE, [])
    expect(read('k1')).toEqual({ session_id: 's1', dropped: 0, entries: [], away_since: SINCE })
    await claudeInbox.publish('k1', 's1', 0, [], null, [])
    expect(existsSync(fileOf('k1'))).toBe(false)
    await claudeInbox.publish('k1', 's1', 0, [{ seq: 1, at: SINCE, text: 'a' }], null, [])
    expect(read('k1')).not.toHaveProperty('away_since')
    expect(read('k1')).not.toHaveProperty('standing')
    await claudeInbox.publish('k1', 's1', 0, [], null, ['a line'])
    expect(read('k1')).toEqual({ session_id: 's1', dropped: 0, entries: [], standing: ['a line'] })
  })

  test('parity: every key the kit writes is one the prompt hook reads', async () => {
    await claudeInbox.publish('k2', 's1', 1, [{ seq: 1, at: SINCE, text: 'a' }], SINCE, ['x'])
    expect(Object.keys(read('k2')).sort()).toEqual([...INBOX_KEYS].sort())
  })
})

describe('the inboxes while away', () => {
  function setup(pane: string) {
    const transcript = join(process.env.MENKAR_TEST_ROOT ?? '', `${pane}.jsonl`)
    writeFileSync(transcript, '')
    let where: OrchestratorPane = { pane, sessionId: 's1', transcript, kit: claudeInbox }
    const inboxes = new Inboxes(() => new Map([['p1', where]]))
    const flush = () => inboxes.read('p1', () => null)
    return {
      inboxes,
      flush,
      transcript,
      moveTo: (next: string) => {
        where = { ...where, pane: next }
      },
    }
  }

  test('setAway with an empty inbox writes the file with the time; back removes it', async () => {
    const { inboxes, flush } = setup('a1')
    await flush()
    expect(existsSync(fileOf('a1'))).toBe(false)
    inboxes.setAway(SINCE)
    await flush()
    expect(read('a1')).toMatchObject({ entries: [], away_since: SINCE })
    inboxes.setAway(null)
    await flush()
    expect(existsSync(fileOf('a1'))).toBe(false)
  })

  test('a delivery confirmed while away keeps the time in the file', async () => {
    const { inboxes, flush, transcript } = setup('a2')
    await flush()
    inboxes.setAway(SINCE)
    inboxes.add('p1', 'presence', 'The human is away')
    await flush()
    const seq = read('a2').entries[0].seq
    appendFileSync(transcript, jsonl([hookContext(`Menkar's inbox (events ${seq}–${seq}): x`)]))
    inboxes.paneTurned('a2')
    await flush()
    expect(read('a2')).toMatchObject({ entries: [], away_since: SINCE })
  })

  test('the mark moving, or the orchestrator to another pane, keeps it', async () => {
    const { inboxes, flush, moveTo } = setup('a3')
    inboxes.setAway(SINCE)
    await flush()
    inboxes.moved('p1')
    await flush()
    expect(read('a3')).toMatchObject({ away_since: SINCE })
    moveTo('a4')
    inboxes.sync()
    await flush()
    expect(existsSync(fileOf('a3'))).toBe(false)
    expect(read('a4')).toMatchObject({ away_since: SINCE })
  })
})

// Decision 1.217: the orchestrator is told, on every prompt, of each session it sent work to that
// has no open task, until that session gets one or stops running. Consultants answer freely.
describe('the sends line', () => {
  const LINE = 'You sent work to w1, which has no open task: give it one with task_add.'
  function setup(pane: string) {
    const transcript = join(process.env.MENKAR_TEST_ROOT ?? '', `${pane}.jsonl`)
    writeFileSync(transcript, '')
    const where: OrchestratorPane = { pane, sessionId: 's1', transcript, kit: claudeInbox }
    const state = { tasked: new Set<string>(), running: new Set(['id-w1', 'id-c1']) }
    const inboxes = new Inboxes(() => new Map([['p1', where]]), {
      resolve: (_, name) => (name === 'w1' ? 'id-w1' : null),
      deps: () => ({
        hasOpenTask: (id) => state.tasked.has(id),
        running: (id) => state.running.has(id),
        name: (id) => id.replace('id-', ''),
      }),
    })
    const flush = () => inboxes.read('p1', () => null)
    const send = (to: string, id: string) => {
      appendFileSync(transcript, jsonl([assistant([sendMessage(to, id)])]))
      inboxes.paneTurned(pane)
    }
    return { inboxes, flush, send, state }
  }

  test('a SendMessage to a worker with no open task → the line, until it gets one', async () => {
    const { inboxes, flush, send, state } = setup('s1p')
    await flush()
    send('w1 [abc123]', 't1')
    await flush()
    expect(read('s1p')).toMatchObject({ entries: [], standing: [LINE] })
    await flush()
    expect(read('s1p').standing).toEqual([LINE])
    state.tasked.add('id-w1')
    inboxes.standingMayChange()
    await flush()
    expect(existsSync(fileOf('s1p'))).toBe(false)
    // Once forgotten, a task closing does not bring it back: only a new send does.
    state.tasked.delete('id-w1')
    inboxes.standingMayChange()
    await flush()
    expect(existsSync(fileOf('s1p'))).toBe(false)
  })

  test('a send to a session that is not one work goes to → no line', async () => {
    const { flush, send } = setup('s2p')
    await flush()
    send('c1', 't2')
    await flush()
    expect(existsSync(fileOf('s2p'))).toBe(false)
  })

  test("Menkar's send_message counts; the session stopping drops the line", async () => {
    const { inboxes, flush, state } = setup('s3p')
    await flush()
    inboxes.sentTo('p1', 'id-w1')
    await flush()
    expect(read('s3p').standing).toEqual([LINE])
    state.running.delete('id-w1')
    inboxes.sync()
    await flush()
    expect(existsSync(fileOf('s3p'))).toBe(false)
  })
})
