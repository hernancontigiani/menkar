// Links in a terminal open with Ctrl+click, as in GNOME Terminal: an address in the output, whole
// across the rows it wraps over, an OSC 8 hyperlink of any scheme, a file: one with the file's
// default app, and a plain path that is on disk. A plain click selects and opens nothing; the hand shows only while Ctrl is held.
// Nothing is ever opened: main's shell.openExternal and shell.openPath are replaced by recorders.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, type Locator, type Page, test } from '@playwright/test'
import { type LaunchedApp, launchApp, savedCursorTab, terminalText } from './app'

// Claude Code's login link: long, with %-escapes, & and = in its query string.
const OAUTH =
  'https://accounts.google.com/o/oauth2/v2/auth?client_id=123456789012-abcdefghijklmnopqrstuvwxyz012345.apps.googleusercontent.com&redirect_uri=http%3A%2F%2Flocalhost%3A54545%2Fcallback&response_type=code&scope=openid%20email%20profile%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256&state=xyzzy-42'
const OSC8 = 'https://example.com/docs?a=1&b=%20two'
// Claude Code breaks a long address with its own newlines, a row each. With FORCE_HYPERLINK it
// sends each row as an OSC 8 link to the whole address, with one id, the bytes 2.1.322 sent for
// its login link: ESC]8;id=…;URL BEL, the row's piece in its grey, ESC]8;; BEL, a newline. Without
// it, the rows are plain text. The stand-in decides as Claude Code does.
const PIECES = OAUTH.match(/.{1,40}/g) ?? []
const ROWS_OSC8 = PIECES.map(
  (piece) => `\x1b]8;id=umwctg;${OAUTH}\x07\x1b[38;2;153;153;153m${piece}\x1b[39m\x1b]8;;\x07\n`,
).join('')
const ROWS_PLAIN = PIECES.map((piece) => `${piece}\n`).join('')
const STAND_IN =
  'if [ -n "$FORCE_HYPERLINK" ] && [ "$FORCE_HYPERLINK" != 0 ]; then cat rows-osc8.txt; else cat rows-plain.txt; fi\n'

// A file Claude Code links to as file://, its name with a space: it opens as its decoded path.
let filePath = ''
// A path Claude printed as plain text, with a place in the file, and one that is not on disk.
let picked = ''
let pickedFolder = ''

async function launch(): Promise<{ launched: LaunchedApp; page: Page }> {
  const launched = await launchApp({
    prepare: (dirs) => {
      writeFileSync(join(dirs.home, 'url.txt'), `${OAUTH}\n`)
      mkdirSync(join(dirs.home, 'generated docs'))
      filePath = join(dirs.home, 'generated docs', 'report.pdf')
      writeFileSync(filePath, '%PDF-1.4\n')
      writeFileSync(
        join(dirs.home, 'osc.txt'),
        `\x1b]8;;${OSC8}\x1b\\the docs\x1b]8;;\x1b\\ and \x1b]8;;${pathToFileURL(filePath).href}\x1b\\a file\x1b]8;;\x1b\\\n`,
      )
      writeFileSync(join(dirs.home, 'rows-osc8.txt'), ROWS_OSC8)
      writeFileSync(join(dirs.home, 'rows-plain.txt'), ROWS_PLAIN)
      writeFileSync(join(dirs.home, 'link.sh'), STAND_IN)
      pickedFolder = join(dirs.home, 'vis')
      mkdirSync(pickedFolder)
      picked = join(pickedFolder, 'pick-1-default.png')
      writeFileSync(picked, '')
      writeFileSync(
        join(dirs.home, 'paths.txt'),
        `Saved ${picked}:12:3, not ${join(pickedFolder, 'missing.png')}\nin \`~/vis\`.\n`,
      )
      // The pty's own FORCE_HYPERLINK is the one under test, not one from the shell running this.
      return { ...savedCursorTab(dirs), FORCE_HYPERLINK: '' }
    },
  })
  await launched.app.evaluate(({ shell }) => {
    const g = globalThis as unknown as { opened: string[]; paths: string[] }
    g.opened = []
    g.paths = []
    shell.openExternal = (async (url: string) => {
      g.opened.push(url)
    }) as never
    shell.openPath = (async (path: string) => {
      g.paths.push(path)
      return ''
    }) as never
  })
  const page = launched.window
  await expect.poll(() => terminalText(page)).toMatch(/\$\s*$/m)
  await page.locator('.xterm').click()
  return { launched, page }
}

const opened = (launched: LaunchedApp) =>
  launched.app.evaluate(() => (globalThis as unknown as { opened: string[] }).opened)
const openedPaths = (launched: LaunchedApp) =>
  launched.app.evaluate(() => (globalThis as unknown as { paths: string[] }).paths)

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

