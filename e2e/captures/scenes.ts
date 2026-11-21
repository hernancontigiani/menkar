// Per scene, the imperative walk: go somewhere, wait for proof the screen is real, shoot. Screens
// are stateful, so the walks run in the registry's order within one launch.
import { type ElectronApplication, expect, type Locator, type Page } from '@playwright/test'
import type { en as appEn } from '../../src/core/i18n/en'
import type { Scene, Slug } from './registry'
import { PROJECT, SESSION, type Text } from './seed'

// What the screen must show before a shot, from the seed's own numbers.
export interface Proof {
  // The project shown in the header, by its seeded name.
  readonly project: Text
  // The open tasks of a project in the orchestration mode, each a card on the Board, which is open
  // by default.
  readonly openTasks?: number
}

export interface Walker {
  readonly page: Page
  readonly app: ElectronApplication
  // The seed's text in this launch's locale.
  text(key: Text): string
  // The app's own label in this launch's locale.
  ui(key: keyof typeof appEn): string
  // Runs `action`, then waits for `ready` to be visible.
  go(action: () => Promise<void>, ready: Locator): Promise<void>
  // The registry's clip, if the capture has one, is applied here; else, given `area`, the box
  // around what it matches.
  shot(slug: Slug, proof: Proof, area?: readonly Locator[]): Promise<void>
  // Runs `open` and returns the window it opens, titled `title`, its content at `size`.
  openWindow(
    open: () => Promise<unknown>,
    title: string,
    size: { readonly width: number; readonly height: number },
  ): Promise<Page>
  // A shot of a window other than the main one, once it draws the same twice in a row.
  shotWindow(slug: Slug, win: Page): Promise<void>
  // Main's clock reads `at` now and runs on from it; only the last scene may call it.
  holdClockAt(at: number): Promise<void>
}

export type SceneWalk = (w: Walker) => Promise<void>

// The Atlas app's open tasks: 2, 3, 4 and 5 (1 is done today, 6 dropped).
const OPEN_TASKS = 4
const TEAM: Proof = { project: 'projectTeam', openTasks: OPEN_TASKS }
const HOUR = 3_600_000
// Settings at the size it opens at; Usage as wide as the main window, so its table needs no
// scrolling.
const SETTINGS_SIZE = { width: 860, height: 640 }
const USAGE_SIZE = { width: 1280, height: 800 }

const row = (w: Walker, id: string) => w.page.locator(`#session-list .row[data-session="${id}"]`)

async function act(w: Walker, action: Record<string, unknown>): Promise<void> {
  await w.page.evaluate(
    (a) =>
      (
        globalThis as unknown as { menkar: { window: { act(a: unknown): Promise<unknown> } } }
      ).menkar.window.act(a),
    action,
  )
}

// Opens the project dropdown and shows the project `id`, named `name`.
async function showProject(w: Walker, id: string, name: Text): Promise<void> {
  const projectRow = w.page.locator(`.project-row[data-project="${id}"]`)
  await w.go(() => w.page.locator('#project-button').click(), projectRow)
  await w.go(
    // On its name: the row's middle can be its rename button, by the name's length.
    () => projectRow.getByText(w.text(name), { exact: true }).click(),
    w.page.locator('#project-button .project-name', { hasText: w.text(name) }),
  )
}

