// The site's captures: one launch per locale × theme on the seeded world, every scene walked in
// the registry's order, each image written raw for site/scripts/import-captures.mjs to import.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { now } from '../../src/core/clock'
import { TASKS_SHOWN } from '../../src/core/orchestration/rows'
import { launchApp } from '../app'
import { CAPTURES, type Capture, LOCALES, type Locale, type Slug, THEMES } from './registry'
import { SCENES, type Walker } from './scenes'
import { SESSION, STRINGS, seed, seedWait } from './seed'

// Where the raw images go; the importer reads them from here.
export const RAW = '/tmp/menkar-captures/raw'
const WIDTH = 1280
const HEIGHT = 800
const SCALE = 2
// Where the pointer waits during a shot: the header, right of the window's title.
const REST = { x: 1000, y: 16 }
const SHOT_ATTEMPTS = 5

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
      const wait = seedWait(now())
      if (wait > 0) {
        test.setTimeout(wait + 120_000)
        await new Promise((r) => setTimeout(r, wait))
      }
      const launched = await launchApp({
        prepare: (dirs) => seed(dirs, locale, theme, now()),
        args: [`--force-device-scale-factor=${SCALE}`],
      })
      const page = launched.window
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console: ${m.text()}`)
      })
      try {
        await identify(launched.app, page, locale)
        await size(launched.app, page)
        const out = join(RAW, locale, theme)
        rmSync(out, { recursive: true, force: true })
        const walker = makeWalker(page, locale, out, seededStates(launched.root))
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
  page: Page,
  locale: Locale,
  out: string,
  seeded: Readonly<Record<string, string>>,
): Walker {
  const text = (key: Parameters<Walker['text']>[0]) => STRINGS[locale][key]
  return {
    page,
    text,
    async go(action, ready) {
      await action()
      await expect(ready).toBeVisible()
    },
    async shot(slug, proof) {
      await expect(page.locator('#project-button .project-name')).toHaveText(text(proof.project))
      if (proof.openTasks !== undefined) {
        await expect(page.locator('#session-list .task-row')).toHaveCount(
          Math.min(TASKS_SHOWN, proof.openTasks),
        )
        await expect(page.locator('.see-all')).toContainText(`(${proof.openTasks})`)
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
        const clip = clipOf(slug)
        const image = await page.screenshot({
          animations: 'disabled',
          caret: 'hide',
          ...(clip ? { clip } : {}),
        })
        const after = await unsettled(page, seeded)
        if (after.length === 0) {
          mkdirSync(out, { recursive: true })
          writeFileSync(join(out, `${slug}.png`), image)
          return
        }
        if (attempt === SHOT_ATTEMPTS)
          throw new Error(`${slug}: the screen moved during every shot: ${after.join('; ')}`)
      }
    },
  }
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
// a focused element, a terminal scrollbar shown or fading, a loading indicator.
function unsettled(page: Page, seeded: Readonly<Record<string, string>>): Promise<string[]> {
  return page.evaluate(async (seeded) => {
    const menkar = (
      globalThis as unknown as {
        menkar: { window: { state(): Promise<{ open: readonly string[] }> } }
      }
    ).menkar
    const open = new Set((await menkar.window.state()).open)
    const why: string[] = []
    for (const tab of document.querySelectorAll<HTMLElement>('#tab-strip .tab'))
      if (!tab.querySelector('.ring')) why.push(`tab ${tab.textContent ?? ''}: no ring`)
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
    for (const spinner of document.querySelectorAll<HTMLElement>('.turning, .turning-star'))
      if (spinner.checkVisibility()) why.push('a loading indicator shows')
    return why
  }, seeded)
}
