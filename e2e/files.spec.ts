import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { launchApp, savedCursorTab } from './app'

let home = ''
let root = ''

const NOTES = '# Notes\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n~~old~~\n\n<script>alert(1)</script>\n'

function withFiles(dirs: { readonly root: string; readonly home: string }): Record<string, string> {
  home = dirs.home
  root = dirs.root
  const env = savedCursorTab(dirs, { color_scheme: 'dark' })
  writeFileSync(join(dirs.home, 'notes.md'), NOTES)
  mkdirSync(join(dirs.home, '.claude'), { recursive: true })
  writeFileSync(join(dirs.home, '.claude', 'settings.json'), '{"theme":"dark"}\n')
  return env
}

async function openTyped(page: Page, input: string): Promise<void> {
  await page.locator('.xterm').first().click()
  await page.keyboard.press('Control+Shift+O')
  await expect(page.locator('.open-file')).toBeVisible()
  await page.locator('.open-file input').fill(input)
  await page.locator('.open-file input').press('Enter')
}

test('FIL-1, FIL-2, FIL-8 Ctrl+Shift+O opens the dialog; a relative path is refused; a full path opens the editor', async () => {
  const launched = await launchApp({ prepare: withFiles })
  const page = launched.window
  try {
    await openTyped(page, 'notes.md')
    await expect(page.locator('.open-file .error-line')).toHaveText(
      'Type a full path, starting with / or ~.',
    )
    await page.locator('.open-file input').fill('~/notes.md')
    await page.locator('.open-file input').press('Enter')
    await expect(page.locator('.open-file')).toHaveCount(0)
    await expect(page.locator('.tab.selected')).toHaveText(/notes\.md/)
    await expect(page.locator('.tab.selected')).toHaveAttribute('title', join(home, 'notes.md'))
    await expect(page.locator('.cm-editor .cm-lineNumbers')).toBeVisible()
  } finally {
    await launched.close()
  }
})

test('FIL-15, FIL-20 an edit marks the tab; Ctrl+S saves it; closing with edits asks, Discard leaves the disk as it was', async () => {
  const launched = await launchApp({ prepare: withFiles })
  const page = launched.window
  try {
    await openTyped(page, join(home, 'notes.md'))
    await page.locator('.cm-content').click()
    await page.keyboard.press('Control+End')
    await page.keyboard.type('more')
    await expect(page.locator('.tab.selected')).toHaveText(/notes\.md •/)
    await page.keyboard.press('Control+s')
    await expect(page.locator('.tab.selected')).not.toHaveText(/•/)
    expect(readFileSync(join(home, 'notes.md'), 'utf8')).toBe(`${NOTES}more`)

    await page.keyboard.type(' unsaved')
    await expect(page.locator('.tab.selected')).toHaveText(/•/)
    await page.locator('.tab.selected .close').click()
    await expect(page.locator('[role="alertdialog"] .heading')).toHaveText(
      'Save changes to notes.md?',
    )
    await page.locator('[role="alertdialog"] button', { hasText: 'Cancel' }).click()
    await expect(page.locator('.tab', { hasText: 'notes.md' })).toHaveCount(1)
    await page.locator('.tab.selected .close').click()
    await page.locator('[role="alertdialog"] button', { hasText: 'Discard' }).click()
    await expect(page.locator('.tab', { hasText: 'notes.md' })).toHaveCount(0)
    expect(readFileSync(join(home, 'notes.md'), 'utf8')).toBe(`${NOTES}more`)
  } finally {
    await launched.close()
  }
})

test('FIL-12 the agents’ data opens read only, says so, and a save is refused with the file untouched', async () => {
  const launched = await launchApp({ prepare: withFiles })
  const page = launched.window
  const file = () => join(home, '.claude', 'settings.json')
  try {
    const before = [readFileSync(file(), 'utf8'), statSync(file()).mtimeMs]
    await openTyped(page, '~/.claude/settings.json')
    await expect(page.locator('.file-bar')).toHaveText(
      'This file belongs to Claude Code: Menkar only reads it.',
    )
    await page.locator('.cm-content').click()
    await page.keyboard.type('xyz')
    await expect(page.locator('.cm-content')).not.toContainText('xyz')
    await page.keyboard.press('Control+s')
    await expect(page.locator('[role="alertdialog"] .heading')).toHaveText(
      'settings.json was not saved',
    )
    await expect(page.locator('[role="alertdialog"] .body')).toHaveText(
      'This file belongs to Claude Code: Menkar only reads it.',
    )
    expect([readFileSync(file(), 'utf8'), statSync(file()).mtimeMs]).toEqual(before)
  } finally {
    await launched.close()
  }
})

