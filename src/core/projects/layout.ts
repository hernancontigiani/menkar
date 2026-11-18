import type { Key } from '../i18n'
import {
  addMember,
  type Orientation,
  type Projects,
  projectOf,
  type SavedTab,
  type SavedWindow,
} from './model'
import type { TabPlace } from './place'

export const MAX_PANES = 2

// A tab belongs to the project its window showed when it opened. A session tab's panes are the
// sessions that joined a project, primary first; a new session not joined yet, a fork before
// joining and chat are transient: never saved, never reopened.
export type Tab =
  | {
      readonly kind: 'session'
      readonly id: string
      readonly project: string
      readonly panes: readonly string[]
      readonly orientation: Orientation
      // Absent: an ordinary tab. Only an orchestrator's worker's tab with one pane has one.
      readonly place?: TabPlace
    }
  | {
      readonly kind: 'file'
      readonly id: string
      readonly project: string
      readonly path: string
      readonly preview: boolean
    }
  | { readonly kind: 'transient'; readonly id: string; readonly project: string }

export type SessionTab = Extract<Tab, { kind: 'session' }>

export interface LayoutWindow {
  readonly id: string
  readonly shown: string
  readonly tabs: readonly Tab[]
  // The tab last selected in each project this window holds.
  readonly selected: Readonly<Record<string, string>>
  // The window manager's maximize, not full screen; a window the start restores maximizes when set.
  readonly maximized?: boolean
}

