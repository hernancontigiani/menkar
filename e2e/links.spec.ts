// Links in a terminal open in the browser with Ctrl+click, as in GNOME Terminal: an address in
// the output, whole across the rows it wraps over, and an OSC 8 hyperlink. A plain click selects
// and opens nothing; the hand shows only while Ctrl is held. The browser is never opened: main's
// shell.openExternal is replaced by a recorder.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Locator, type Page, test } from '@playwright/test'
import { type LaunchedApp, launchApp, savedCursorTab, terminalText } from './app'

// Claude Code's login link: long, with %-escapes, & and = in its query string.
const OAUTH =
  'https://accounts.google.com/o/oauth2/v2/auth?client_id=123456789012-abcdefghijklmnopqrstuvwxyz012345.apps.googleusercontent.com&redirect_uri=http%3A%2F%2Flocalhost%3A54545%2Fcallback&response_type=code&scope=openid%20email%20profile%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256&state=xyzzy-42'
const OSC8 = 'https://example.com/docs?a=1&b=%20two'

async function launch(): Promise<{ launched: LaunchedApp; page: Page }> {
  const launched = await launchApp({
    prepare: (dirs) => {
      writeFileSync(join(dirs.home, 'url.txt'), `${OAUTH}\n`)
      writeFileSync(
        join(dirs.home, 'osc.txt'),
        `\x1b]8;;${OSC8}\x1b\\the docs\x1b]8;;\x1b\\ and \x1b]8;;file:///etc/passwd\x1b\\a file\x1b]8;;\x1b\\\n`,
      )
      return savedCursorTab(dirs)
    },
  })
  await launched.app.evaluate(({ shell }) => {
    const g = globalThis as unknown as { opened: string[] }
    g.opened = []
    shell.openExternal = (async (url: string) => {
      g.opened.push(url)
    }) as never
  })
  const page = launched.window
  await expect.poll(() => terminalText(page)).toMatch(/\$\s*$/m)
  await page.locator('.xterm').click()
  return { launched, page }
}

const opened = (launched: LaunchedApp) =>
  launched.app.evaluate(() => (globalThis as unknown as { opened: string[] }).opened)

const row = (page: Page, text: string | RegExp) =>
  page.locator('.xterm-rows > div').filter({ hasText: text }).last()

const pointer = (page: Page) =>
  page.locator('.xterm .xterm-cursor-pointer, .xterm.xterm-cursor-pointer')

// xterm acts only on the link it found under the pointer, so the pointer rests there first.
async function hoverLink(page: Page, target: Locator, x?: number): Promise<void> {
  const box = await target.boundingBox()
  if (!box) throw new Error('row not laid out')
  await page.mouse.move(box.x + (x ?? box.width / 2), box.y + box.height / 2)
  await expect(pointer(page)).toHaveCount(1)
}

const cursorOver = (page: Page) =>
  pointer(page).evaluate((element) => getComputedStyle(element).cursor)

test('Ctrl+click on an address wrapped over several rows opens it whole; a plain click opens nothing; the hand only with Ctrl', async () => {
  const { launched, page } = await launch()
  try {
    await page.keyboard.type('cat url.txt')
    await page.keyboard.press('Enter')
    await expect.poll(() => terminalText(page)).toContain('state=xyzzy-42')
    // A row in the middle of the address: wrapped, neither its start nor its end.
    const middle = row(page, 'code_challenge=')
    expect(await middle.textContent()).not.toContain('https://accounts')
    expect(await middle.textContent()).not.toContain('xyzzy-42')

    await hoverLink(page, middle)
    expect(await cursorOver(page)).toBe('text')
    await page.keyboard.down('Control')
    await expect.poll(() => cursorOver(page)).toBe('pointer')
    await page.keyboard.up('Control')

    await page.mouse.down()
    await page.mouse.up()
    await page.waitForTimeout(300)
    expect(await opened(launched)).toEqual([])

    await hoverLink(page, middle)
    await page.keyboard.down('Control')
    await page.mouse.down()
    await page.mouse.up()
    await page.keyboard.up('Control')
    await expect.poll(() => opened(launched)).toEqual([OAUTH])
  } finally {
    await launched.close()
  }
})

test('Ctrl+click on an OSC 8 hyperlink opens its address; a plain click and a file: link open nothing', async () => {
  const { launched, page } = await launch()
  try {
    await page.keyboard.type('cat osc.txt')
    await page.keyboard.press('Enter')
    await expect.poll(() => terminalText(page)).toMatch(/the\sdocs\sand\sa\sfile/)
    const line = row(page, /the\sdocs\sand\sa\sfile/)
    const at = async (word: string): Promise<number> => {
      const x = await line.evaluate((element, w) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
        let all = ''
        const nodes: Text[] = []
        while (walker.nextNode()) {
          nodes.push(walker.currentNode as Text)
          all += (walker.currentNode as Text).data.replace(/\s/g, ' ')
        }
        let index = all.indexOf(w) + 1
        for (const node of nodes) {
          if (index < node.data.length) {
            const range = document.createRange()
            range.setStart(node, index)
            range.setEnd(node, index + 1)
            const r = range.getBoundingClientRect()
            return r.x + r.width / 2 - element.getBoundingClientRect().x
          }
          index -= node.data.length
        }
        return -1
      }, word)
      expect(x).toBeGreaterThan(0)
      return x
    }

    await hoverLink(page, line, await at('the docs'))
    await page.mouse.down()
    await page.mouse.up()
    await page.waitForTimeout(300)
    expect(await opened(launched)).toEqual([])

    await page.keyboard.down('Control')
    await page.mouse.down()
    await page.mouse.up()
    // A file: link is not a link here at all: no underline, no hand, nothing opens.
    const lineBox = await line.boundingBox()
    if (!lineBox) throw new Error('row not laid out')
    await page.mouse.move(lineBox.x + (await at('a file')), lineBox.y + lineBox.height / 2)
    await page.waitForTimeout(300)
    await expect(pointer(page)).toHaveCount(0)
    await page.mouse.down()
    await page.mouse.up()
    await page.keyboard.up('Control')
    await expect.poll(() => opened(launched)).toEqual([OSC8])
    await page.waitForTimeout(300)
    expect(await opened(launched)).toEqual([OSC8])
  } finally {
    await launched.close()
  }
})
