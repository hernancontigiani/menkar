// The site's captures: one launch per locale × theme on the seeded world, every scene walked in
// the registry's order, each image written raw for site/scripts/import-captures.mjs to import.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type ElectronApplication, expect, type Locator, type Page, test } from '@playwright/test'
import { now } from '../../src/core/clock'
import { en as appEn } from '../../src/core/i18n/en'
import { es as appEs } from '../../src/core/i18n/es'
import { launchApp } from '../app'
import {
  CAPTURES,
  type Capture,
  type Clip,
  LOCALES,
  type Locale,
  type Slug,
  THEMES,
} from './registry'
import { SCENES, type Walker } from './scenes'
import { SESSION, STRINGS, seed } from './seed'

// Where the raw images go; the importer reads them from here.
export const RAW = '/tmp/menkar-captures/raw'
const WIDTH = 1280
const HEIGHT = 800
const SCALE = 2
// Where the pointer waits during a shot: the header, right of the window's title.
const REST = { x: 1000, y: 16 }
const SHOT_ATTEMPTS = 5
// Every run is taken at this instant in this zone, in the seed and in the app alike, so a date, an
// hour or an age on screen never moves an image. A weekday afternoon: today's events fit after
// midnight unsqueezed, and yesterday is a working day.
const FIXED_NOW = Date.UTC(2026, 10, 18, 15, 0, 0)
const ZONE = 'UTC'
process.env.TZ = ZONE
const FIXED_CLOCK = fileURLToPath(new URL('./fixed-clock.cjs', import.meta.url))
const APP_STRINGS: Readonly<Record<Locale, Partial<Record<keyof typeof appEn, string>>>> = {
  en: appEn,
  es: appEs,
}

const pick = <T extends string>(all: readonly T[], env: string | undefined): readonly T[] => {
  if (!env) return all
  const wanted = env.split(',').map((x) => x.trim())
  const unknown = wanted.filter((x) => !all.includes(x as T))
  if (unknown.length > 0) throw new Error(`unknown ${unknown.join(', ')}; known: ${all.join(', ')}`)
  return all.filter((x) => wanted.includes(x))
}

// CAPTURE_ONLY filters what is written, never what is walked: screens are stateful, so a scene
// reached through an earlier one is only right if that one ran.
const only = (process.env.CAPTURE_ONLY ?? '')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean)
const written = (slug: string) =>
  only.length === 0 ||
  only.some((p) => (p.endsWith('*') ? slug.startsWith(p.slice(0, -1)) : slug === p))
const checkOnly = process.env.CAPTURE_CHECK === '1'

const scenes = [...new Set(CAPTURES.map((c) => c.scene))]
const clipOf = (slug: Slug) => (CAPTURES as readonly Capture[]).find((c) => c.slug === slug)?.clip

