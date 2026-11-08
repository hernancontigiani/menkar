// The headless copy of a pane's terminal that states are read from.
import { expect, test } from 'vitest'
import { detectState } from '../../../src/core/agentstate/detect'
import { ScreenMirror } from '../../../src/core/agentstate/mirror'

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
