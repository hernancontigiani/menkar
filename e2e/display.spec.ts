// Each worker draws on an X server of its own, never on the one `xvfb-run` set for the whole run,
// and the app has no session bus to reach the developer's desktop with.
import { expect, test } from '@playwright/test'
import { launchApp } from './app'
import { displays } from './display'

test("the app draws on its worker's own X display, not xvfb-run's, and has no session bus", async () => {
  const launched = await launchApp()
  try {
    const { outer, own } = displays()
    expect(outer).not.toBeNull()
    expect(own).toMatch(/^:1\d\d$/)
    expect(own).not.toBe(outer)
    const env = await launched.app.evaluate(() => ({
      display: process.env.DISPLAY ?? null,
      bus: process.env.DBUS_SESSION_BUS_ADDRESS ?? null,
    }))
    expect(env.display).toBe(own)
    // With no bus given, Chromium marks it disabled itself; either way none is reachable.
    expect([null, 'disabled:']).toContain(env.bus)
  } finally {
    await launched.close()
  }
})
