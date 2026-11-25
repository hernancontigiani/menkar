import { randomBytes } from 'node:crypto'
import {
  existsSync,
  type FSWatcher,
  mkdirSync,
  renameSync,
  rmSync,
  watch,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import {
  HELD_SUFFIX,
  heldRoot,
  quiet,
  TEAM_PREFIX,
  takeHeld,
  WAKE_PREFIX,
} from '../../../core/agents/cursor/wakes'
import { now } from '../../../core/clock'
import { wakeText } from '../../../core/control/post'
import { log } from '../../../core/log'
import type { WorkCounts } from '../../../core/orchestration/counts'
import type { MainTeamDelivery, TeamHeld, WakePane, Waker } from '../types'

// Cursor has no channel into a running chat (D1). A wake is held for the pane and handed over by
// the session's next `stop` hook as `followup_message`, so a turn running, a card open or a draft
// in the box is never touched; an idle session whose box is empty is ended and resumed with the
// held texts as its first message instead, at once or as soon as its box empties. A team update
// is only held (1.159, S7): it never restarts a session, and goes with the next wake or stop.

// A screen settles after a burst of output: its check waits this long after the first change.
export const SETTLE_MS = 250

// Restarts of one session for its wakes are spaced, so a session whose resumed turns keep failing
// on a screen read as idle is never restarted in a loop: the first goes at once, the next waits
// RESTART_GAP_MS after it, each one after that twice the gap before it, up to RESTART_GAP_MAX_MS. A
// session not restarted for four gaps starts again from the first.
export const RESTART_GAP_MS = 30_000
export const RESTART_GAP_MAX_MS = 30 * 60_000

interface Restarts {
  readonly last: number
  // How long after `last` the next restart may come.
  readonly gap: number
}

interface Entry {
  readonly name: string
  readonly team: boolean
  readonly text: string
  readonly delivered?: () => void
}

interface PaneWakes {
  entries: Entry[]
  pane: WakePane | null
  unwatch: (() => void) | null
  timer: ReturnType<typeof setTimeout> | null
  // Ending and resuming the session: what comes meanwhile waits here for the new pane.
  resuming: boolean
  queued: string[]
  // The session's restarts for its wakes, carried to each new pane; and the timer of one put off.
  restarts: Restarts | null
  retry: ReturnType<typeof setTimeout> | null
}

export class CursorWakes {
  readonly #panes = new Map<string, PaneWakes>()
  readonly #root: () => string
  #watcher: FSWatcher | null = null
  #seq = 0

  constructor(root: () => string = heldRoot) {
    this.#root = root
  }

  readonly waker: Waker = {
    // Held for a pane: with none, there is nowhere to hold it.
    wake: async (sessionId, text, counts, pane) =>
      pane ? this.#wake(sessionId, text, counts, pane) : 'no session',
    release: (pane) => this.release(pane),
  }

  readonly teller: MainTeamDelivery = {
    tell: async (_sessionId, text, counts, _current, held) => {
      if (!held) return 'no session'
      this.#holdTeam(held, wakeText(text, counts))
      return 'held'
    },
    withdraw: (pane) => {
      const wakes = this.#panes.get(pane)
      if (!wakes) return
      this.#sweep(pane, wakes)
      for (const entry of wakes.entries.filter((e) => e.team)) this.#drop(pane, wakes, entry)
    },
  }

  // What is held for the pane, in the order it goes; for tests and the log.
  held(pane: string): readonly string[] {
    const wakes = this.#panes.get(pane)
    if (!wakes) return []
    this.#sweep(pane, wakes)
    return [...wakes.entries].sort((a, b) => a.name.localeCompare(b.name)).map((e) => e.text)
  }

  release(pane: string): void {
    const wakes = this.#panes.get(pane)
    if (!wakes) return
    this.#sweep(pane, wakes)
    if (wakes.resuming) return
    this.#stopLooking(wakes)
    this.#stopRetry(wakes)
    this.#panes.delete(pane)
    if (wakes.entries.some((e) => !e.team))
      log.warn("a Cursor session's held wakes went with its pane", {
        pane,
        held: wakes.entries.length,
      })
    rmSync(join(this.#root(), pane), { recursive: true, force: true })
  }

  async #wake(
    sessionId: string,
    text: string,
    counts: WorkCounts | undefined,
    pane: WakePane,
  ): Promise<'posted'> {
    const message = wakeText(text, counts)
    const wakes = this.#of(pane.id)
    if (wakes.resuming) {
      wakes.queued.push(message)
      return 'posted'
    }
    this.#write(pane.id, wakes, WAKE_PREFIX, message)
    this.#look(wakes, pane)
    if (quiet(pane.screen())) await this.#resumeWhenDue(sessionId, pane, wakes)
    else log.info('a wake for a Cursor session is held until it can take it', { pane: pane.id })
    return 'posted'
  }

  #holdTeam(held: TeamHeld, text: string): void {
    const wakes = this.#of(held.pane)
    this.#sweep(held.pane, wakes)
    for (const entry of wakes.entries.filter((e) => e.team)) this.#drop(held.pane, wakes, entry)
    this.#write(held.pane, wakes, TEAM_PREFIX, text, () => held.delivered())
  }

  #of(pane: string): PaneWakes {
    let wakes = this.#panes.get(pane)
    if (!wakes) {
      wakes = {
        entries: [],
        pane: null,
        unwatch: null,
        timer: null,
        resuming: false,
        queued: [],
        restarts: null,
        retry: null,
      }
      this.#panes.set(pane, wakes)
    }
    return wakes
  }

  // Whole into the pane's folder: written beside it, then renamed in. A folder the stop hook took
  // meanwhile is made again, so the text waits for the next stop.
  #write(pane: string, wakes: PaneWakes, prefix: string, text: string, delivered?: () => void) {
    const root = this.#root()
    this.#seq += 1
    const name = `${prefix}${String(now()).padStart(15, '0')}-${String(this.#seq).padStart(6, '0')}${HELD_SUFFIX}`
    const temporary = join(root, `.tmp-${randomBytes(6).toString('hex')}`)
    mkdirSync(root, { recursive: true })
    this.#watchRoot(root)
    writeFileSync(temporary, text, { mode: 0o600 })
    for (let tries = 0; ; tries++) {
      mkdirSync(join(root, pane), { recursive: true, mode: 0o700 })
      try {
        renameSync(temporary, join(root, pane, name))
        break
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || tries >= 3) {
          rmSync(temporary, { force: true })
          throw error
        }
      }
    }
    wakes.entries.push({
      name,
      team: prefix === TEAM_PREFIX,
      text,
      ...(delivered ? { delivered } : {}),
    })
  }

  #drop(pane: string, wakes: PaneWakes, entry: Entry): void {
    wakes.entries = wakes.entries.filter((e) => e !== entry)
    rmSync(join(this.#root(), pane, entry.name), { force: true })
  }

  // The files the stop hook took were handed over to the session.
  #sweep(pane: string, wakes: PaneWakes): void {
    const folder = join(this.#root(), pane)
    const gone = wakes.entries.filter((e) => !existsSync(join(folder, e.name)))
    if (gone.length === 0) return
    wakes.entries = wakes.entries.filter((e) => !gone.includes(e))
    log.info('what was held for a Cursor session was handed over at its turn end', {
      pane,
      texts: gone.length,
    })
    for (const entry of gone) entry.delivered?.()
  }

  #watchRoot(root: string): void {
    if (this.#watcher) return
    try {
      this.#watcher = watch(root, () => {
        for (const [pane, wakes] of this.#panes) this.#sweep(pane, wakes)
      })
      this.#watcher.on('error', (error) => {
        log.warn("the held wakes' folder could not be watched", { error })
        this.#watcher?.close()
        this.#watcher = null
      })
    } catch (error) {
      log.warn("the held wakes' folder could not be watched", { error })
    }
  }

  // Looks at the pane's screen while it holds a wake: the box emptying lets the session be resumed.
  #look(wakes: PaneWakes, pane: WakePane): void {
    if (wakes.pane?.id === pane.id && wakes.unwatch) return
    this.#stopLooking(wakes)
    wakes.pane = pane
    wakes.unwatch = pane.onScreen(() => {
      if (wakes.timer) return
      wakes.timer = setTimeout(() => {
        wakes.timer = null
        this.#sweep(pane.id, wakes)
        if (!wakes.entries.some((e) => !e.team)) {
          this.#stopLooking(wakes)
          return
        }
        if (!wakes.resuming && quiet(pane.screen())) void this.#resumeWhenDue(null, pane, wakes)
      }, SETTLE_MS)
    })
  }

  #stopLooking(wakes: PaneWakes): void {
    wakes.unwatch?.()
    wakes.unwatch = null
    if (wakes.timer) clearTimeout(wakes.timer)
    wakes.timer = null
  }

  #stopRetry(wakes: PaneWakes): void {
    if (wakes.retry) clearTimeout(wakes.retry)
    wakes.retry = null
  }

  // Resumes the idle session now, or once its last restart is far enough behind: until then what is
  // held stays held, and still goes with the session's next turn end.
  async #resumeWhenDue(sessionId: string | null, pane: WakePane, wakes: PaneWakes): Promise<void> {
    const wait = wakes.restarts ? wakes.restarts.last + wakes.restarts.gap - now() : 0
    if (wait <= 0) return this.#resume(sessionId, pane, wakes)
    if (wakes.retry) return
    log.info('a wake for a Cursor session waits: it was restarted for its wakes a moment ago', {
      pane: pane.id,
      waitMs: wait,
    })
    wakes.retry = setTimeout(() => {
      wakes.retry = null
      this.#sweep(pane.id, wakes)
      if (!wakes.entries.some((e) => !e.team) || wakes.resuming) return
      if (quiet(pane.screen())) void this.#resume(sessionId, pane, wakes)
    }, wait)
  }

  #noteRestart(pane: string, wakes: PaneWakes): void {
    const at = now()
    const before = wakes.restarts
    const again = before !== null && at - before.last < before.gap * 4
    wakes.restarts = {
      last: at,
      gap: again ? Math.min(before.gap * 2, RESTART_GAP_MAX_MS) : RESTART_GAP_MS,
    }
    if (again)
      log.warn('a Cursor session is restarted again for its wakes; the next restart waits longer', {
        pane,
        gapMs: wakes.restarts.gap,
      })
  }

  // Ends the idle session and resumes it with everything held as its first message.
  async #resume(sessionId: string | null, pane: WakePane, wakes: PaneWakes): Promise<void> {
    const root = this.#root()
    this.#sweep(pane.id, wakes)
    const entries = wakes.entries
    const text = takeHeld(root, pane.id)
    if (text === null) return
    wakes.entries = []
    wakes.resuming = true
    this.#stopLooking(wakes)
    this.#stopRetry(wakes)
    this.#noteRestart(pane.id, wakes)
    // Before the restart: the resumed session starts from what it was recorded to hold, this text
    // included.
    for (const entry of entries) entry.delivered?.()
    let next: string | null = null
    try {
      next = await pane.resume(text)
    } catch (error) {
      log.warn('a Cursor session could not be resumed to take its wakes', { pane: pane.id, error })
    }
    wakes.resuming = false
    if (next === null) {
      // Held again, as they were, for the next chance; a team update counted as handed over stays
      // counted, since it will be.
      for (const entry of [...entries].sort((x, y) => x.name.localeCompare(y.name)))
        this.#write(
          pane.id,
          wakes,
          entry.team ? TEAM_PREFIX : WAKE_PREFIX,
          entry.text,
          entry.delivered,
        )
      for (const message of wakes.queued.splice(0))
        this.#write(pane.id, wakes, WAKE_PREFIX, message)
      this.#look(wakes, pane)
      return
    }
    log.info('an idle Cursor session was resumed to take its wakes', {
      session: sessionId,
      from: pane.id,
      to: next,
    })
    const queued = wakes.queued.splice(0)
    this.#panes.delete(pane.id)
    rmSync(join(root, pane.id), { recursive: true, force: true })
    // What came while it restarted waits for the new pane's first turn to end.
    const after = this.#of(next)
    after.restarts = wakes.restarts
    for (const message of queued) this.#write(next, after, WAKE_PREFIX, message)
  }
}
