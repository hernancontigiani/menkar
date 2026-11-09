// The desktop notifications an agent raised, closed once the user has looked at the pane: the dock
// counts what is still in the tray (decision of 2026-11-09, the human's "3" on the icon).
import { expect, test } from 'vitest'
import { NotificationTray } from '../../../src/core/agentstate/tray'

class Fake {
  closed = 0
  close(): void {
    this.closed += 1
  }
}

test('a done notification is closed once its pane is seen', () => {
  const tray = new NotificationTray<Fake>()
  const done = new Fake()
  tray.show('session-a', done)
  tray.seen('session-a')
  expect(done.closed).toBe(1)
  expect(tray.size).toBe(0)
})

test('one not yet seen stays in the tray, and another session is left alone', () => {
  const tray = new NotificationTray<Fake>()
  const a = new Fake()
  const b = new Fake()
  tray.show('session-a', a)
  tray.show('session-b', b)
  tray.seen('session-b')
  expect([a.closed, b.closed]).toEqual([0, 1])
  expect(tray.size).toBe(1)
})

test('a second state for the same session replaces the first', () => {
  const tray = new NotificationTray<Fake>()
  const first = new Fake()
  const second = new Fake()
  tray.show('session-a', first)
  tray.show('session-a', second)
  expect([first.closed, second.closed]).toEqual([1, 0])
  expect(tray.size).toBe(1)
})

test('quitting closes every one still shown, once', () => {
  const tray = new NotificationTray<Fake>()
  const shown = [new Fake(), new Fake()]
  tray.show('session-a', shown[0] as Fake)
  tray.show('session-b', shown[1] as Fake)
  tray.closeAll()
  tray.seen('session-a')
  expect(shown.map((n) => n.closed)).toEqual([1, 1])
  expect(tray.size).toBe(0)
})
