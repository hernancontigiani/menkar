import type { Key } from '../i18n'
import {
  addMember,
  type Orientation,
  type Projects,
  projectOf,
  type SavedTab,
  type SavedWindow,
} from './model'

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

const shownTabs = (w: LayoutWindow) => w.tabs.filter((t) => t.project === w.shown)

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

// Removing a tab moves its project's selection to a neighbour of the same project, or clears it.
function withoutTab(w: LayoutWindow, tabId: string): LayoutWindow {
  const index = w.tabs.findIndex((t) => t.id === tabId)
  const tab = w.tabs[index]
  if (!tab) return w
  const tabs = w.tabs.filter((t) => t.id !== tabId)
  const selected = { ...w.selected }
  if (selected[tab.project] === tabId) {
    const same = (t: Tab) => t.project === tab.project
    const neighbour =
      w.tabs.slice(index + 1).find(same) ?? w.tabs.slice(0, index).reverse().find(same)
    if (neighbour) selected[tab.project] = neighbour.id
    else delete selected[tab.project]
  }
  return { ...w, tabs, selected }
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

// Open (M18): select its tab where it has one; else make it a member of the shown project if it
// is in none, and open a tab in the window that holds its project (this one when none does).
export function openSession(
  layout: Layout,
  projects: Projects,
  windowId: string,
  sessionId: string,
  newId: () => string,
): Opened {
  const found = findSession(layout, sessionId)
  if (found) {
    const w = {
      ...found.window,
      shown: found.tab.project,
      selected: { ...found.window.selected, [found.tab.project]: found.tab.id },
    }
    return { layout: put(layout, w), projects, window: w.id, tab: found.tab.id }
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
  const after = {
    ...w,
    shown: target,
    tabs: [...w.tabs, tab],
    selected: { ...w.selected, [target]: tab.id },
  }
  return { layout: put(layout, after), projects: state, window: after.id, tab: tab.id }
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
    t.id === selected.id && t.kind === 'session' ? { ...t, panes: [...t.panes, sessionId] } : t,
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
  if (found.window.id !== windowId) {
    const moved = put(layout, withoutTab(found.window, found.tab.id))
    const w = windowOf(moved, windowId)
    const tab: Tab = { ...found.tab, project: w.shown }
    return {
      ok: true,
      layout: put(moved, {
        ...w,
        tabs: [...w.tabs, tab],
        selected: { ...w.selected, [w.shown]: tab.id },
      }),
      projects: state,
    }
  }
  if (found.tab.project === here.shown) return { ok: true, layout, projects: state }
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
  const tabs = here.tabs.map((t) =>
    t.id === found.tab.id ? { ...found.tab, project: here.shown } : t,
  )
  return { ok: true, layout: put(layout, { ...here, tabs }), projects: state }
}

// A tab opened for another tab's sake (a session one started): right after it, in its
// window, with the window's selection left as it was.
export function insertTabAfter(layout: Layout, afterTabId: string, tab: Tab): Layout {
  const w = layout.windows.find((x) => x.tabs.some((t) => t.id === afterTabId))
  if (!w) return layout
  const at = w.tabs.findIndex((t) => t.id === afterTabId) + 1
  const tabs = [...w.tabs.slice(0, at), tab, ...w.tabs.slice(at)]
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
        saved = { panes: [...tab.panes], orientation: tab.orientation }
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
