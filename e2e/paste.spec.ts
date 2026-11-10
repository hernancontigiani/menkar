// Pasting into an agent's terminal: Ctrl+Shift+V and the menu's Paste send the clipboard once;
// plain Ctrl+V reaches the agent as its own key (Claude Code pastes an image with it).
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { launchApp } from './app'
import { prepare } from './fixtures'

test('Ctrl+Shift+V and the menu’s Paste send the clipboard to the agent once; Ctrl+V sends the agent its own ^V and no text', async () => {
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      return prepare(dirs)
    },
  })
  const { app, window: page } = launched
  const input = join(home, 'claude-input.txt')
  // What the agent read, as text, every read joined.
  const received = () =>
    existsSync(input)
      ? readFileSync(input, 'utf8')
          .trim()
          .split('\n')
          .map((hex) => Buffer.from(hex, 'hex').toString())
          .join('')
      : ''
  try {
    await page.locator('.row', { hasText: 'fix the login bug' }).dblclick()
    await expect(page.locator('.xterm-rows')).toContainText('stand-in claude ready')
    await page.locator('.xterm').click()
    await app.evaluate(({ clipboard }) => clipboard.writeText('PASTE-ONCE'))

    await page.keyboard.press('Control+Shift+V')
    await expect.poll(received).toContain('PASTE-ONCE')
    await page.waitForTimeout(500)
    expect(received()).toBe('PASTE-ONCE')

    await page.locator('.xterm').click({ button: 'right' })
    await page.locator('.menu-item', { hasText: 'Paste' }).click()
    await expect.poll(received).toBe('PASTE-ONCEPASTE-ONCE')
    await page.waitForTimeout(500)
    expect(received()).toBe('PASTE-ONCEPASTE-ONCE')

    await page.keyboard.press('Control+v')
    await expect.poll(received).toBe('PASTE-ONCEPASTE-ONCE\x16')
    await page.waitForTimeout(500)
    expect(received()).toBe('PASTE-ONCEPASTE-ONCE\x16')
  } finally {
    await launched.close()
  }
})