test('FIL-23, FIL-24, FIL-25, FIL-30 the preview: after its editor, tables and strikethrough, HTML as text; both tabs saved with the layout', async () => {
  const launched = await launchApp({ prepare: withFiles })
  const page = launched.window
  try {
    await openTyped(page, join(home, 'notes.md'))
    await expect(page.locator('.preview-row button')).toHaveAttribute(
      'title',
      'Show it rendered (Ctrl+Shift+V)',
    )
    await page.locator('.preview-row button').click()
    await expect(page.locator('.tab.selected')).toHaveText(/Preview — notes\.md/)
    const titles = await page.locator('.tab .title').allTextContents()
    expect(titles.slice(-2)).toEqual(['notes.md', 'Preview — notes.md'])
    const frame = page.frameLocator('.preview-frame')
    await expect(frame.locator('table td').first()).toHaveText('1')
    await expect(frame.locator('del, s')).toHaveText('old')
    await expect(frame.locator('body')).toContainText('<script>alert(1)</script>')
    mkdirSync('test-results/files', { recursive: true })
    await page.screenshot({ path: 'test-results/files/preview.png' })
    await page.keyboard.press('Control+Shift+V')
    await expect(page.locator('.tab.selected')).toHaveText(/^notes\.md/)
    await page.waitForTimeout(800)
    const saved = JSON.parse(readFileSync(join(root, 'config', 'menkar', 'projects.json'), 'utf8'))
    expect(saved.windows[0].tabs.aaaaaaaaaaaa.filter((t: { file?: string }) => t.file)).toEqual([
      { file: join(home, 'notes.md'), preview: false },
      { file: join(home, 'notes.md'), preview: true },
    ])
  } finally {
    await launched.close()
  }
})

test('PRF-5 the chosen font reaches the file tabs: one opened next uses it, an open one follows', async () => {
  const launched = await launchApp({ prepare: withFiles })
  const page = launched.window
  const editorFont = (nth: number) =>
    page
      .locator('.cm-scroller')
      .nth(nth)
      .evaluate((n) => ({
        family: getComputedStyle(n).fontFamily,
        size: getComputedStyle(n).fontSize,
      }))
  try {
    await openTyped(page, '~/notes.md')
    await expect(page.locator('.cm-scroller')).toHaveCount(1)
    expect(await editorFont(0)).toEqual({ family: 'monospace, monospace', size: '13.3333px' })
    await page.evaluate(() =>
      (
        globalThis as unknown as {
          menkar: { preferences: { set(k: string, v: string): Promise<unknown> } }
        }
      ).menkar.preferences.set('font', 'DejaVu Sans Mono 14'),
    )
    await expect
      .poll(() => editorFont(0))
      .toEqual({
        family: '"DejaVu Sans Mono", monospace',
        size: '18.6667px',
      })
    writeFileSync(join(home, 'other.txt'), 'other\n')
    await page.locator('.cm-content').first().click()
    await page.keyboard.press('Control+Shift+O')
    await page.locator('.open-file input').fill('~/other.txt')
    await page.locator('.open-file input').press('Enter')
    await expect(page.locator('.tab.selected')).toHaveText(/other\.txt/)
    expect(
      await page.locator('.tab-body:not(.hidden) .cm-scroller').evaluate((n) => ({
        family: getComputedStyle(n).fontFamily,
        size: getComputedStyle(n).fontSize,
      })),
    ).toEqual({ family: '"DejaVu Sans Mono", monospace', size: '18.6667px' })
  } finally {
    await launched.close()
  }
})