export const SCENES: Record<Scene, SceneWalk> = {
  async team(w) {
    const terminal = w.page.locator('#tab-content .xterm-rows', { hasText: w.text('promptLead') })
    await w.go(async () => {}, terminal)
    // The sidebar can keep drawing the orchestrator's row from a state sent before its terminal
    // started, without its context ring, until the next change: folding Done today and back
    // brings a fresh one and leaves the sidebar as it was.
    const done = w.page.locator('[data-section="done"]')
    await w.go(() => done.click(), w.page.locator('[data-section="done"][aria-expanded="true"]'))
    await w.go(() => done.click(), w.page.locator('[data-section="done"][aria-expanded="false"]'))
    await w.shot('hero-orchestration', TEAM)

    const top = w.page.locator('#topics-section')
    await w.shot('work-view-awaiting', TEAM, [top])

    const topic = w.page.locator('.topic-row[data-topic="2"]')
    await w.go(() => topic.click(), w.page.locator('.topic-row.open[data-topic="2"]'))
    await expect(w.page.locator('.topic-detail')).toBeVisible()
    await w.shot('topic-discussing', TEAM, [top])
    await w.go(() => topic.click(), w.page.locator('.topic-row[data-topic="2"]:not(.open)'))

    await w.go(() => done.click(), w.page.locator('.done-row').first())
    await w.shot('work-view-overview', TEAM, [w.page.locator('#sidebar')])
    await w.go(() => done.click(), w.page.locator('[data-section="done"][aria-expanded="false"]'))
  },

  async board(w) {
    // Beside the sidebar the Board's last column is cut at this width: hidden, every column fits.
    const toggle = w.page.locator('#toggle-sidebar')
    await w.go(() => toggle.click(), w.page.locator('#toggle-sidebar[aria-pressed="false"]'))
    const done = w.page.locator('#board-panel [data-column="done"] .task-card')
    await w.go(async () => {}, done)
    await w.shot('board-default', TEAM)
    const review = w.page.locator('#board-panel [data-column="to-review"]')
    await review.scrollIntoViewIfNeeded()
    await w.shot('task-to-review', TEAM, [review])
    await w.go(() => toggle.click(), w.page.locator('#toggle-sidebar[aria-pressed="true"]'))
  },

  async workers(w) {
    const worker = row(w, SESSION.w2)
    await w.go(() => row(w, SESSION.lead).locator('.team-fold').click(), worker)
    await w.shot('background-workers', TEAM)
    const peek = w.page.locator('#tab-strip .tab.peek')
    await w.go(
      () => worker.click(),
      w.page.locator('#tab-content .xterm-rows', { hasText: w.text('promptWorker2') }),
    )
    await expect(peek).toBeVisible()
    await w.shot('peek-tab', TEAM)
    await peek.locator('.close').click()
    await expect(peek).toHaveCount(0)
    await row(w, SESSION.lead).locator('.team-fold').click()
    await expect(worker).toHaveCount(0)
  },

  async role(w) {
    await w.go(
      () => row(w, SESSION.reviewer).click({ button: 'right' }),
      w.page.locator('.menu-item', { hasText: w.ui('orch.configureRole') }),
    )
    const dialog = w.page.locator('.role-window')
    await w.go(
      () => w.page.locator('.menu-item', { hasText: w.ui('orch.configureRole') }).click(),
      dialog,
    )
    await w.shot('configure-role', TEAM)
    await dialog.locator('.responses button').first().click()
    await expect(dialog).toHaveCount(0)
  },

  async harbor(w) {
    const site = w.page.locator(`.project-row[data-project="${PROJECT.site}"]`)
    await w.go(() => w.page.locator('#project-button').click(), site)
    await w.shot('project-dropdown', TEAM)
    await w.go(
      () => site.getByText(w.text('projectSite'), { exact: true }).click(),
      w.page.locator('#project-button .project-name', { hasText: w.text('projectSite') }),
    )
    for (const prompt of ['promptDocs', 'promptSiteBuild'] as const)
      await expect(
        w.page.locator('#tab-content .xterm-rows', { hasText: w.text(prompt) }),
      ).toBeVisible()
    await w.shot('split-panes', { project: 'projectSite' })

    const card = w.page.locator('.orch-card')
    await w.go(
      () => w.page.locator('#orchestration-switch').click(),
      w.page.locator('.orch-card .responses button').last(),
    )
    await w.shot('first-time-card', { project: 'projectSite' })
    await card.locator('.responses button', { hasText: w.ui('orch.cardNotNow') }).click()
    await expect(card).toHaveCount(0)
  },

  async notes(w) {
    await showProject(w, PROJECT.notes, 'projectNotes')
    const file = w.text('fileInterviews')
    // A double-click on the file once opened nothing in one launch of eight: it is tried again
    // until the file's tab opens.
    const editor = w.page.locator('#tab-strip .tab.selected', { hasText: file })
    await expect(async () => {
      await w.page.locator(`#files-section .file-row[data-file="${file}"]`).dblclick()
      await expect(editor).toBeVisible({ timeout: 2_000 })
    }).toPass()
    await w.go(
      () => w.page.locator('.preview-row button:not(.save)').click(),
      w.page.frameLocator('.preview-frame').locator('h1'),
    )
    await w.shot('markdown-preview', { project: 'projectNotes' })

    const add = w.page.locator('.add-session')
    await w.go(() => w.page.locator('#add-session').click(), add.locator('.heading'))
    await w.go(
      () => add.locator('.history-group').first().click(),
      add.locator('.history-row').first(),
    )
    await w.shot('add-session-existing', { project: 'projectNotes' })
    await w.go(() => add.locator('.switch').nth(1).click(), add.locator('.folder-row').first())
    await w.shot('add-session-new', { project: 'projectNotes' })
    await w.page.keyboard.press('Escape')
    await expect(add).toHaveCount(0)

    await act(w, { type: 'continueInChat', session: SESSION.notes, key: 'default' })
    const entry = w.page.locator('[data-key="chat-entry"]')
    await expect(entry).toBeVisible()
    await entry.fill(w.text('chatPrompt'))
    await w.go(() => entry.press('Enter'), w.page.locator('.chat .card.permission'))
    await expect(w.page.locator('.chat')).toContainText(w.text('chatAnswer'))
    await w.shot('chat-permission', { project: 'projectNotes' })
  },

  async settings(w) {
    const win = await w.openWindow(
      () => act(w, { type: 'openSettings' }),
      w.ui('settings.title'),
      SETTINGS_SIZE,
    )
    for (const [section, slug] of [
      ['appearance', 'settings-look'],
      ['statusline', 'settings-integrations'],
    ] as const) {
      await w.go(
        () => win.locator(`.section-item[data-section="${section}"]`).click(),
        win.locator(`main[data-section="${section}"]`),
      )
      await w.shotWindow(slug, win)
    }
    await win.close()
  },

  async usage(w) {
    const win = await w.openWindow(
      () => act(w, { type: 'openUsage' }),
      w.ui('usage.title'),
      USAGE_SIZE,
    )
    await w.go(
      () => win.locator('[data-key="all-projects"]').click(),
      win.locator('[data-key="all-projects"][aria-pressed="true"]'),
    )
    const section = (name: string) =>
      w.go(
        () => win.locator(`[data-section="${name}"][role="tab"]`).click(),
        win.locator(`[data-section="${name}"][role="tab"][aria-selected="true"]`),
      )
    await section('spend')
    // The window opens on Today, whose figures scale with the hour the seed ran: 7 days holds still.
    await w.go(
      () => win.locator('[data-toggles="period"] [data-value="7d"]').click(),
      win.locator('[data-toggles="period"] [data-value="7d"][aria-pressed="true"]'),
    )
    await w.shotWindow('usage-spend', win)
    await section('time')
    await w.go(
      () => win.locator('[data-toggles="period"] [data-value="week"]').click(),
      win.locator('[data-day]').first(),
    )
    // Yesterday by the hour: today's row follows the clock, so it differs from one run to the next.
    await w.go(
      () => win.locator('[data-day]').nth(-2).click(),
      win.locator('[data-chart="day"] [data-burst]').first(),
    )
    await w.shotWindow('usage-your-time', win)
    await win.close()
  },

  async away(w) {
    await showProject(w, PROJECT.team, 'projectTeam')
    // "Away since" shows main's clock: held on the hour, the same text comes out every run in it.
    const now = await w.app.evaluate(() => Date.now())
    await w.holdClockAt(now - (now % HOUR))
    await w.go(() => w.page.locator('#presence-chip').click(), w.page.locator('#away-banner'))
    await w.shot('away-strip', TEAM)
  },
}