for (const locale of pick(LOCALES, process.env.CAPTURE_LOCALES))
  for (const theme of pick(THEMES, process.env.CAPTURE_THEMES))
    test(`${locale} ${theme}`, async () => {
      // The app identified: this tree's build, never a packaged one.
      expect(process.env.MENKAR_E2E_EXECUTABLE, 'captures photograph this tree’s out/').toBe(
        undefined,
      )
      const launched = await launchApp({
        prepare: async (dirs) => {
          const shift = FIXED_NOW - now()
          return {
            ...(await seed(dirs, locale, theme, now() + shift)),
            MENKAR_CAPTURE_CLOCK_SHIFT: String(shift),
            TZ: ZONE,
          }
        },
        args: ['-r', FIXED_CLOCK, `--force-device-scale-factor=${SCALE}`],
      })
      const page = launched.window
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console: ${m.text()}`)
      })
      try {
        await identify(launched.app, page, locale)
        await fixedClock(launched.app, page)
        await size(launched.app, page)
        const out = join(RAW, locale, theme)
        rmSync(out, { recursive: true, force: true })
        const walker = makeWalker(launched.app, page, locale, out, seededStates(launched.root))
        for (const scene of scenes) await SCENES[scene](walker)
        expect(errors, 'the renderer reported errors').toEqual([])
      } catch (error) {
        // A walk that failed first still names what the renderer reported before it.
        if (error instanceof Error && errors.length > 0)
          error.message += `\nThe renderer also reported:\n${errors.join('\n')}`
        throw error
      } finally {
        await launched.close()
      }
    })

type App = Awaited<ReturnType<typeof launchApp>>['app']

// The app's clocks read the run's instant and zone, in main, a worker thread and the window: a
// clock left out would put today's date or hour in some image.
async function fixedClock(app: App, page: Page): Promise<void> {
  const read = () => ({ now: Date.now(), offset: new Date().getTimezoneOffset() })
  const main = await app.evaluate(read)
  const worker = await app.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const { Worker } = process.getBuiltinModule('node:worker_threads')
        const w = new Worker('require("node:worker_threads").parentPort.postMessage(Date.now())', {
          eval: true,
        })
        w.once('message', resolve)
        w.once('error', reject)
      }),
  )
  const renderer = await page.evaluate(read)
  // Within the minutes a run takes since its launch.
  const near = (at: number) => at >= FIXED_NOW && at - FIXED_NOW < 10 * 60_000
  expect({
    main: near(main.now),
    worker: near(worker),
    renderer: near(renderer.now),
    offsets: [main.offset, renderer.offset],
  }).toEqual({ main: true, worker: true, renderer: true, offsets: [0, 0] })
}

async function identify(app: App, page: Page, locale: Locale): Promise<void> {
  expect(await app.evaluate(({ app }) => app.getAppPath())).toBe(resolve('.'))
  await expect(page).toHaveTitle('Menkar')
  await expect(page.locator('#project-button .project-name')).toHaveText(
    STRINGS[locale].projectTeam,
  )
}

async function size(app: App, page: Page): Promise<void> {
  await app.evaluate(
    ({ BrowserWindow }, [w, h]) => {
      const win = BrowserWindow.getAllWindows()[0]
      if (!win) throw new Error('no window')
      if (win.isMaximized()) win.unmaximize()
      win.setContentSize(w ?? 0, h ?? 0)
    },
    [WIDTH, HEIGHT],
  )
  await expect
    .poll(() => page.evaluate(() => [innerWidth, innerHeight, devicePixelRatio]))
    .toEqual([WIDTH, HEIGHT, SCALE])
}

function makeWalker(
  app: ElectronApplication,
  page: Page,
  locale: Locale,
  out: string,
  seeded: Readonly<Record<string, string>>,
): Walker {
  const text = (key: Parameters<Walker['text']>[0]) => STRINGS[locale][key]
  const save = (slug: Slug, image: Buffer) => {
    mkdirSync(out, { recursive: true })
    writeFileSync(join(out, `${slug}.png`), image)
  }
  return {
    page,
    app,
    text,
    ui: (key) => APP_STRINGS[locale][key] ?? appEn[key],
    async openWindow(open, title, size) {
      const [win] = await Promise.all([app.waitForEvent('window'), open()])
      await win.waitForLoadState('domcontentloaded')
      await app.evaluate(
        ({ BrowserWindow }, [title, w, h]) => {
          const found = BrowserWindow.getAllWindows().find((x) => x.getTitle() === title)
          if (!found) throw new Error(`no window titled ${title}`)
          if (found.isMaximized()) found.unmaximize()
          found.setContentSize(Number(w), Number(h))
        },
        [title, size.width, size.height] as const,
      )
      await expect
        .poll(() => win.evaluate(() => [innerWidth, innerHeight, devicePixelRatio]))
        .toEqual([size.width, size.height, SCALE])
      return win
    },
    async shotWindow(slug, win) {
      const [width = 1, height = 1] = await win.evaluate(() => [innerWidth, innerHeight])
      await win.mouse.move(width - 1, height - 1)
      await win.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
      await win.evaluate(() => document.fonts.ready.then(() => undefined))
      // Without the main window's rows to read, settled means two shots in a row draw the same.
      let last = await win.screenshot({ animations: 'disabled', caret: 'hide' })
      for (let attempt = 1; ; attempt++) {
        const image = await win.screenshot({ animations: 'disabled', caret: 'hide' })
        if (image.equals(last)) {
          if (!checkOnly && written(slug)) save(slug, image)
          return
        }
        if (attempt === SHOT_ATTEMPTS) throw new Error(`${slug}: the window kept changing`)
        last = image
      }
    },
    async holdClockAt(at) {
      // Main's clock only, in the last scene: the app closes right after, so nothing later reads
      // the shifted time.
      await app.evaluate((_, at) => {
        const shift = Date.now() - at
        const real = Date.now
        Date.now = () => real() - shift
      }, at)
    },
    async go(action, ready) {
      await action()
      await expect(ready).toBeVisible()
    },
    async shot(slug, proof, area) {
      await expect(page.locator('#project-button .project-name')).toHaveText(text(proof.project))
      if (proof.openTasks !== undefined) {
        await expect(
          page.locator(
            '#board-panel .board [data-column]:not([data-column="topics"]):not([data-column="done"]) .task-card',
          ),
        ).toHaveCount(proof.openTasks)
      }
      // Xvfb leaves its pointer mid-screen, over whatever is there: it rests on the header's empty
      // middle instead, so no hover shows and xterm fades its scrollbar.
      await page.mouse.move(REST.x, REST.y)
      // Whether a terminal holds the focus depends on timing: none does, so every run draws the same
      // screen with no focus ring.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      // The screen can still move after it settled (a terminal redrawn shows its scrollbar again):
      // a shot counts only if the screen was settled both before and after it was taken.
      for (let attempt = 1; ; attempt++) {
        await expect.poll(() => unsettled(page, seeded)).toEqual([])
        if (checkOnly || !written(slug)) return
        const clip = clipOf(slug) ?? (area ? await around(area) : undefined)
        // A part of the window comes from Electron itself: Playwright's clipped screenshot makes
        // the terminal show its scrollbar, and it stays shown.
        const image = clip
          ? await capture(app, clip)
          : await page.screenshot({ animations: 'disabled', caret: 'hide' })
        const after = await unsettled(page, seeded)
        if (after.length === 0) {
          save(slug, image)
          return
        }
        if (attempt === SHOT_ATTEMPTS)
          throw new Error(`${slug}: the screen moved during every shot: ${after.join('; ')}`)
      }
    },
  }
}

// The main window's `clip`, at the window's scale.
async function capture(app: ElectronApplication, clip: Clip): Promise<Buffer> {
  const png = await app.evaluate(async ({ BrowserWindow }, rect) => {
    const win = BrowserWindow.getAllWindows().find((w) => w.getTitle() === 'Menkar')
    if (!win) throw new Error('no main window')
    return (await win.webContents.capturePage(rect)).toPNG().toString('base64')
  }, clip)
  return Buffer.from(png, 'base64')
}

// The smallest box holding every element `area` matches, within the window.
async function around(area: readonly Locator[]): Promise<Clip> {
  const boxes = []
  for (const locator of area)
    for (const one of await locator.all()) {
      const box = await one.boundingBox()
      if (box) boxes.push(box)
    }
  if (boxes.length === 0) throw new Error('the area to capture matches nothing')
  const x = Math.max(0, Math.floor(Math.min(...boxes.map((b) => b.x))))
  const y = Math.max(0, Math.floor(Math.min(...boxes.map((b) => b.y))))
  const right = Math.min(WIDTH, Math.ceil(Math.max(...boxes.map((b) => b.x + b.width))))
  const bottom = Math.min(HEIGHT, Math.ceil(Math.max(...boxes.map((b) => b.y + b.height))))
  return { x, y, width: right - x, height: bottom - y }
}

// Each seeded session's state, as the seed wrote it for its stand-in.
function seededStates(root: string): Record<string, string> {
  return Object.fromEntries(
    Object.values(SESSION).map((id) => {
      const screen = JSON.parse(readFileSync(join(root, 'stand-in', `${id}.json`), 'utf8'))
      return [id, String(screen.state)]
    }),
  )
}

// Why the screen is not ready for a shot yet, empty once it is: a context ring still being read
// from its transcript, a running session not yet showing the state its stand-in was seeded with,
// a focused element, a terminal scrollbar shown or fading, a toast, a loading indicator.
function unsettled(page: Page, seeded: Readonly<Record<string, string>>): Promise<string[]> {
  return page.evaluate(async (seeded) => {
    const menkar = (
      globalThis as unknown as {
        menkar: {
          window: {
            state(): Promise<{
              open: readonly string[]
              tabs: readonly { id: string; kind: string; chat?: string }[]
            }>
          }
        }
      }
    ).menkar
    const state = await menkar.window.state()
    const open = new Set(state.open)
    // Only a session's terminal tab draws a context ring; a file or chat tab never does.
    const ringed = new Set(
      state.tabs.filter((t) => t.kind === 'session' && !t.chat).map((t) => t.id),
    )
    const why: string[] = []
    for (const tab of document.querySelectorAll<HTMLElement>('#tab-strip .tab'))
      if (ringed.has(tab.dataset.tab ?? '') && !tab.querySelector('.ring'))
        why.push(`tab ${tab.textContent ?? ''}: no ring`)
    for (const row of document.querySelectorAll<HTMLElement>('#session-list .row[data-session]')) {
      const id = row.dataset.session ?? ''
      if (!open.has(id)) continue
      if (!row.querySelector('.ring')) why.push(`row ${id}: no ring`)
      const want = seeded[id]
      const dot = row.querySelector('.dot')
      if (want !== undefined && !dot?.classList.contains(want))
        why.push(`row ${id}: ${dot?.className ?? 'no dot'}, seeded ${want}`)
    }
    if (document.activeElement !== document.body) why.push('an element has the focus')
    for (const bar of document.querySelectorAll('.xterm .scrollbar'))
      if (bar.classList.contains('visible') || getComputedStyle(bar).opacity !== '0')
        why.push('a terminal scrollbar shows')
    // A toast leaves by itself a few seconds after it came.
    if (document.querySelector('#toasts .toast')) why.push('a toast shows')
    for (const spinner of document.querySelectorAll<HTMLElement>('.turning, .turning-star'))
      if (spinner.checkVisibility()) why.push('a loading indicator shows')
    return why
  }, seeded)
}
