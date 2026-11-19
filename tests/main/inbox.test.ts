// Decision 1.188: while the human is away the orchestrator's inbox file carries it on every
// prompt, as a standing key that no delivery removes; it leaves the file only when they are back.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { INBOX_KEYS } from '../../src/core/context/statusline'
import { controlPaths } from '../../src/core/control/files'
import { inbox as claudeInbox } from '../../src/main/agents/claude/inbox'
import { Inboxes, type OrchestratorPane } from '../../src/main/inbox'
import { hookContext, jsonl } from '../factories/transcript'

const SINCE = Date.UTC(2026, 10, 19, 13, 5, 0)
const fileOf = (pane: string) => join(controlPaths().inbox, `${pane}.json`)
const read = (pane: string) => JSON.parse(readFileSync(fileOf(pane), 'utf8'))

describe("Claude's inbox file", () => {
  test('no entry and not away → no file; no entry and away → the file with away_since', async () => {
    await claudeInbox.publish('k1', 's1', 0, [], SINCE)
    expect(read('k1')).toEqual({ session_id: 's1', dropped: 0, entries: [], away_since: SINCE })
    await claudeInbox.publish('k1', 's1', 0, [], null)
    expect(existsSync(fileOf('k1'))).toBe(false)
    await claudeInbox.publish('k1', 's1', 0, [{ seq: 1, at: SINCE, text: 'a' }], null)
    expect(read('k1')).not.toHaveProperty('away_since')
  })

  test('parity: every key the kit writes is one the prompt hook reads', async () => {
    await claudeInbox.publish('k2', 's1', 1, [{ seq: 1, at: SINCE, text: 'a' }], SINCE)
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