export interface Layout {
  readonly windows: readonly LayoutWindow[]
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// The window that shows a project or has a tab of it: a project is in one window at most.
export function holder(layout: Layout, projectId: string): string | undefined {
  return layout.windows.find(
    (w) => w.shown === projectId || w.tabs.some((t) => t.project === projectId),
  )?.id
}

const placeOf = (tab: Tab): TabPlace | undefined => (tab.kind === 'session' ? tab.place : undefined)
const drawn = (tab: Tab) => placeOf(tab) !== 'background'
const shownTabs = (w: LayoutWindow) => w.tabs.filter((t) => t.project === w.shown && drawn(t))

function placed(tab: SessionTab, place?: TabPlace): SessionTab {
  const { place: _old, ...rest } = tab
  return place === undefined ? rest : { ...rest, place }
}

function insertAt(tabs: readonly Tab[], at: number, tab: Tab): Tab[] {
  return [...tabs.slice(0, at), tab, ...tabs.slice(at)]
}

const lastOf = (tabs: readonly Tab[], projectId: string) =>
  tabs.map((t) => t.project).lastIndexOf(projectId)

// After the project's last tab: where the peek goes.
function atEnd(tabs: readonly Tab[], tab: Tab): Tab[] {
  const last = lastOf(tabs, tab.project)
  return insertAt(tabs, last < 0 ? tabs.length : last + 1, tab)
}

// Last among the project's tabs, but before its peek, which stays the last one.
function beforePeek(tabs: readonly Tab[], tab: Tab): Tab[] {
  const peek = tabs.findIndex((t) => t.project === tab.project && placeOf(t) === 'peek')
  return peek < 0 ? atEnd(tabs, tab) : insertAt(tabs, peek, tab)
}

export function shownTab(w: LayoutWindow): string | null {
  const tabs = shownTabs(w)
  const remembered = w.selected[w.shown]
  if (remembered !== undefined && tabs.some((t) => t.id === remembered)) return remembered
  return tabs[0]?.id ?? null
}

function windowOf(layout: Layout, id: string): LayoutWindow {
  const w = layout.windows.find((x) => x.id === id)
  if (!w) throw new Error(`no window ${id}`)
  return w
}

const put = (layout: Layout, w: LayoutWindow): Layout => ({
  windows: layout.windows.map((x) => (x.id === w.id ? w : x)),
})

function findSession(
  layout: Layout,
  sessionId: string,
): { window: LayoutWindow; tab: SessionTab } | undefined {
  for (const window of layout.windows) {
    for (const tab of window.tabs) {
      if (tab.kind === 'session' && tab.panes.includes(sessionId)) return { window, tab }
    }
  }
  return undefined
}

// A tab leaving the strip moves its project's selection to a drawn neighbour of the same
// project, or clears it.
function selectionWithout(w: LayoutWindow, tabId: string): Record<string, string> {
  const index = w.tabs.findIndex((t) => t.id === tabId)
  const tab = w.tabs[index]
  const selected = { ...w.selected }
  if (tab && selected[tab.project] === tabId) {
    const same = (t: Tab) => t.project === tab.project && drawn(t)
    const neighbour =
      w.tabs.slice(index + 1).find(same) ?? w.tabs.slice(0, index).reverse().find(same)
    if (neighbour) selected[tab.project] = neighbour.id
    else delete selected[tab.project]
  }
  return selected
}

function withoutTab(w: LayoutWindow, tabId: string): LayoutWindow {
  if (!w.tabs.some((t) => t.id === tabId)) return w
  return { ...w, tabs: w.tabs.filter((t) => t.id !== tabId), selected: selectionWithout(w, tabId) }
}

// The one writer of a selection (decision 1.176): a background tab becomes its project's peek,
// moved last, and the project's previous peek goes back to the background; any other tab is just
// selected. The window shows the tab's project.
export function select(layout: Layout, windowId: string, tabId: string): Layout {
  const w = windowOf(layout, windowId)
  const tab = w.tabs.find((t) => t.id === tabId)
  if (!tab) return layout
  let tabs = w.tabs
  if (tab.kind === 'session' && tab.place === 'background') {
    const rest = w.tabs
      .filter((t) => t.id !== tabId)
      .map((t) =>
        t.kind === 'session' && t.project === tab.project && t.place === 'peek'
          ? placed(t, 'background')
          : t,
      )
    tabs = atEnd(rest, placed(tab, 'peek'))
  }
  return put(layout, {
    ...w,
    tabs,
    shown: tab.project,
    selected: { ...w.selected, [tab.project]: tabId },
  })
}

// Closing a worker's tab (decision 1.176): it stays in the layout, undrawn, its process running.
export function toBackground(layout: Layout, windowId: string, tabId: string): Layout {
  const w = windowOf(layout, windowId)
  const tab = w.tabs.find((t) => t.id === tabId)
  if (tab?.kind !== 'session' || tab.panes.length !== 1 || tab.place === 'background') return layout
  const tabs = w.tabs.map((t) => (t.id === tabId ? placed(tab, 'background') : t))
  return put(layout, { ...w, tabs, selected: selectionWithout(w, tabId) })
}

// Makes a worker's tab ordinary and selects it: the peek where it is (already last), a background
// tab right before its project's peek.
export function pin(layout: Layout, windowId: string, tabId: string): Layout {
  const w = windowOf(layout, windowId)
  const tab = w.tabs.find((t) => t.id === tabId)
  if (tab?.kind !== 'session' || tab.place === undefined) return select(layout, windowId, tabId)
  const tabs =
    tab.place === 'peek'
      ? w.tabs.map((t) => (t.id === tabId ? placed(tab) : t))
      : beforePeek(
          w.tabs.filter((t) => t.id !== tabId),
          placed(tab),
        )
  return put(layout, {
    ...w,
    tabs,
    shown: tab.project,
    selected: { ...w.selected, [tab.project]: tabId },
  })
}

// A tab whose session no longer qualifies (`keep` false: not a worker any more, with you, a role,
// the mode off) becomes ordinary and nothing stops. A selected peek stays where it is, selected;
// any other goes last among its project's tabs, before the peek. The same layout when nothing
// changes.
export function ordinaryUnless(layout: Layout, keep: (tab: SessionTab) => boolean): Layout {
  const loses = (t: Tab): t is SessionTab =>
    t.kind === 'session' && t.place !== undefined && !(t.panes.length === 1 && keep(t))
  if (!layout.windows.some((w) => w.tabs.some(loses))) return layout
  return {
    windows: layout.windows.map((w) => {
      if (!w.tabs.some(loses)) return w
      let tabs: Tab[] = []
      const moved: SessionTab[] = []
      for (const t of w.tabs) {
        if (!loses(t)) tabs.push(t)
        else if (t.place === 'peek' && w.selected[t.project] === t.id) tabs.push(placed(t))
        else moved.push(placed(t))
      }
      for (const t of moved) tabs = beforePeek(tabs, t)
      return { ...w, tabs }
    }),
  }
}

export type SwitchOutcome =
  | { readonly kind: 'same' }
  | { readonly kind: 'focus'; readonly window: string }
  | { readonly kind: 'shown'; readonly layout: Layout }

export function switchProject(layout: Layout, windowId: string, projectId: string): SwitchOutcome {
  const w = windowOf(layout, windowId)
  if (w.shown === projectId) return { kind: 'same' }
  const other = holder(layout, projectId)
  if (other !== undefined && other !== windowId) return { kind: 'focus', window: other }
  return { kind: 'shown', layout: put(layout, { ...w, shown: projectId }) }
}

export type BringOutcome =
  | { readonly kind: 'brought'; readonly layout: Layout; readonly from: string | null }
  | { readonly kind: 'refused'; readonly refusal: Key }

// Moves a project's tabs, in their order and with the one selected, from the window that holds it
// to this one, which shows it. When that window showed it, it shows its most recent other project
// that no other window holds, then one never used, in the projects' order.
export function bringProject(
  layout: Layout,
  windowId: string,
  projectId: string,
  recent: readonly string[],
  projectIds: readonly string[],
): BringOutcome {
  const here = windowOf(layout, windowId)
  const fromId = holder(layout, projectId)
  if (fromId === undefined || fromId === windowId)
    return { kind: 'brought', layout: put(layout, { ...here, shown: projectId }), from: null }
  const from = windowOf(layout, fromId)
  const moved = from.tabs.filter((t) => t.project === projectId)
  const chosen = from.selected[projectId]
  const { [projectId]: _left, ...fromSelected } = from.selected
  let next = put(layout, {
    ...here,
    shown: projectId,
    tabs: [...here.tabs, ...moved],
    selected: chosen === undefined ? here.selected : { ...here.selected, [projectId]: chosen },
  })
  let left: LayoutWindow = {
    ...from,
    tabs: from.tabs.filter((t) => t.project !== projectId),
    selected: fromSelected,
  }
  if (from.shown === projectId) {
    next = put(next, left)
    const free = (id: string) => id !== projectId && [undefined, fromId].includes(holder(next, id))
    const order = [...recent.filter((id) => projectIds.includes(id)), ...projectIds]
    const shown = order.find(free)
    if (shown === undefined) return { kind: 'refused', refusal: 'layout.nothingElse' }
    left = { ...left, shown }
  }
  return { kind: 'brought', layout: put(next, left), from: fromId }
}

export interface Opened {
  readonly layout: Layout
  readonly projects: Projects
  // The window that shows the session's tab, to bring forward when it is not the one asked.
  readonly window: string
  readonly tab: string
}

export interface OpenOptions {
  // Open a worker's background tab or peek as an ordinary tab instead of peeking it.
  readonly pin?: boolean
  // Who is an orchestrator's worker: another session's new tab opens before the workers' tabs.
  readonly worker?: (sessionId: string) => boolean
}

// Open (M18): select its tab where it has one; else make it a member of the shown project if it
// is in none, and open a tab in the window that holds its project (this one when none does).
export function openSession(
  layout: Layout,
  projects: Projects,
  windowId: string,
  sessionId: string,
  newId: () => string,
  options: OpenOptions = {},
): Opened {
  const found = findSession(layout, sessionId)
  if (found) {
    const choose = options.pin === true ? pin : select
    const next = choose(layout, found.window.id, found.tab.id)
    return { layout: next, projects, window: found.window.id, tab: found.tab.id }
  }
  const here = windowOf(layout, windowId)
  const member = projectOf(projects, sessionId)
  const state = member ? projects : addMember(projects, here.shown, sessionId)
  const target = member?.id ?? here.shown
  const other = target === here.shown ? undefined : holder(layout, target)
  const w = other !== undefined && other !== windowId ? windowOf(layout, other) : here
  const tab: Tab = {
    kind: 'session',
    id: newId(),
    project: target,
    panes: [sessionId],
    orientation: 'horizontal',
  }
  const worker = options.worker ?? (() => false)
  const tabs = worker(sessionId) ? beforePeek(w.tabs, tab) : afterOrdinary(w.tabs, tab, worker)
  const after = { ...w, shown: target, tabs, selected: { ...w.selected, [target]: tab.id } }
  return { layout: put(layout, after), projects: state, window: after.id, tab: tab.id }
}

// The strip's order is ordinary tabs, pinned workers, the peek: a session that is not a worker
// opens after its project's last tab that is not a worker's.
function afterOrdinary(
  tabs: readonly Tab[],
  tab: Tab,
  worker: (sessionId: string) => boolean,
): Tab[] {
  const ordinary = (t: Tab) =>
    t.project === tab.project &&
    !(t.kind === 'session' && (t.place !== undefined || t.panes.some(worker)))
  const last = tabs.findLastIndex(ordinary)
  if (last >= 0) return insertAt(tabs, last + 1, tab)
  const first = tabs.findIndex((t) => t.project === tab.project)
  return first < 0 ? [...tabs, tab] : insertAt(tabs, first, tab)
}

export type BesideOutcome =
  | { readonly kind: 'open' }
  | { readonly kind: 'noop' }
  | { readonly kind: 'refused'; readonly refusal: Key }
  | { readonly kind: 'done'; readonly layout: Layout; readonly projects: Projects }

// Open beside the current tab (M19).
export function openBeside(
  layout: Layout,
  projects: Projects,
  windowId: string,
  sessionId: string,
): BesideOutcome {
  const w = windowOf(layout, windowId)
  const selectedId = shownTab(w)
  const selected = w.tabs.find((t) => t.id === selectedId)
  if (selected?.kind !== 'session' || selected.project !== w.shown) return { kind: 'open' }
  const member = projectOf(projects, sessionId)
  if (member && member.id !== w.shown) return { kind: 'refused', refusal: 'layout.otherProject' }
  if (selected.panes.includes(sessionId)) return { kind: 'noop' }
  if (selected.panes.length >= MAX_PANES) return { kind: 'refused', refusal: 'layout.twoPanesMax' }
  const found = findSession(layout, sessionId)
  if (found && found.tab.panes.length >= MAX_PANES)
    return { kind: 'refused', refusal: 'layout.alreadyBeside' }
  let next = layout
  if (found) next = put(next, withoutTab(windowOf(next, found.window.id), found.tab.id))
  const current = windowOf(next, windowId)
  const tabs = current.tabs.map((t) =>
    t.id === selected.id && t.kind === 'session'
      ? { ...placed(t), panes: [...t.panes, sessionId] }
      : t,
  )
  return {
    kind: 'done',
    layout: put(next, { ...current, tabs }),
    projects: member ? projects : addMember(projects, w.shown, sessionId),
  }
}

export type MoveOutcome =
  | { readonly ok: true; readonly layout: Layout; readonly projects: Projects }
  | { readonly ok: false; readonly refusal: Key }

// Picking a session in Add session (Add, Move from…): it joins this window's project, and its tab
// comes with it — from another window when it is alone there; within this window, its pane alone.
export function moveSessionHere(
  layout: Layout,
  projects: Projects,
  windowId: string,
  sessionId: string,
  newId: () => string,
): MoveOutcome {
  const here = windowOf(layout, windowId)
  const found = findSession(layout, sessionId)
  if (found && found.window.id !== windowId && found.tab.panes.length >= MAX_PANES) {
    return { ok: false, refusal: 'layout.sharesTab' }
  }
  const state = addMember(projects, here.shown, sessionId)
  if (!found) return { ok: true, layout, projects: state }
  // A worker's tab arrives in the background and is selected, so it becomes the peek.
  const arriving = (tab: SessionTab): SessionTab =>
    tab.place === undefined ? tab : placed(tab, 'background')
  if (found.window.id !== windowId) {
    const moved = put(layout, withoutTab(found.window, found.tab.id))
    const w = windowOf(moved, windowId)
    const tab = arriving({ ...found.tab, project: w.shown })
    const tabs = tab.place === undefined ? beforePeek(w.tabs, tab) : [...w.tabs, tab]
    return {
      ok: true,
      layout: select(put(moved, { ...w, tabs }), windowId, tab.id),
      projects: state,
    }
  }
  if (found.tab.project === here.shown) {
    const peeked =
      found.tab.place === 'background' ? select(layout, windowId, found.tab.id) : layout
    return { ok: true, layout: peeked, projects: state }
  }
  if (found.tab.panes.length >= MAX_PANES) {
    const rest = found.tab.panes.filter((p) => p !== sessionId)
    const alone: Tab = {
      kind: 'session',
      id: newId(),
      project: here.shown,
      panes: [sessionId],
      orientation: 'horizontal',
    }
    const tabs = [
      ...here.tabs.map((t) => (t.id === found.tab.id ? { ...found.tab, panes: rest } : t)),
      alone,
    ]
    return { ok: true, layout: put(layout, { ...here, tabs }), projects: state }
  }
  const tab = arriving({ ...found.tab, project: here.shown })
  const tabs = here.tabs.map((t) => (t.id === found.tab.id ? tab : t))
  const next = put(layout, { ...here, tabs })
  return {
    ok: true,
    layout: tab.place === undefined ? next : select(next, windowId, tab.id),
    projects: state,
  }
}

// A tab opened for another tab's sake (a session one started): right after it, in its
// window, with the window's selection left as it was; a drawn tab never after the peek.
export function insertTabAfter(layout: Layout, afterTabId: string, tab: Tab): Layout {
  const w = layout.windows.find((x) => x.tabs.some((t) => t.id === afterTabId))
  if (!w) return layout
  const after = w.tabs.findIndex((t) => t.id === afterTabId) + 1
  const peek = w.tabs.findIndex((t) => t.project === tab.project && placeOf(t) === 'peek')
  const at = placeOf(tab) === undefined && peek >= 0 && peek < after ? peek : after
  const tabs = insertAt(w.tabs, at, tab)
  return { windows: layout.windows.map((x) => (x === w ? { ...w, tabs } : x)) }
}

export function closeTab(layout: Layout, windowId: string, tabId: string): Layout {
  return put(layout, withoutTab(windowOf(layout, windowId), tabId))
}

// A tab dragged within its strip: put before `before`, or last among its project's tabs when null.
// Only within one project of one window; anything else leaves the layout as it was.
export function moveTab(
  layout: Layout,
  windowId: string,
  tabId: string,
  before: string | null,
): Layout {
  const w = windowOf(layout, windowId)
  const moving = w.tabs.find((t) => t.id === tabId)
  if (!moving || before === tabId) return layout
  const rest = w.tabs.filter((t) => t.id !== tabId)
  let at: number
  if (before === null) {
    const last = rest.map((t) => t.project).lastIndexOf(moving.project)
    at = last + 1
  } else {
    at = rest.findIndex((t) => t.id === before)
    if (at < 0 || rest[at]?.project !== moving.project) return layout
  }
  return put(layout, { ...w, tabs: [...rest.slice(0, at), moving, ...rest.slice(at)] })
}

// Next (1) or previous (-1) among the shown project's tabs, wrapping; null with fewer than two.
export function stepTab(w: LayoutWindow, direction: 1 | -1): string | null {
  const tabs = shownTabs(w)
  if (tabs.length < 2) return null
  const index = Math.max(
    0,
    tabs.findIndex((t) => t.id === shownTab(w)),
  )
  return tabs[(index + direction + tabs.length) % tabs.length]?.id ?? null
}

export function nthTab(w: LayoutWindow, n: number): string | null {
  return n >= 1 ? (shownTabs(w)[n - 1]?.id ?? null) : null
}

export function newWindowProject(layout: Layout, projects: Projects): string | null {
  return projects.projects.find((p) => holder(layout, p.id) === undefined)?.id ?? null
}

export function removeWindow(layout: Layout, windowId: string): Layout {
  return { windows: layout.windows.filter((w) => w.id !== windowId) }
}

export function setMaximized(layout: Layout, windowId: string, maximized: boolean): Layout {
  return {
    windows: layout.windows.map((w) => (w.id === windowId ? { ...w, maximized } : w)),
  }
}

export function toSaved(layout: Layout): SavedWindow[] {
  return layout.windows.map((w) => {
    const tabs: Record<string, SavedTab[]> = {}
    for (const tab of w.tabs) {
      let saved: SavedTab | undefined
      if (tab.kind === 'session' && tab.panes.length > 0)
        saved = {
          panes: [...tab.panes],
          orientation: tab.orientation,
          ...(tab.place === undefined ? {} : { place: 'background' as const }),
        }
      if (tab.kind === 'file') saved = { file: tab.path, preview: tab.preview }
      if (saved) {
        const list = tabs[tab.project] ?? []
        list.push(saved)
        tabs[tab.project] = list
      }
    }
    return { current: w.shown, tabs, maximized: w.maximized === true }
  })
}

export interface ReopenOptions {
  readonly reopenTabs: boolean
  readonly isFile: (path: string) => boolean
  readonly newId: () => string
}

// What reopens on start, from the saved windows as the file had them.
export function reopen(projects: Projects, options: ReopenOptions): Layout {
  // Without tabs to reopen, the one window still opens as the first saved one was.
  const first = projects.windows.find(isObject)
  const single = (): Layout => ({
    windows: [
      {
        id: options.newId(),
        shown: projects.current,
        tabs: [],
        selected: {},
        maximized: first?.maximized === true,
      },
    ],
  })
  if (!options.reopenTabs) return single()
  const exists = new Set(projects.projects.map((p) => p.id))
  const taken = new Set<string>()
  const placed = new Set<string>()
  const windows: LayoutWindow[] = []
  for (const raw of projects.windows) {
    if (!isObject(raw) || typeof raw.current !== 'string') continue
    const tabs: Tab[] = []
    for (const [projectId, list] of Object.entries(isObject(raw.tabs) ? raw.tabs : {})) {
      if (!exists.has(projectId) || taken.has(projectId) || !Array.isArray(list)) continue
      const members = new Set(projects.projects.find((p) => p.id === projectId)?.members ?? [])
      for (const saved of list) {
        if (!isObject(saved)) continue
        if (Array.isArray(saved.panes)) {
          const panes = saved.panes
            .filter(
              (id): id is string => typeof id === 'string' && members.has(id) && !placed.has(id),
            )
            .slice(0, MAX_PANES)
          if (panes.length === 0) continue
          for (const id of panes) placed.add(id)
          const orientation: Orientation =
            saved.orientation === 'vertical' ? 'vertical' : 'horizontal'
          tabs.push({
            kind: 'session',
            id: options.newId(),
            project: projectId,
            panes,
            orientation,
            ...(saved.place === 'background' ? { place: 'background' as const } : {}),
          })
        } else if (typeof saved.file === 'string' && options.isFile(saved.file)) {
          tabs.push({
            kind: 'file',
            id: options.newId(),
            project: projectId,
            path: saved.file,
            preview: saved.preview === true,
          })
        }
      }
    }
    const current = raw.current
    const shown = exists.has(current) && !taken.has(current) ? current : tabs[0]?.project
    if (shown === undefined) continue
    taken.add(shown)
    for (const tab of tabs) taken.add(tab.project)
    windows.push({
      id: options.newId(),
      shown,
      tabs,
      selected: {},
      maximized: raw.maximized === true,
    })
  }
  return windows.length > 0 ? { windows } : single()
}
