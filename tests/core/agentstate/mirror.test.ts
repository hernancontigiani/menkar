// The headless copy of a pane's terminal that states are read from.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { AGENT_IDS } from '../../../src/core/agents/ids'
import { detectState, type RawState, readingOf } from '../../../src/core/agentstate/detect'
import { ScreenMirror } from '../../../src/core/agentstate/mirror'
import { PaneWatcher } from '../../../src/core/agentstate/watch'

test('the mirror parses the title the agent sets', async () => {
  const mirror = new ScreenMirror(40, 5)
  mirror.write('\x1b]0;⠋ Fixing tests\x07')
  await mirror.flush()
  expect(mirror.title()).toBe('⠋ Fixing tests')
  mirror.write('\x1b]2;✳ Ready\x07')
  await mirror.flush()
  expect(mirror.title()).toBe('✳ Ready')
  mirror.dispose()
})

test('the screen is the rows of one terminal height ending at the cursor, wrapped rows joined', async () => {
  const mirror = new ScreenMirror(10, 3)
  mirror.write('one\r\ntwo\r\nthree\r\nfour 567890abc\r\nfive')
  await mirror.flush()
  // rows: one, two, three, "four 56789", "0abc" (wrapped), five — cursor on row 5, height 3
  expect(mirror.screen()).toBe('three\nfour 567890abc\nfive')
  mirror.dispose()
})

test('a question drawn with cursor moves reads as blocked from the mirror', async () => {
  const mirror = new ScreenMirror(60, 10)
  mirror.write('\x1b]0;⠋ Working\x07')
  mirror.write('Bash(npm test)\r\n\r\n Do you want to proceed?\r\n ❯ 1. Yes\r\n   2. No\r\n')
  mirror.write('\x1b[2A\x1b[3C') // the cursor goes back up into the menu
  await mirror.flush()
  expect(detectState('claude', mirror.title(), mirror.screen())).toBe('blocked')
  mirror.dispose()
})

test('the mirror reports a change after bytes are parsed and after a title', async () => {
  const mirror = new ScreenMirror(20, 3)
  let changes = 0
  mirror.onChange(() => {
    changes += 1
  })
  mirror.write('hello')
  await mirror.flush()
  const afterText = changes
  expect(afterText).toBeGreaterThan(0)
  mirror.write('\x1b]0;t\x07')
  await mirror.flush()
  expect(changes).toBeGreaterThan(afterText)
  mirror.dispose()
})

test('the whole screen is every visible row, whatever row the cursor is on', async () => {
  const mirror = new ScreenMirror(10, 4)
  mirror.write('zero\r\none\r\ntwo\r\nthree 67890ab\x1b[1;3H')
  await mirror.flush()
  // "zero" scrolled off; one, two, "three 6789", "0ab" (wrapped) on screen, the cursor on "one"
  expect(mirror.screen('toCursor')).toBe('zero\none')
  expect(mirror.screen('wholeScreen')).toBe('one\ntwo\nthree 67890ab')
  mirror.dispose()
})

// The default stays the cursor's: the other agents' line counts were tuned on it.
test('each agent reads its screen as its rules were measured', () => {
  expect(Object.fromEntries(AGENT_IDS.map((id) => [id, readingOf(id)]))).toEqual({
    claude: 'toCursor',
    cursor: 'toCursor',
    codex: 'toCursor',
    opencode: 'wholeScreen',
  })
  expect(readingOf('an-unknown-agent')).toBe('toCursor')
})

// OpenCode 2.3.0's own output in a 120x47 pty, recorded from a prompt until its card had been up
// for about 3 s: its hidden cursor stays on the running tool's spinner row, or the tab strip's.
test.each([
  ['the permission card', 'permission-card.bin'],
  ['the question card', 'question-card.bin'],
])("OpenCode's %s, from its real bytes, reads as blocked", async (_, file) => {
  const mirror = new ScreenMirror(120, 47)
  mirror.write(readFileSync(join(import.meta.dirname, '../../data/agents/opencode/pty', file)))
  await mirror.flush()
  expect(detectState('opencode', mirror.title(), mirror.screen(readingOf('opencode')))).toBe(
    'blocked',
  )
  mirror.dispose()
})

test("the pane's watcher reads the screen as the pane's agent does", async () => {
  const mirror = new ScreenMirror(120, 47)
  mirror.write(
    readFileSync(join(import.meta.dirname, '../../data/agents/opencode/pty/permission-card.bin')),
  )
  await mirror.flush()
  const reports: RawState[] = []
  const pane = { provider: 'opencode', mirror, foreground: () => true, serverRunning: () => true }
  const watcher = new PaneWatcher(pane, (raw) => reports.push(raw))
  watcher.check()
  expect(reports).toEqual(['blocked'])
  watcher.dispose()
  mirror.dispose()
})
