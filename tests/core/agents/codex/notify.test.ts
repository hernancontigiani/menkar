// Codex's notify program (§2.9 of the multi-agent architecture): at each turn's end it writes the
// pane's turn-end record, only for a thread whose rollout exists — Codex's title generation
// notifies for a thread of its own that never has one — and then runs the user's own `notify`
// (D6), which Menkar's `-c notify` replaced, with the argument Codex gave.
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { afterEach, expect, test, vi } from 'vitest'
import { parseArgs, runNotify } from '../../../../src/core/agents/codex/notify'
import { kitOf } from '../../../../src/core/agents/registry'
import { parseTurnEnd } from '../../../../src/core/agents/shared/turn-end'

const DATA = join(import.meta.dirname, '..', '..', '..', 'data', 'agents', 'codex')
const SESSIONS = join(DATA, 'home', '.codex', 'sessions')
const TURN = readFileSync(join(DATA, 'notify', 'turn.json'), 'utf8')
const TITLE = readFileSync(join(DATA, 'notify', 'title.json'), 'utf8')

const temp = () => mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', 'codex-notify-'))

afterEach(() => vi.unstubAllEnvs())

test("a turn of a thread with a rollout leaves the pane's record, naming the thread", async () => {
  const turnEnds = join(temp(), 'turn-ends')
  await runNotify(['--pane', 'p1', '--chain-file', join(temp(), 'none.json'), TURN], {
    sessions: SESSIONS,
    turnEnds,
  })
  const record = parseTurnEnd(readFileSync(join(turnEnds, 'p1.json'), 'utf8'))
  expect(record?.sessionId).toBe(JSON.parse(TURN)['thread-id'])
})

test('the title thread, which has no rollout, leaves no record', async () => {
  const turnEnds = join(temp(), 'turn-ends')
  await runNotify(['--pane', 'p1', '--chain-file', join(temp(), 'none.json'), TITLE], {
    sessions: SESSIONS,
    turnEnds,
  })
  expect(existsSync(turnEnds) ? readdirSync(turnEnds) : []).toEqual([])
})

test("D6: the user's notify from config.toml runs with its own words and Codex's argument", async () => {
  const home = temp()
  const out = join(home, 'chained.txt')
  const program = join(home, 'user-notify.sh')
  writeFileSync(program, `#!/bin/sh\nprintf '%s\\n' "$@" > '${out}'\n`)
  chmodSync(program, 0o755)
  writeFileSync(join(home, 'config.toml'), `notify = [${JSON.stringify(program)}, "extra"]\n`)
  vi.stubEnv('CODEX_HOME', home)
  // The chain file as the Launcher writes it for the pane.
  const plan = kitOf('codex').launch.plan(
    { kind: 'new' },
    {
      cli: 'codex',
      env: { MENKAR_PANE: 'p1' },
      execPath: '/e',
      programs: '/p',
      paneFiles: home,
    },
  )
  const file = plan.files?.[0]
  if (!file) throw new Error('the Launcher wrote no chain file')
  writeFileSync(file.path, await file.text())

  await runNotify(['--pane', 'p1', '--chain-file', file.path, TITLE], {
    sessions: SESSIONS,
    turnEnds: join(home, 'turn-ends'),
  })
  await vi.waitFor(() => expect(existsSync(out) && readFileSync(out, 'utf8')).toBeTruthy())
  expect(readFileSync(out, 'utf8')).toBe(`extra\n${TITLE}\n`)
})

test('no chain file, or a program that is not there, still leaves the record', async () => {
  const dir = temp()
  const chain = join(dir, 'chain.json')
  writeFileSync(chain, JSON.stringify([join(dir, 'missing-program')]))
  for (const file of [chain, join(dir, 'none.json')]) {
    const turnEnds = join(dir, `turn-ends-${readdirSync(dir).length}`)
    await runNotify(['--pane', 'p2', '--chain-file', file, TURN], { sessions: SESSIONS, turnEnds })
    expect(readdirSync(turnEnds)).toEqual(['p2.json'])
  }
})

test("Codex's argument is the last word, after Menkar's own", () => {
  expect(parseArgs(['--pane', 'p1', '--chain-file', '/c.json', '{"a":1}'])).toEqual({
    pane: 'p1',
    chainFile: '/c.json',
    payload: '{"a":1}',
  })
  expect(parseArgs(['--pane', 'p1']).payload).toBeNull()
})