// Where a word of a row sits, from the row's left edge: the middle of its second character.
async function wordX(line: Locator, word: string): Promise<number> {
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

test('Ctrl+click on an OSC 8 hyperlink opens its address, and on a file: link the file; a plain click opens nothing', async () => {
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
    // The text between the links is no link: no hand, nothing opens.
    const lineBox = await line.boundingBox()
    if (!lineBox) throw new Error('row not laid out')
    await page.mouse.move(lineBox.x + (await at(' and ')), lineBox.y + lineBox.height / 2)
    await page.waitForTimeout(300)
    await expect(pointer(page)).toHaveCount(0)
    await page.mouse.down()
    await page.mouse.up()
    // A file: link opens with the file's default app: its path, decoded, goes to the system.
    await hoverLink(page, line, await at('a file'))
    await page.mouse.down()
    await page.mouse.up()
    await page.keyboard.up('Control')
    await expect.poll(() => openedPaths(launched)).toEqual([filePath])
    await expect.poll(() => opened(launched)).toEqual([OSC8])
    await page.waitForTimeout(300)
    expect(await opened(launched)).toEqual([OSC8])
  } finally {
    await launched.close()
  }
})

const underlined = (page: Page) =>
  page
    .locator('.xterm-rows > div')
    .evaluateAll(
      (rows) =>
        rows.filter((r) =>
          [...r.querySelectorAll('span')].some((c) => c.style.textDecoration === 'underline'),
        ).length,
    )

test('an address Claude Code breaks over rows with its own newlines is one OSC 8 link: Ctrl+click on any row opens it whole', async () => {
  const { launched, page } = await launch()
  try {
    await page.keyboard.type('sh link.sh')
    await page.keyboard.press('Enter')
    await expect.poll(() => terminalText(page)).toContain(PIECES.at(-1) ?? '')
    // Neither the first row nor the last: on its own it does not start with http.
    // The rows are 40 characters, short of the pane: the pointer goes into the text.
    const middle = row(page, PIECES[5] ?? '')
    await hoverLink(page, middle, 80)
    // xterm 6.0 underlines the hovered row's piece only, not the link's other rows.
    expect(await underlined(page)).toBe(1)
    await page.keyboard.down('Control')
    await page.mouse.down()
    await page.mouse.up()
    await page.keyboard.up('Control')
    await expect.poll(() => opened(launched)).toEqual([OAUTH])

    // The first row is also an address in the text, cut at the row's end: the OSC 8 link wins.
    await hoverLink(page, row(page, PIECES[0] ?? ''), 80)
    await page.keyboard.down('Control')
    await page.mouse.down()
    await page.mouse.up()
    await page.keyboard.up('Control')
    await expect.poll(() => opened(launched)).toEqual([OAUTH, OAUTH])
  } finally {
    await launched.close()
  }
})

test('a plain path on disk is a link: Ctrl+click opens it, ~/ under the home folder; a missing one is no link; a plain click opens nothing', async () => {
  const { launched, page } = await launch()
  try {
    await page.keyboard.type('cat paths.txt')
    await page.keyboard.press('Enter')
    await expect.poll(() => terminalText(page)).toContain('in `~/vis`.')
    const saved = row(page, /^Saved /)
    const savedBox = await saved.boundingBox()
    if (!savedBox) throw new Error('row not laid out')
    const middle = savedBox.y + savedBox.height / 2

    // The path that is not on disk: no link, no hand, nothing opens.
    await page.mouse.move(savedBox.x + (await wordX(saved, 'missing.png')), middle)
    await page.waitForTimeout(300)
    await expect(pointer(page)).toHaveCount(0)
    await page.keyboard.down('Control')
    await page.mouse.down()
    await page.mouse.up()
    await page.keyboard.up('Control')

    await hoverLink(page, saved, await wordX(saved, 'pick-1'))
    expect(await cursorOver(page)).toBe('text')
    await page.mouse.down()
    await page.mouse.up()
    await page.waitForTimeout(300)
    expect(await openedPaths(launched)).toEqual([])

    await hoverLink(page, saved, await wordX(saved, 'pick-1'))
    await page.keyboard.down('Control')
    await expect.poll(() => cursorOver(page)).toBe('pointer')
    await page.mouse.down()
    await page.mouse.up()
    await page.keyboard.up('Control')
    await expect.poll(() => openedPaths(launched)).toEqual([picked])

    const home = row(page, /^in `~\/vis`/)
    await hoverLink(page, home, await wordX(home, '~/vis'))
    await page.keyboard.down('Control')
    await page.mouse.down()
    await page.mouse.up()
    await page.keyboard.up('Control')
    await expect.poll(() => openedPaths(launched)).toEqual([picked, pickedFolder])
    await page.waitForTimeout(300)
    expect(await opened(launched)).toEqual([])
  } finally {
    await launched.close()
  }
})
