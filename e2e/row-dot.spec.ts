import { expect, test } from '@playwright/test'
import { launchApp } from './app'
import { clientWork } from './fixtures'

// The state of a pane is pushed when it changes; a new session's pane changes to working before it
// joins its id, so the join itself must push again, or the row stays idle until the turn ends.
test('a session started from New shows working on its row during its first turn', async () => {
  const launched = await launchApp({
    prepare: (dirs) => ({ ...clientWork(dirs), FAKE_CLAUDE_QUIET: '1' }),
  })
  const page = launched.window
  try {
    await page.locator('#strip-plus').click()
    await page.locator('.add-session input').first().fill('api')
    await page.locator('.add-session input').first().press('Enter')
    await page.locator('.add-session .form-row input').fill('fresh')
    await page.locator('.add-session .form-row input').press('Enter')
    await expect(page.locator('.tab.selected')).toHaveText(/fresh/)
    await expect(page.locator('.xterm-rows:visible')).toContainText('stand-in claude ready')
    await page.locator('.xterm:visible').click()
    await page.keyboard.type('FIRSTWORK')
    const row = page.locator('#session-list .row', { hasText: 'fresh' })
    await expect(row).toHaveCount(1, { timeout: 5_000 })
    // The stand-in stays working eight seconds; without a push at the join it shows idle till then.
    await expect(row.locator('.dot')).toHaveClass(/working/, { timeout: 2_000 })
  } finally {
    await launched.close()
  }
})
