// Per scene, the imperative walk: go somewhere, wait for proof the screen is real, shoot. Screens
// are stateful, so the walks run in the registry's order within one launch.
import type { Locator, Page } from '@playwright/test'
import type { Scene, Slug } from './registry'
import { PROJECT, type Text } from './seed'

// What the screen must show before a shot, from the seed's own numbers.
export interface Proof {
  // The project shown in the header, by its seeded name.
  readonly project: Text
  // The open tasks of a project in the orchestration mode: the sidebar lists the first few and
  // counts them all in its See all link.
  readonly openTasks?: number
}

export interface Walker {
  readonly page: Page
  // The seed's text in this launch's locale.
  text(key: Text): string
  // Runs `action`, then waits for `ready` to be visible.
  go(action: () => Promise<void>, ready: Locator): Promise<void>
  // The registry's clip, if the capture has one, is applied here.
  shot(slug: Slug, proof: Proof): Promise<void>
}

export type SceneWalk = (w: Walker) => Promise<void>

// The Northwind app's open tasks: 2, 3, 4 and 5 (1 is done today, 6 dropped).
const OPEN_TASKS = 4

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
    await w.shot('hero-orchestration', { project: 'projectTeam', openTasks: OPEN_TASKS })
  },

  async board(w) {
    const done = w.page.locator('#board-panel [data-column="done"] .task-card')
    await w.go(() => w.page.locator('#board-button').click(), done)
    await w.shot('board-default', { project: 'projectTeam', openTasks: OPEN_TASKS })
    await w.go(
      () => w.page.locator('#board-button').click(),
      w.page.locator('#board-button[aria-pressed="false"]'),
    )
  },

  async firstTimeCard(w) {
    const row = w.page.locator(`.project-row[data-project="${PROJECT.site}"]`)
    await w.go(() => w.page.locator('#project-button').click(), row)
    await w.go(
      () => row.click(),
      w.page.locator('#project-button .project-name', { hasText: w.text('projectSite') }),
    )
    await w.go(
      () => w.page.locator('#orchestration-switch').click(),
      w.page.locator('.orch-card .responses button').last(),
    )
    await w.shot('first-time-card', { project: 'projectSite' })
  },
}
