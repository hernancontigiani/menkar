import type { AgentStates } from '../core/agentstate/shown'
import { faceBadge, groupState, rollup, type ShownState } from '../core/agentstate/shown'
import { now } from '../core/clock'
import type { Reading } from '../core/context/types'
import { formatTime } from '../core/format'
import type { Key } from '../core/i18n'
import type { ProjectInfo } from '../core/projects/info'
import { RING_RADIUS, RING_SIZE, RING_STROKE, ringOf } from '../core/ring'
import { relativeTime } from '../core/sessions/history'
import type { SessionInfo } from '../core/sessions/info'
import { DEFAULT_SETTINGS, SIDEBAR_MIN_WIDTH } from '../core/settings'
import type { Action, ActionResult, TabView, WindowState } from '../shared/workspace'
import { openAddSession } from './addsession'
import { mountChat } from './chat'
import { el, icon } from './dom'
import { fileElement, forgetFilesExcept, setFileTheme } from './editor'
import { openFileDialog } from './fileopen'
import { t, translate } from './i18n'
import { applyLook } from './look'
import { infoItems } from './sessionmenus'
import {
  applyTerminalLook,
  focusPane,
  forgetPanesExcept,
  paneElement,
  showPanes,
} from './terminals'
import {
  closePopover,
  type MenuEntry,
  type MenuItem,
  showDialog,
  showError,
  showMenu,
  showPopover,
  toast,
  unsavedQuestion,
} from './ui'

let state: WindowState | undefined
// Per tab: the pane that had the focus last, and whether it is zoomed (neither is saved).
export const focusedPane = new Map<string, string>()
export const zoomedTabs = new Set<string>()
// The drawers' height in this window, once dragged (decision 1.29: kept while the app runs, not
// saved); until then 30 % of the tab. And which tabs showed theirs at the last render.
let drawerHeight: number | null = null
const drawerWasShown = new Set<string>()
let prefixPill = false
export function setPrefixPill(shown: boolean): void {
  prefixPill = shown
  document.getElementById('prefix-pill')?.toggleAttribute('hidden', !shown)
}
let agentStates: AgentStates | null = null
const liveReadings = new Map<string, Reading | null>()

window.menkar.agentState.onChanged((states) => {
  agentStates = states
  if (state) render(state)
})
window.menkar.agentState.onToast(({ paneId, text }) => {
  toast(text, { action: { label: t('toast.show'), run: () => window.menkar.panes.reveal(paneId) } })
})
window.menkar.context.onReading(({ sessionId, reading }) => {
  liveReadings.set(sessionId, reading)
  if (state) render(state)
})

export type DotState = ShownState | 'stopped'

// A session with a pane shows its agent's state (idle until one is known); without one, stopped.
function sessionState(id: string): DotState {
  const panes = agentStates?.panes.filter((p) => p.sessionId === id) ?? []
  if (panes.length > 0) return rollup(panes.map((p) => p.state))
  return state?.open.includes(id) ? 'idle' : 'stopped'
}

export const sessionDotState: Record<DotState, Key> = {
  idle: 'state.idle',
  working: 'state.working',
  blocked: 'state.blocked',
  done: 'state.done',
  stopped: 'state.stopped',
}

export function stateDot(dotState: DotState): HTMLElement {
  return el('span', { class: `dot ${dotState}`, title: translate(sessionDotState[dotState]) })
}

function readingOf(id: string): Reading | null {
  return liveReadings.has(id) ? (liveReadings.get(id) ?? null) : (state?.readings[id] ?? null)
}

// A track at 25 % and an arc from 12 o'clock over the percentage.
function ring(reading: Reading | null): HTMLElement | null {
  if (!reading) return null
  const r = ringOf(
    reading,
    state ? { warn: state.settings.ring_warn, full: state.settings.ring_full } : undefined,
  )
  const c = RING_SIZE / 2
  const length = 2 * Math.PI * RING_RADIUS
  const node = el('span', { class: 'ring', title: translate(r.title.key, r.title.values) })
  const circle = (opacity: number, extra: string) =>
    `<circle cx="${c}" cy="${c}" r="${RING_RADIUS}" fill="none" stroke="${r.color}" stroke-width="${RING_STROKE}" opacity="${opacity}"${extra}/>`
  node.innerHTML = `<svg width="${RING_SIZE}" height="${RING_SIZE}" viewBox="0 0 ${RING_SIZE} ${RING_SIZE}">${circle(r.trackOpacity, '')}${circle(r.arcOpacity, ` stroke-dasharray="${length * r.fraction} ${length}" transform="rotate(-90 ${c} ${c})"`)}</svg>`
  return node
}

function blockedPill(count: number): HTMLElement | null {
  return count > 0
    ? el('span', { class: 'blocked-pill', title: t('projects.waiting') }, String(count))
    : null
}

// Menkar's star (the app's logo), in the color of the text around it.
const STAR_SVG =
  '<svg viewBox="0 0 100 100" fill="currentColor" aria-hidden="true"><path d="M50 2 L56 44 L98 50 L56 56 L50 98 L44 56 L2 50 L44 44Z"/><path d="M50 22 L54 46 L78 50 L54 54 L50 78 L46 54 L22 50 L46 46Z" transform="rotate(45 50 50)"/></svg>'

// The logo at the empty states' size, in the theme's dim foreground.
function titleStar(): HTMLElement {
  const node = el('span', { class: 'title-star' })
  node.innerHTML = STAR_SVG
  return node
}

export function logo(size: 'big' | 'compact'): HTMLElement {
  const node = el('span', { class: `logo ${size}` })
  node.innerHTML = STAR_SVG
  return node
}
let sidebarShown = true
let lastSelected: string | null = null
const SIDEBAR_SAVE_DELAY_MS = 600
const TITLE_CHARS = 28

export const act = (action: Action) => window.menkar.window.act(action)
export const currentState = () => state

const $ = (id: string) => document.getElementById(id) as HTMLElement

// ---------------------------------------------------------------- the frame, built once

export function buildFrame(): void {
  const toggle = el(
    'button',
    { id: 'toggle-sidebar', title: t('header.toggleSidebar'), 'aria-pressed': 'true' },
    icon('sidebar'),
  )
  toggle.addEventListener('click', () => toggleSidebar())
  const newMenu = el(
    'button',
    { id: 'new-menu', class: 'header-text', title: t('header.newTooltip') },
    icon('plus'),
    t('header.new'),
  )
  newMenu.addEventListener('click', () => {
    const r = newMenu.getBoundingClientRect()
    newMenuAt({ x: r.left, y: r.bottom + 4 })
  })

  const projectButton = el(
    'button',
    { id: 'project-button', title: t('projects.dropdown') },
    el('span', { class: 'project-name' }),
    icon('down'),
  )
  projectButton.addEventListener('click', () => openProjectPopover(projectButton))
  const settings = el(
    'button',
    { id: 'settings-button', class: 'header-text', title: t('header.settingsTooltip') },
    icon('gear'),
    t('header.settings'),
  )
  settings.addEventListener('click', () => void act({ type: 'openSettings' }))
  const usage = el(
    'button',
    { id: 'usage-button', class: 'header-text', title: t('header.usageTooltip') },
    icon('chart'),
    t('header.usage'),
  )
  usage.addEventListener('click', () => void act({ type: 'openUsage' }))
  const addSession = el('button', { id: 'add-session' }, t('sidebar.addSession'))
  addSession.addEventListener('click', () => openAddSession('existing'))

  const divider = el('div', { id: 'divider' })
  dragDivider(divider)
  divider.addEventListener('dblclick', () => {
    const width = DEFAULT_SETTINGS.sidebar_width
    document.documentElement.style.setProperty('--sidebar-width', `${width}px`)
    if (sidebarShown) void act({ type: 'setSidebarWidth', width })
  })

  $('app').replaceChildren(
    el(
      'aside',
      { id: 'sidebar' },
      el('div', { class: 'sidebar-header' }, projectButton, settings),
      el('div', { id: 'session-list' }),
      el('div', { id: 'files-section' }),
      addSession,
    ),
    divider,
    el(
      'main',
      { id: 'content' },
      el(
        'div',
        { class: 'content-header' },
        toggle,
        newMenu,
        usage,
        el(
          'div',
          { class: 'title' },
          titleStar(),
          el('span', { class: 'title-text' }, t('window.title')),
        ),
      ),
      el('div', { id: 'tab-strip' }),
      el('div', { id: 'tab-content' }),
      el('div', { id: 'toasts' }),
    ),
  )
  // A double click on a header's empty space maximizes and restores, as on a title bar.
  for (const header of document.querySelectorAll<HTMLElement>('.sidebar-header, .content-header')) {
    header.addEventListener('dblclick', (event) => {
      const target = event.target as HTMLElement
      if (target.closest('button')) return
      if (target === header || target.closest('.title')) void act({ type: 'toggleMaximize' })
    })
  }
}

export function toggleSidebar(): void {
  sidebarShown = !sidebarShown
  $('sidebar').classList.toggle('hidden', !sidebarShown)
  $('divider').classList.toggle('hidden', !sidebarShown)
  $('toggle-sidebar').setAttribute('aria-pressed', String(sidebarShown))
}

function dragDivider(divider: HTMLElement): void {
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  // The moves are followed on the window, so the drag holds wherever the pointer goes.
  divider.addEventListener('pointerdown', (event) => {
    event.preventDefault()
    const move = (e: PointerEvent) => {
      const width = Math.max(SIDEBAR_MIN_WIDTH, Math.min(e.clientX, window.innerWidth - 200))
      document.documentElement.style.setProperty('--sidebar-width', `${width}px`)
      clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        if (sidebarShown) void act({ type: 'setSidebarWidth', width })
      }, SIDEBAR_SAVE_DELAY_MS)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  })
}

// ---------------------------------------------------------------- render

const stateListeners = new Set<(s: WindowState) => void>()
export function onRender(listener: (s: WindowState) => void): () => void {
  stateListeners.add(listener)
  return () => stateListeners.delete(listener)
}

export function render(next: WindowState): void {
  const previous = state
  state = next
  for (const listener of stateListeners) listener(next)
  const look = applyLook(next.settings, (changed) => {
    applyTerminalLook(next.settings, changed)
    setFileTheme(changed.dark)
    syncTitleBar()
  })
  setFileTheme(look.dark)
  if (previous?.settings !== next.settings) applyTerminalLook(next.settings, look)
  // Only on a change: a render in the middle of a drag must not snap the divider back.
  if (!previous || previous.settings.sidebar_width !== next.settings.sidebar_width) {
    document.documentElement.style.setProperty(
      '--sidebar-width',
      `${next.settings.sidebar_width}px`,
    )
  }
  const project = next.projects.find((p) => p.id === next.shown)
  $('project-button')
    .querySelector('.project-name')
    ?.replaceChildren(project?.name ?? '')
  $('project-button').querySelector('.blocked-pill')?.remove()
  const face = blockedPill(faceBadge(agentStates?.blocked ?? {}, next.shown))
  if (face) $('project-button').querySelector('.project-name')?.after(face)
  document.documentElement.classList.toggle('maximized', next.maximized)
  renderSessionList(next, project)
  renderStrip(next)
  renderContent(next)
  renderNotices(next)
  syncTitleBar()
}

// The window buttons the system draws over the header take the header's colors and height: as
// drawn, so a translucent header over the window's background comes out as one opaque color.
// Read after the render, from styles only: a layout forced in the middle of a render left the
// terminals of hidden tabs without their rows.
let titleBarSent = ''
let titleBarQueued = false
function syncTitleBar(): void {
  if (titleBarQueued) return
  titleBarQueued = true
  setTimeout(() => {
    titleBarQueued = false
    sendTitleBar()
  })
}

function sendTitleBar(): void {
  const header = document.querySelector<HTMLElement>('.content-header')
  if (!header) return
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  const drawn = (...colors: string[]) => {
    ctx.clearRect(0, 0, 1, 1)
    for (const c of colors) {
      ctx.fillStyle = c
      ctx.fillRect(0, 0, 1, 1)
    }
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return `#${[r, g, b].map((v) => (v ?? 0).toString(16).padStart(2, '0')).join('')}`
  }
  const style = getComputedStyle(header)
  const color = drawn(getComputedStyle(document.body).backgroundColor, style.backgroundColor)
  const symbolColor = drawn(color, style.color)
  // Above the header's bottom line, which stays visible under the window buttons.
  const height = Math.round(
    Number.parseFloat(style.minHeight) - Number.parseFloat(style.borderBottomWidth),
  )
  const key = `${color} ${symbolColor} ${height}`
  if (key === titleBarSent || height === 0) return
  titleBarSent = key
  void act({ type: 'titleBar', color, symbolColor, height })
}

const sessionsById = (s: WindowState) => new Map(s.sessions.map((x) => [x.id, x]))
const folderOf = (info: SessionInfo) =>
  (info.cwd ?? info.folder).split('/').filter(Boolean).pop() ?? info.cwd ?? ''

function renderSessionList(s: WindowState, project: ProjectInfo | undefined): void {
  const list = $('session-list')
  $('files-section').replaceChildren(...(project ? filesSection(s, project) : []))
  if (!project) {
    list.replaceChildren()
    return
  }
  const byId = sessionsById(s)
  // Earlier conversations (decision 1.63) are members, listed only in their session's menu.
  const earlierHere = new Set(Object.values(project.earlier).flat())
  const known = project.members.filter((id) => byId.has(id) && !earlierHere.has(id))
  if (known.length === 0 && s.sessionsLoading) {
    const star = el('span', { class: 'turning-star' })
    star.innerHTML = STAR_SVG
    list.replaceChildren(
      el('div', { class: 'sessions-loading turning dim' }, star, t('sidebar.loading')),
    )
    return
  }
  if (known.length === 0) {
    const add = el('button', { class: 'pill' }, t('sidebar.addSession'))
    add.addEventListener('click', () => openAddSession('existing'))
    list.replaceChildren(
      el(
        'div',
        { class: 'status-page compact' },
        logo('compact'),
        el('div', { class: 'heading' }, t('empty.projectTitle', { name: project.name })),
        el('div', { class: 'body dim' }, t('empty.projectBody')),
        add,
      ),
    )
    return
  }
  // Hidden in this project (decision 1.25): out of the list unless this window shows them, dimmed.
  const hiddenHere = new Set(project.hidden.filter((id) => byId.has(id) && !earlierHere.has(id)))
  const listed = (id: string) =>
    !earlierHere.has(id) && (!hiddenHere.has(id) || showHiddenInProject)
  const folders = new Set(
    known.map((id) => {
      const info = byId.get(id)
      return info ? folderOf(info) : ''
    }),
  )
  const showFolder = folders.size > 1
  const running = new Set(s.running)
  const grouped = new Set(project.groups.flatMap((g) => g.members))
  const children: HTMLElement[] = []
  const shownGroups = project.groups.filter((g) => g.members.some((m) => byId.has(m) && listed(m)))
  const selected = new Set(
    s.tabs.find((tab) => tab.id === s.selectedTab)?.panes.map((p) => p.sessionId) ?? [],
  )
  for (const group of shownGroups) {
    const members = group.members.filter((id) => byId.has(id) && listed(id))
    if (!group.collapsed) {
      children.push(groupHeading(project.id, group, null))
      for (const id of members) {
        const info = byId.get(id)
        if (info) children.push(row(info, showFolder, running.has(id), project, group.name))
      }
      continue
    }
    const runningMembers = group.members.filter((id) => running.has(id))
    const readings = runningMembers.flatMap((id) => {
      const reading = readingOf(id)
      return reading ? [reading] : []
    })
    children.push(
      groupHeading(project.id, group, {
        count: members.length,
        leaderName: group.leader ? (byId.get(group.leader)?.name ?? null) : null,
        state: groupState(runningMembers.map(runningState)) ?? 'stopped',
        reading: readings.sort((a, b) => b.percentage - a.percentage)[0] ?? null,
        holdsSelected: group.members.some((id) => selected.has(id)),
      }),
    )
  }
  const loose = known.filter((id) => !grouped.has(id) && listed(id))
  if (loose.length > 0 && shownGroups.length > 0)
    children.push(el('div', { class: 'group-heading dim' }, t('sidebar.noGroup')))
  for (const id of loose) {
    const info = byId.get(id)
    if (info) children.push(row(info, showFolder, running.has(id), project, ''))
  }
  if (hiddenHere.size > 0) {
    const foot = el(
      'button',
      { class: 'hidden-foot dim', 'aria-pressed': String(showHiddenInProject) },
      t('sidebar.hiddenCount', { n: hiddenHere.size }),
    )
    foot.addEventListener('click', () => {
      showHiddenInProject = !showHiddenInProject
      if (state) render(state)
    })
    children.push(foot)
  }
  list.replaceChildren(...children)
  if (rowDrag) {
    list.append(rowDrag.marker)
    list.querySelector(`.row[data-session="${rowDrag.sessionId}"]`)?.classList.add('dragging')
  }
}

type GroupView = ProjectInfo['groups'][number]

interface Collapsed {
  readonly count: number
  readonly leaderName: string | null
  readonly state: DotState
  readonly reading: Reading | null
  readonly holdsSelected: boolean
}

// A running member's state; one whose pane reported nothing yet is idle.
function runningState(id: string): ShownState {
  const panes = agentStates?.panes.filter((p) => p.sessionId === id) ?? []
  return panes.length > 0 ? rollup(panes.map((p) => p.state)) : 'idle'
}

// Collapsed, the heading stands for the rows it hides: nothing expands it but a click on it.
function groupHeading(project: string, group: GroupView, collapsed: Collapsed | null): HTMLElement {
  const node = el(
    'button',
    {
      class: `group-heading dim${collapsed ? ' collapsed' : ''}${collapsed?.holdsSelected ? ' contains-selected' : ''}`,
      'aria-expanded': String(!collapsed),
      'aria-label': collapsed ? t('groups.expand') : t('groups.collapse'),
    },
    groupDot(group.color),
  )
  if (!collapsed) node.append(group.name)
  else {
    const name = el(
      'span',
      { class: 'group-name' },
      t('groups.nameCount', { name: group.name, n: collapsed.count }),
    )
    name.style.color = group.color
    node.append(name)
    if (collapsed.leaderName)
      node.append(
        el('span', { class: 'group-leader' }, t('groups.leaderOn', { name: collapsed.leaderName })),
      )
    node.append(el('span', { class: 'group-fill' }), stateDot(collapsed.state))
    const ringNode = ring(collapsed.reading)
    if (ringNode) node.append(ringNode)
  }
  node.addEventListener('click', () => {
    void act({ type: 'collapseGroup', project, group: group.name, collapsed: !collapsed })
  })
  return node
}

function groupLine(color: string): HTMLElement {
  const line = el('span', { class: 'group-line' })
  line.style.background = color
  return line
}

function groupDot(color: string): HTMLElement {
  const dot = el('span', {}, '●')
  dot.style.color = color
  return dot
}

// Decision 1.62: the newest few, then "N more…".
const FILES_SHOWN = 5

// The project's files folder at the foot of the list (decision 1.51): its heading collapses it,
// ⬇ brings a shared file in, 📂 opens the folder; a row opens on double click and drags out.
function filesSection(s: WindowState, project: ProjectInfo): HTMLElement[] {
  const collapsed = s.files.collapsed
  const toggle = el(
    'button',
    {
      class: `files-toggle dim${collapsed ? ' collapsed' : ''}`,
      'aria-expanded': String(!collapsed),
      'aria-label': collapsed ? t('files.expand') : t('files.collapse'),
    },
    t('files.heading', { n: s.files.items.length }),
  )
  toggle.addEventListener('click', () => void act({ type: 'collapseFiles', collapsed: !collapsed }))
  const bring = el(
    'button',
    { class: 'header-text files-add', 'data-key': 'files-bring', title: t('files.bring') },
    icon('trayIn'),
    t('files.add'),
  )
  bring.addEventListener('click', () => void bringFiles(bring, project.name))
  const open = el(
    'button',
    { class: 'files-button', 'data-key': 'files-open', title: t('files.openFolder') },
    '📂',
  )
  open.addEventListener('click', () => void act({ type: 'openFilesFolder' }))
  const head = el(
    'div',
    { class: `files-heading${collapsed ? ' collapsed' : ''}` },
    toggle,
    bring,
    open,
  )
  if (collapsed) return [head]
  const items = s.files.items
  const rows = [head, ...items.slice(0, FILES_SHOWN).map(fileRow)]
  if (items.length > FILES_SHOWN) {
    // The rest are in the folder: the file manager lists them better than a long sidebar.
    const more = el(
      'button',
      { class: 'file-more dim', 'data-key': 'files-more' },
      t('files.more', { n: items.length - FILES_SHOWN }),
    )
    more.addEventListener('click', () => void act({ type: 'openFilesFolder' }))
    rows.push(more)
  }
  return rows
}

function fileAge(mtimeMs: number): string {
  const r = relativeTime(mtimeMs, now())
  return 'date' in r ? r.date : translate(r.key, r.params)
}

function fileRow(file: { readonly name: string; readonly mtimeMs: number }): HTMLElement {
  const node = el(
    'div',
    { class: 'file-row', draggable: 'true', 'data-file': file.name, title: file.name },
    el('span', { class: 'file-name' }, file.name),
    el('span', { class: 'file-age dim' }, fileAge(file.mtimeMs)),
  )
  node.addEventListener('dblclick', () => void act({ type: 'openProjectFile', name: file.name }))
  node.addEventListener('contextmenu', (event) => {
    event.preventDefault()
    void fileMenu(file.name, { x: event.clientX, y: event.clientY })
  })
  // Main starts the drag with the file it resolves itself; the page only names it.
  node.addEventListener('dragstart', (event) => {
    event.preventDefault()
    void act({ type: 'dragProjectFile', name: file.name })
  })
  return node
}

async function fileMenu(name: string, at: { x: number; y: number }): Promise<void> {
  const { refusal } = await act({ type: 'checkProjectFile', name })
  showMenu(
    [
      {
        label: t('files.openInMenkar'),
        ...(refusal ? { disabled: true, title: translate(refusal) } : {}),
        run: () => void openInMenkar(name),
      },
      {
        label: t('files.openWithSystem'),
        run: () => void act({ type: 'openProjectFile', name, with: 'system' }),
      },
    ],
    at,
  )
}

async function openInMenkar(name: string): Promise<void> {
  const { refusal } = await act({ type: 'openProjectFile', name, with: 'menkar' })
  if (refusal) toast(translate(refusal))
}

async function bringFiles(anchor: HTMLElement, projectName: string): Promise<void> {
  if (state?.settings.files_bring !== 'newest')
    return brought(await act({ type: 'bringFiles' }), projectName)
  const { incoming } = await act({ type: 'newestIncoming' })
  const r = anchor.getBoundingClientRect()
  const entries: MenuEntry[] =
    incoming && incoming.length > 0
      ? incoming.map((f) => ({
          label: `${f.name} · ${fileAge(f.mtimeMs)}`,
          run: () =>
            void act({ type: 'bringFiles', paths: [f.path] }).then((result) =>
              brought(result, projectName),
            ),
        }))
      : [{ label: t('files.noneIncoming'), disabled: true, run: () => undefined }]
  showMenu(entries, { x: r.left, y: r.bottom + 4 })
}

const UNDO_MS = 8000

function brought(result: ActionResult, projectName: string): void {
  const done = result.brought
  if (!done) return
  const text =
    done.names.length === 1
      ? t('files.brought', { name: done.names[0] ?? '', project: projectName })
      : t('files.broughtMany', { n: done.names.length, project: projectName })
  toast(text, {
    ms: UNDO_MS,
    action: { label: t('files.undo'), run: () => void act({ type: 'undoBring', undo: done.undo }) },
  })
}

export async function openPaneFolder(tab: string, pane: string | null): Promise<void> {
  const { refusal } = await act({ type: 'openPaneFolder', tab, pane })
  if (refusal) toast(translate(refusal))
}

async function openSessionFolder(session: string): Promise<void> {
  const { refusal } = await act({ type: 'openSessionFolder', session })
  if (refusal) toast(translate(refusal))
}

// Per window and not saved: whether the project's hidden members are listed, dimmed.
let showHiddenInProject = false

// `section` is the row's group name, or '' in "No group".
function row(
  info: SessionInfo,
  showFolder: boolean,
  running: boolean,
  project: ProjectInfo,
  section: string,
): HTMLElement {
  const dot = stateDot(sessionState(info.id))
  const leads = project.groups.some((g) => g.name === section && g.leader === info.id)
  const phone = phoneIcon(info.id)
  if (phone) queueMicrotask(() => dot.after(phone))
  const more = el(
    'button',
    { class: 'more', title: t('sidebar.actionsFor', { name: info.name }) },
    icon('more'),
  )
  const node = el(
    'div',
    {
      class: `row${project.hidden.includes(info.id) ? ' hidden-member' : ''}`,
      'data-session': info.id,
      'data-section': section,
    },
    dot,
    el(
      'div',
      { class: 'text' },
      leads
        ? el(
            'div',
            { class: 'name' },
            el('span', { class: 'name-text' }, info.name),
            el('span', { class: 'leader-star', title: t('row.leaderStar') }, '★'),
          )
        : el('div', { class: 'name' }, info.name),
      showFolder ? el('div', { class: 'folder dim' }, folderOf(info)) : null,
    ),
    more,
  )
  // Only while its agent runs (decision 1.21): a stopped session's estimate is too often wrong.
  const ringNode = running ? ring(readingOf(info.id)) : null
  if (ringNode) more.before(ringNode)
  const menu = (x: number, y: number) => showMenu(rowMenu(info, running, project), { x, y })
  more.addEventListener('click', (event) => {
    event.stopPropagation()
    const r = more.getBoundingClientRect()
    menu(r.left, r.bottom + 4)
  })
  node.addEventListener('contextmenu', (event) => {
    event.preventDefault()
    menu(event.clientX, event.clientY)
  })
  dragToReorder({
    node,
    id: info.id,
    container: () => $('session-list'),
    // Only its own section's rows: a drop never changes a row's group.
    items: () =>
      [...$('session-list').querySelectorAll<HTMLElement>('.row')].filter(
        (r) => r.dataset.section === section,
      ),
    idOf: (item) => item.dataset.session,
    axis: 'y',
    markerClass: 'row-marker',
    ignore: '.more',
    started: (drag) => {
      rowDrag = drag ? { sessionId: info.id, marker: drag.marker } : null
    },
    dropped: ({ next, last }) => {
      const target = next ?? last
      if (target)
        void act({
          type: 'moveSession',
          session: info.id,
          target,
          place: next ? 'before' : 'after',
        })
    },
  })
  node.addEventListener('click', () => {
    if (justDragged) return
    const tab = state?.tabs.find((tb) => tb.panes.some((p) => p.sessionId === info.id))
    if (tab) void act({ type: 'selectTab', tab: tab.id })
  })
  node.addEventListener('dblclick', () => {
    if (!justDragged) void act({ type: 'openSession', session: info.id })
  })
  return node
}

function rowMenu(info: SessionInfo, running: boolean, project: ProjectInfo): MenuEntry[] {
  const groups = project.groups.map((g) => ({
    label: g.name,
    run: () =>
      void act({ type: 'setGroup', session: info.id, group: { name: g.name, color: g.color } }),
  }))
  const entries: MenuEntry[] = [
    { label: t('row.open'), run: () => void act({ type: 'openSession', session: info.id }) },
    {
      label: t('row.openBeside'),
      run: () => void openBeside(info.id),
    },
    { label: t('row.openFolder'), run: () => void openSessionFolder(info.id) },
  ]
  const earlier = earlierMenu(info.id, project)
  if (earlier) entries.push(earlier)
  // Stop applies to a session with a tab, whatever its agent is doing right now.
  if (running || state?.open.includes(info.id))
    entries.push({
      label: t('row.stop'),
      run: () => void act({ type: 'stopSession', session: info.id }),
    })
  if (info.agent === 'claude') entries.push(remoteItem(info.id))
  entries.push({
    label: t('row.group'),
    submenu: [
      ...groups,
      {
        label: t('row.noGroup'),
        run: () => void act({ type: 'setGroup', session: info.id, group: null }),
      },
      { label: t('row.newGroup'), run: () => void newGroupDialog(info.id) },
    ],
  })
  const group = project.groups.find((g) => g.members.includes(info.id))
  if (group) {
    const leads = group.leader === info.id
    entries.push({
      label: leads ? t('row.notLeader') : t('row.makeLeader'),
      run: () => void act({ type: 'setLeader', session: info.id, leader: !leads }),
    })
  }
  entries.push('separator')
  entries.push({ label: t('row.rename'), run: () => void renameSessionDialog(info) })
  if (info.agent === 'claude')
    entries.push({
      label: t('row.fork'),
      run: () => void act({ type: 'forkSession', session: info.id }),
    })
  entries.push(...infoItems(info))
  entries.push('separator')
  if (project.hidden.includes(info.id))
    entries.push({
      label: t('row.showInProject'),
      run: () => void act({ type: 'showSession', session: info.id }),
    })
  else {
    // Only a session without a tab: a tab is never without its row.
    const hasTab = state?.open.includes(info.id) ?? false
    entries.push({
      label: t('row.hideInProject'),
      disabled: hasTab,
      ...(hasTab ? { title: t('projects.hideRunning') } : {}),
      run: () => void act({ type: 'hideSession', session: info.id }),
    })
  }
  entries.push({ label: t('row.remove'), run: () => void removeFromProject(info, running) })
  return entries
}

// The sessions this one's tab left (decision 1.63), newest first by their last activity; opening
// one makes it a row of the list again.
function earlierMenu(session: string, project: ProjectInfo): MenuEntry | null {
  const byId = state ? sessionsById(state) : new Map<string, SessionInfo>()
  const earlier = (project.earlier[session] ?? [])
    .flatMap((id) => {
      const info = byId.get(id)
      return info ? [info] : []
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
  if (earlier.length === 0) return null
  return {
    label: t('row.earlier'),
    submenu: earlier.map((info) => ({
      label: `${info.name} · ${formatTime(info.mtimeMs)}`,
      run: () => void act({ type: 'openSession', session: info.id }),
    })),
  }
}

async function openBeside(session: string): Promise<void> {
  const { refusal, value } = await act({ type: 'openBeside', session })
  if (refusal) return toast(translate(refusal))
  const tab = state?.selectedTab
  if (typeof value === 'string' && tab) {
    focusedPane.set(tab, value)
    requestAnimationFrame(() => focusPane(value))
  }
}

function renderStrip(s: WindowState): void {
  const strip = $('tab-strip')
  const tabs = s.tabs.filter((tab) => tab.project === s.shown)
  const nodes = tabs.map((tab) => tabButton(tab, tab.id === s.selectedTab))
  const plus = el('button', { id: 'strip-plus', title: t('tab.newInProject') }, '+')
  plus.addEventListener('click', () => openAddSession('new'))
  const pill = el('span', { id: 'prefix-pill' }, 'PREFIX')
  pill.toggleAttribute('hidden', !prefixPill)
  strip.replaceChildren(...nodes, plus, pill)
  if (tabDrag) {
    strip.append(tabDrag.marker)
    strip.querySelector(`.tab[data-tab="${tabDrag.tabId}"]`)?.classList.add('dragging')
  }
}

function shortTitle(title: string): string {
  return title.length > TITLE_CHARS ? `${title.slice(0, TITLE_CHARS)}…` : title
}

// The rolled-up state of a set of panes; idle when none is known.
export function tabStateOf(paneIds: readonly string[]): DotState {
  const states =
    agentStates?.panes.filter((p) => paneIds.includes(p.paneId)).map((p) => p.state) ?? []
  return states.length > 0 ? rollup(states) : 'idle'
}

let showHidden = false
export const showHiddenSessions = () => showHidden
export function toggleShowHidden(): void {
  showHidden = !showHidden
  if (state) render(state)
}

// A tab shows its state unless idle, and the fullest of its sessions' rings.
function tabDot(tab: TabView): HTMLElement | null {
  const states =
    agentStates?.panes
      .filter((p) => tab.panes.some((pane) => pane.id === p.paneId))
      .map((p) => p.state) ?? []
  if (states.length === 0) return null
  const rolled = rollup(states)
  return rolled === 'idle' ? null : stateDot(rolled)
}

function tabRing(tab: TabView): HTMLElement | null {
  if (tab.file?.unsaved) return el('span', { class: 'unsaved-dot', title: t('files.unsavedDot') })
  const readings = tab.panes.flatMap((p) => {
    const reading = p.sessionId ? readingOf(p.sessionId) : null
    return reading ? [reading] : []
  })
  const fullest = readings.sort((a, b) => b.percentage - a.percentage)[0]
  return ring(fullest ?? null)
}

// Reordering by dragging (decision 1.23 for tabs, 2026-11-10 for the session rows): past a few
// pixels it is a drag, shown by a marker in the gap it would drop into; let go outside the
// container and nothing moves. The drop lands before `next`, or after `last` when no item follows.
const DRAG_THRESHOLD_PX = 5
interface Drop {
  readonly next: string | null
  readonly last: string | null
}
interface ReorderDrag {
  readonly node: HTMLElement
  readonly id: string
  readonly container: () => HTMLElement
  // The items it can drop among, itself included, in order.
  readonly items: () => HTMLElement[]
  readonly idOf: (item: HTMLElement) => string | undefined
  readonly axis: 'x' | 'y'
  readonly markerClass: string
  readonly ignore?: string
  readonly started: (drag: { readonly marker: HTMLElement } | null) => void
  readonly dropped: (drop: Drop) => void
}
// Set by the pointerup that ends a drag, so the click that follows is not a click.
let justDragged = false

function dragToReorder(options: ReorderDrag): void {
  const { node, id, axis } = options
  node.addEventListener('pointerdown', (down) => {
    if (down.button !== 0) return
    if (options.ignore && (down.target as HTMLElement).closest(options.ignore)) return
    const container = options.container()
    let marker: HTMLElement | null = null
    let drop: Drop = { next: null, last: null }
    const place = (at: number) => {
      const others = options.items().filter((item) => options.idOf(item) !== id)
      const next = others.find((item) => {
        const r = item.getBoundingClientRect()
        return axis === 'x' ? at < r.left + r.width / 2 : at < r.top + r.height / 2
      })
      const last = others[others.length - 1]
      drop = {
        next: next ? (options.idOf(next) ?? null) : null,
        last: last ? (options.idOf(last) ?? null) : null,
      }
      const anchor = next ?? last
      if (!anchor || !marker) return
      const r = anchor.getBoundingClientRect()
      const c = container.getBoundingClientRect()
      if (axis === 'x')
        marker.style.left = `${(next ? r.left - 2 : r.right + 1) - c.left + container.scrollLeft}px`
      else marker.style.top = `${(next ? r.top - 1 : r.bottom - 1) - c.top + container.scrollTop}px`
    }
    const move = (event: PointerEvent) => {
      if (!marker) {
        if (
          Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY) < DRAG_THRESHOLD_PX
        )
          return
        // Alone in its container there is nowhere else to drop.
        if (!options.items().some((item) => options.idOf(item) !== id)) return
        marker = el('span', { class: options.markerClass })
        container.append(marker)
        node.classList.add('dragging')
        options.started({ marker })
      }
      place(axis === 'x' ? event.clientX : event.clientY)
    }
    // A cancelled pointer (the system took it) ends the drag with nothing moved.
    const up = (event: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (!marker) return
      marker.remove()
      options.started(null)
      for (const item of options.items()) item.classList.remove('dragging')
      justDragged = true
      setTimeout(() => {
        justDragged = false
      })
      const c = container.getBoundingClientRect()
      const inside =
        event.clientX >= c.left &&
        event.clientX <= c.right &&
        event.clientY >= c.top &&
        event.clientY <= c.bottom
      if (event.type === 'pointerup' && inside && (drop.next ?? drop.last)) options.dropped(drop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  })
}

// The drags in progress, kept across renders: the strip and the list are rebuilt on every state.
let tabDrag: { tabId: string; marker: HTMLElement } | null = null
let rowDrag: { sessionId: string; marker: HTMLElement } | null = null

function tabButton(tab: TabView, selected: boolean): HTMLElement {
  const close = el('span', { class: 'close', role: 'button', title: t('tab.close') }, icon('close'))
  const node = el(
    'button',
    { class: `tab${selected ? ' selected' : ''}`, 'data-tab': tab.id, title: tab.tooltip },
    tabDot(tab),
    el('span', { class: 'title' }, shortTitle(tab.title)),
    tabRing(tab),
    close,
    tab.groupColor ? groupLine(tab.groupColor) : null,
  )
  close.addEventListener('click', (event) => {
    event.stopPropagation()
    void closeTabAsking(tab.id)
  })
  dragToReorder({
    node,
    id: tab.id,
    container: () => $('tab-strip'),
    items: () => [...$('tab-strip').querySelectorAll<HTMLElement>('.tab')],
    idOf: (item) => item.dataset.tab,
    axis: 'x',
    markerClass: 'tab-marker',
    ignore: '.close',
    started: (drag) => {
      tabDrag = drag ? { tabId: tab.id, marker: drag.marker } : null
    },
    dropped: ({ next }) => void act({ type: 'moveTab', tab: tab.id, before: next }),
  })
  node.addEventListener('click', () => {
    if (justDragged) justDragged = false
    else void act({ type: 'selectTab', tab: tab.id })
  })
  node.addEventListener('auxclick', (event) => {
    if (event.button === 1) void closeTabAsking(tab.id)
  })
  node.addEventListener('contextmenu', (event) => {
    event.preventDefault()
    const r = node.getBoundingClientRect()
    const first = tab.panes[0]?.sessionId
    showMenu(
      [
        { label: t('tab.menuRename'), run: () => void renameTab(tab) },
        {
          label: t('tab.menuCopyId'),
          run: () => first && void act({ type: 'copyText', text: first }),
        },
        { label: t('tab.menuSwap'), run: () => void act({ type: 'swapOrientation', tab: tab.id }) },
        {
          label: t('row.openFolder'),
          run: () => void openPaneFolder(tab.id, focusedPane.get(tab.id) ?? null),
        },
        { label: t('tab.menuClose'), run: () => void closeTabAsking(tab.id) },
        {
          label: t('tab.menuCloseOthers'),
          run: () => void act({ type: 'closeOtherTabs', tab: tab.id }),
        },
        { label: t('tab.menuCloseAll'), run: () => void act({ type: 'closeAllTabs' }) },
        ...remoteTabItems(tab),
      ],
      { x: r.left, y: r.bottom + 2 },
    )
  })
  return node
}

const tabBodies = new Map<string, HTMLElement>()
let loadingContent: HTMLElement | undefined
let emptyContent: HTMLElement | null = null

// Only when they differ, in nodes or order.
function setChildren(parent: HTMLElement, children: readonly HTMLElement[]): void {
  const now = parent.children
  if (now.length === children.length && children.every((c, i) => now[i] === c)) return
  parent.replaceChildren(...children)
}

function renderContent(s: WindowState): void {
  // Re-attaching the kept nodes below takes the focus away from an editor or terminal in them.
  const active = document.activeElement
  const content = $('tab-content')
  const live = new Set(
    s.tabs.flatMap((tab) => [
      ...tab.panes.map((p) => p.id),
      ...(tab.drawer ? [tab.drawer.id] : []),
    ]),
  )
  forgetPanesExcept(live)
  forgetFilesExcept(new Set(s.tabs.filter((tab) => tab.file).map((tab) => tab.id)))
  forgetChatsExcept(new Set(s.tabs.filter((tab) => tab.chat !== undefined).map((tab) => tab.id)))
  // Patched in place: a node moved in the DOM loses a click in progress on it (a find bar's
  // button, a terminal) and its focus, and states arrive often while agents start and stop.
  const bodies: HTMLElement[] = []
  for (const tab of s.tabs) {
    const visible = tab.id === s.selectedTab && tab.project === s.shown
    let body = tabBodies.get(tab.id)
    if (!body) {
      body = el('div', { 'data-tab-body': tab.id })
      tabBodies.set(tab.id, body)
    }
    body.className = `tab-body ${tab.orientation}${visible ? '' : ' hidden'}`
    const zoomed = zoomedTabs.has(tab.id) && tab.panes.length === 2
    const focused = focusedPane.get(tab.id)
    const children: HTMLElement[] = []
    if (tab.file) children.push(fileElement(tab))
    if (tab.chat !== undefined) children.push(chatElement(tab.id, tab.chat))
    for (const pane of tab.panes) {
      const node = paneElement(pane)
      node.classList.toggle('hidden', zoomed && pane.id !== focused)
      children.push(node)
    }
    if (tab.drawer) {
      const node = drawerElement(tab.drawer)
      node.classList.toggle('hidden', !tab.drawer.shown)
      children.push(node)
    }
    body.classList.toggle('with-drawer', tab.drawer?.shown === true)
    if (tab.drawer?.shown) body.style.setProperty('--drawer-height', `${drawerPixels()}px`)
    setChildren(body, children)
    if (tab.panes.length < 2) zoomedTabs.delete(tab.id)
    bodies.push(body)
  }
  for (const id of tabBodies.keys()) if (!s.tabs.some((tab) => tab.id === id)) tabBodies.delete(id)
  if (s.sessionsLoading && !s.tabs.some((tab) => tab.project === s.shown)) {
    loadingContent ??= el(
      'div',
      { class: 'status-page turning', id: 'loading-content' },
      logo('big'),
    )
    bodies.push(loadingContent)
  } else if (!s.tabs.some((tab) => tab.id === s.selectedTab && tab.project === s.shown)) {
    emptyContent ??= el(
      'div',
      { class: 'status-page', id: 'empty-content' },
      logo('big'),
      el('div', { class: 'heading' }, t('empty.noSessionTitle')),
      el('div', { class: 'body dim' }, t('empty.noSessionBody')),
    )
    bodies.push(emptyContent)
  }
  setChildren(content, bodies)
  if (active instanceof HTMLElement && active.isConnected && document.activeElement !== active)
    active.focus()
  const selected = s.tabs.find((tab) => tab.id === s.selectedTab)
  if (selected)
    showPanes(
      [
        ...[...selected.panes.map((p) => p.id)].sort((a) =>
          a === focusedPane.get(selected.id) ? -1 : 1,
        ),
        ...(selected.drawer?.shown ? [selected.drawer.id] : []),
      ],
      lastSelected !== selected.id,
    )
  lastSelected = selected?.id ?? null
  drawerFocus(s)
}

// Opening a drawer focuses it; hiding it, or its shell ending, gives the focus back to the pane
// that had it.
function drawerFocus(s: WindowState): void {
  for (const tab of s.tabs) {
    const shown = tab.drawer?.shown === true
    const was = drawerWasShown.has(tab.id)
    if (shown) drawerWasShown.add(tab.id)
    else drawerWasShown.delete(tab.id)
    if (tab.id !== s.selectedTab || shown === was) continue
    const target = shown
      ? tab.drawer?.id
      : tab.panes.some((p) => p.id === focusedPane.get(tab.id))
        ? focusedPane.get(tab.id)
        : tab.panes[0]?.id
    if (target) requestAnimationFrame(() => focusPane(target))
  }
  for (const id of drawerWasShown)
    if (!s.tabs.some((tab) => tab.id === id)) drawerWasShown.delete(id)
}

function drawerPixels(): number {
  const height = $('tab-content').clientHeight
  return Math.round(drawerHeight ?? height * 0.3)
}

// The shell under the tab's panes: a pane's terminal, with a divider on top to resize it.
function drawerElement(drawer: NonNullable<TabView['drawer']>): HTMLElement {
  const node = paneElement({ id: drawer.id, agent: 'shell', sessionId: null }, drawer.label)
  if (node.classList.contains('drawer')) return node
  node.classList.add('drawer')
  const divider = el('div', { class: 'drawer-divider', title: t('drawer.divider') })
  divider.addEventListener('pointerdown', (event) => {
    event.preventDefault()
    divider.setPointerCapture(event.pointerId)
    const move = (e: PointerEvent) => {
      const area = $('tab-content').getBoundingClientRect()
      drawerHeight = Math.min(Math.max(area.bottom - e.clientY, 60), Math.max(area.height - 60, 60))
      for (const body of tabBodies.values())
        if (body.classList.contains('with-drawer'))
          body.style.setProperty('--drawer-height', `${drawerHeight}px`)
    }
    divider.addEventListener('pointermove', move)
    divider.addEventListener('pointerup', () => divider.removeEventListener('pointermove', move), {
      once: true,
    })
  })
  const hide = el('button', { class: 'drawer-hide', title: t('drawer.hide') }, icon('down'))
  // Pressing it must not move the focus first: hiding gives it back to the pane that had it.
  hide.addEventListener('pointerdown', (event) => event.preventDefault())
  hide.addEventListener('click', () => toggleDrawer())
  node.prepend(divider)
  node.append(hide)
  return node
}

// The header's New ▾: what can be started, each with the key that does the same.
function newMenuAt(anchor: { x: number; y: number }): void {
  const tab = selectedTabView()
  const drawerOff = !tab
  showMenu(
    [
      { label: t('menu.newSession'), shortcut: 'Ctrl+Shift+T', run: () => openAddSession('new') },
      {
        label: t('menu.drawer'),
        shortcut: 'Ctrl+`',
        run: () => toggleDrawer(),
        ...(drawerOff ? { disabled: true, title: t('menu.drawerNone') } : {}),
      },
      { label: t('menu.openFile'), shortcut: 'Ctrl+Shift+O', run: () => openFileDialog() },
      { label: t('menu.newWindow'), shortcut: 'Ctrl+Shift+N', run: () => void newWindow() },
    ],
    anchor,
  )
}

// Ctrl+` (and the New menu): shows or hides the selected tab's drawer.
export function toggleDrawer(): void {
  const tab = selectedTabView()
  if (!tab) return
  const pane = focusedPane.get(tab.id) ?? tab.panes[0]?.id
  void act({ type: 'toggleDrawer', ...(pane ? { pane } : {}) })
}

let shownNotices = 0
function renderNotices(s: WindowState): void {
  s.notices.slice(shownNotices).forEach((notice, i) => {
    toast(translate(notice.key, notice.params), {
      sticky: true,
      action: {
        label: t('toast.dismiss'),
        run: () => void act({ type: 'dismissNotice', index: shownNotices + i }),
      },
    })
  })
  shownNotices = s.notices.length
}

// ---------------------------------------------------------------- dialogs

function openProjectPopover(anchor: HTMLElement): void {
  const s = state
  if (!s) return
  const content = el('div', {})
  for (const p of s.projects) {
    const rename = el('button', { title: t('projects.rename') }, icon('edit'))
    const remove = el('button', { title: t('projects.delete') }, icon('trash'))
    const node = el(
      'div',
      { class: 'project-row', 'data-project': p.id },
      el('span', { class: 'check' }, p.id === s.shown ? icon('check') : ''),
      el('span', { class: 'name' }, p.name),
      blockedPill(agentStates?.blocked[p.id] ?? 0),
      s.heldElsewhere[p.id] ? el('span', { class: 'dim' }, t('projects.openElsewhere')) : null,
      el(
        'span',
        { class: 'dim', title: t('projects.memberCount') },
        String(p.members.length - Object.values(p.earlier).flat().length),
      ),
      rename,
      remove,
    )
    node.addEventListener('click', () => {
      closePopover()
      void act({ type: 'switchProject', project: p.id })
    })
    rename.addEventListener('click', (event) => {
      event.stopPropagation()
      closePopover()
      void renameProjectDialog(p)
    })
    remove.addEventListener('click', (event) => {
      event.stopPropagation()
      closePopover()
      void deleteProjectDialog(p)
    })
    content.append(node)
  }
  const entry = el('input', { type: 'text', placeholder: t('projects.newName') })
  const create = el('button', { class: 'suggested' }, t('projects.create'))
  const error = el('div', { class: 'error-line', hidden: '' })
  const submit = async () => {
    const { refusal } = await act({ type: 'createProject', name: entry.value })
    if (refusal) {
      error.textContent = translate(refusal)
      error.hidden = false
      return
    }
    closePopover()
  }
  create.addEventListener('click', () => void submit())
  entry.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') void submit()
  })
  content.append(
    el('div', { class: 'menu-sep' }),
    el('div', { class: 'create-row' }, entry, create),
    error,
  )
  const r = anchor.getBoundingClientRect()
  showPopover(content, { x: r.left, y: r.bottom + 4 }, 'projects')
  entry.focus()
}

async function renameProjectDialog(p: ProjectInfo): Promise<void> {
  const answer = await showDialog({
    heading: t('projects.renameHeading'),
    entry: { value: p.name, placeholder: t('dialog.name') },
    buttons: [
      { label: t('dialog.cancel'), value: 'cancel' },
      { label: t('dialog.save'), value: 'save', style: 'suggested' },
    ],
    defaultValue: 'save',
  })
  if (answer.value !== 'save') return
  const { refusal } = await act({ type: 'renameProject', project: p.id, name: answer.text })
  if (refusal) await showError(t('projects.notRenamed'), refusal)
}

async function deleteProjectDialog(p: ProjectInfo): Promise<void> {
  const s = state
  if (!s) return
  if (s.projects.length <= 1) {
    await showError(t('projects.notDeleted'), 'projects.lastProject')
    return
  }
  // Asked now: a session running in another window changes no state this window was sent.
  const fresh = await window.menkar.window.state()
  const running = p.members.filter((id) => (fresh ?? s).running.includes(id)).length
  const body =
    running > 0
      ? `${t('projects.deleteBody')} ${t('projects.deleteRunning', { n: running })}`
      : t('projects.deleteBody')
  const answer = await showDialog({
    heading: t('projects.deleteHeading', { name: p.name }),
    body,
    buttons: [
      { label: t('dialog.cancel'), value: 'cancel' },
      { label: t('projects.deleteButton'), value: 'delete', style: 'destructive' },
    ],
    defaultValue: 'cancel',
  })
  if (answer.value === 'delete') await act({ type: 'deleteProject', project: p.id })
}

async function newGroupDialog(session: string): Promise<void> {
  const answer = await showDialog({
    heading: t('groups.newHeading'),
    body: t('groups.newBody'),
    entry: { value: '', placeholder: t('dialog.name') },
    buttons: [
      { label: t('dialog.cancel'), value: 'cancel' },
      { label: t('dialog.save'), value: 'save', style: 'suggested' },
    ],
    defaultValue: 'save',
  })
  if (answer.value !== 'save') return
  const { refusal } = await act({ type: 'newGroup', session, name: answer.text })
  if (refusal) await showError(t('groups.notCreated'), refusal)
}

export async function renameSessionDialog(info: SessionInfo): Promise<void> {
  if (info.claudeNamed) {
    await showDialog({
      heading: t('row.claudeNameHeading'),
      body: t('row.claudeNameBody'),
      buttons: [{ label: t('dialog.ok'), value: 'ok' }],
      defaultValue: 'ok',
    })
    return
  }
  const current = info.name !== info.preview && info.name !== info.id.slice(0, 8) ? info.name : ''
  const answer = await showDialog({
    heading: t('row.renameHeading'),
    body: info.preview || info.id,
    entry: { value: current, placeholder: t('row.renamePlaceholder') },
    buttons: [
      { label: t('dialog.cancel'), value: 'cancel' },
      { label: t('dialog.save'), value: 'save', style: 'suggested' },
    ],
    defaultValue: 'save',
  })
  if (answer.value === 'save')
    await act({ type: 'renameSession', session: info.id, name: answer.text })
}

async function removeFromProject(info: SessionInfo, running: boolean): Promise<void> {
  if (running) {
    const answer = await showDialog({
      heading: t('row.removeHeading', { name: info.name }),
      body: t('row.removeBody'),
      buttons: [
        { label: t('dialog.cancel'), value: 'cancel' },
        { label: t('row.removeButton'), value: 'remove', style: 'destructive' },
      ],
      defaultValue: 'cancel',
    })
    if (answer.value !== 'remove') return
  }
  await act({ type: 'removeMember', session: info.id })
}

async function renameTab(tab: TabView): Promise<void> {
  const first = tab.panes[0]?.sessionId
  const info = first ? state?.sessions.find((x) => x.id === first) : undefined
  if (tab.kind === 'session' && info) {
    await renameSessionDialog(info)
    return
  }
  const answer = await showDialog({
    heading: t('tab.renameHeading'),
    body: t('tab.renameBody'),
    entry: { value: tab.title },
    buttons: [
      { label: t('dialog.cancel'), value: 'cancel' },
      { label: t('dialog.save'), value: 'save', style: 'suggested' },
    ],
    defaultValue: 'save',
  })
  if (answer.value === 'save') await act({ type: 'renameTab', tab: tab.id, title: answer.text })
}

export async function newWindow(): Promise<void> {
  const result = await act({ type: 'newWindow' })
  if (result.value !== 'needsProject') return
  const answer = await showDialog({
    heading: t('window.newProjectHeading'),
    body: t('window.newProjectBody'),
    entry: { value: '', placeholder: t('dialog.name') },
    buttons: [
      { label: t('dialog.cancel'), value: 'cancel' },
      { label: t('dialog.save'), value: 'save', style: 'suggested' },
    ],
    defaultValue: 'save',
  })
  if (answer.value !== 'save') return
  const { refusal } = await act({ type: 'newWindowWithProject', name: answer.text })
  if (refusal) await showError(t('window.noNewWindow'), refusal)
}

export async function confirmClose(names: readonly string[]): Promise<void> {
  const answer = await showDialog({
    heading: t('window.stopHeading', { n: names.length }),
    body: `${names.join(', ')}\n\n${t('window.stopBody')}`,
    buttons: [
      { label: t('dialog.cancel'), value: 'cancel' },
      { label: t('window.stopButton'), value: 'stop', style: 'destructive' },
    ],
    defaultValue: 'cancel',
  })
  await act({ type: answer.value === 'stop' ? 'confirmClose' : 'cancelClose' })
}

export function selectedTabView(): TabView | undefined {
  const s = state
  return s?.tabs.find((tab) => tab.id === s.selectedTab && tab.project === s.shown)
}

async function saveAsking(paths: readonly string[]): Promise<boolean> {
  const { refusal, value } = await act({ type: 'saveFiles', paths })
  if (!refusal) return true
  const name = (value ?? '').split('/').pop() ?? ''
  await showDialog({
    heading: t('files.notSaved', { name }),
    body: translate(refusal),
    buttons: [{ label: t('dialog.ok'), value: 'ok' }],
    defaultValue: 'ok',
  })
  return false
}

// True when the close may go on.
async function askUnsaved(paths: readonly string[], names: readonly string[]): Promise<boolean> {
  const answer = await unsavedQuestion(names)
  if (answer.value === 'cancel') return false
  if (answer.value === 'discard') {
    await act({ type: 'discardFiles', paths })
    return true
  }
  return saveAsking(paths)
}

// Closing a file's last editor tab with unsaved edits asks first; every other close goes through.
export async function closeTabAsking(tab: string): Promise<void> {
  const result = await act({ type: 'closeTab', tab })
  if (!result.unsaved || typeof result.value !== 'string') return
  if (await askUnsaved([result.value], result.unsaved))
    await act({ type: 'closeTab', tab, force: true })
}

window.menkar.window.onConfirmUnsaved(({ paths, names }) => {
  void askUnsaved(paths, names).then((go) => {
    if (go) void act({ type: 'closeWindowNow' })
  })
})

export async function saveSelectedFile(): Promise<void> {
  const tab = selectedTabView()
  if (!tab?.file || tab.file.preview) return
  await saveFile(tab.file.path)
}

export async function saveFile(path: string): Promise<void> {
  const name = path.split('/').pop() ?? ''
  const { refusal } = await act({ type: 'saveFile', path })
  if (refusal)
    await showDialog({
      heading: t('files.notSaved', { name }),
      body: translate(refusal),
      buttons: [{ label: t('dialog.ok'), value: 'ok' }],
      defaultValue: 'ok',
    })
}

const REMOTE_TOAST_MS = 6000

// The "Remote control" check of a session row's menu and of a one-session tab's menu.
function remoteItem(sessionId: string): MenuItem {
  const on = state?.remoteControl.includes(sessionId) ?? false
  return {
    label: `${on ? '✓ ' : ''}${t('rc.item')}`,
    run: async () => {
      const { value } = await act({ type: 'setRemoteControl', session: sessionId, on: !on })
      if (value === 'toast') toast(t('rc.toast'), { ms: REMOTE_TOAST_MS })
    },
  }
}

function remoteTabItems(tab: TabView): MenuEntry[] {
  const sessions = tab.panes.filter((p) => p.sessionId !== null)
  const only = sessions.length === 1 ? sessions[0] : undefined
  if (tab.kind !== 'session' || !only?.sessionId || only.agent !== 'claude') return []
  return ['separator', remoteItem(only.sessionId)]
}

// The phone on a session row: on in the list or live in a pane started with it.
function phoneIcon(sessionId: string): HTMLElement | null {
  const panes = state?.tabs.flatMap((tab) => tab.panes).filter((p) => p.sessionId === sessionId)
  return phoneFor(panes ?? [])
}

// The phone shows a bridge connected now, as Claude Code reports it for the pane's process. Where
// that cannot be read, a running session started with Remote Control, or in the app's list, keeps
// it: an unreadable state never hides the phone. A session with no running pane shows none.
function phoneFor(panes: readonly TabView['panes'][number][]): HTMLElement | null {
  const s = state
  if (!s) return null
  let tip: Key | null = null
  for (const pane of panes) {
    const live = agentStates?.panes.find((p) => p.paneId === pane.id)?.remoteLive ?? 'unknown'
    if (live === 'on') {
      tip = 'rc.connected'
      break
    }
    const session = pane.sessionId
    const running = session !== null && s.running.includes(session)
    if (live === 'unknown' && running && (pane.remote || s.remoteControl.includes(session)))
      tip = 'rc.fallback'
  }
  return tip ? el('span', { class: 'phone dim', title: translate(tip) }, phoneGlyph()) : null
}

// A phone's outline in the text color: an emoji has too much detail and color at this size.
function phoneGlyph(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  const attrs = (node: Element, values: Record<string, string>) => {
    for (const [key, value] of Object.entries(values)) node.setAttribute(key, value)
  }
  attrs(svg, {
    viewBox: '0 0 9 13',
    width: '9',
    height: '13',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'aria-hidden': 'true',
  })
  const body = document.createElementNS(ns, 'rect')
  attrs(body, { x: '.75', y: '.75', width: '7.5', height: '11.5', rx: '1.6' })
  const speaker = document.createElementNS(ns, 'line')
  attrs(speaker, { x1: '3.4', y1: '10.1', x2: '5.6', y2: '10.1', 'stroke-linecap': 'round' })
  svg.append(body, speaker)
  return svg
}

// A chat tab's body: b2's view mounted once per tab, unmounted when the tab goes.
const chatBodies = new Map<string, { root: HTMLElement; unmount: Promise<() => void> }>()

function chatElement(tabId: string, chatId: string): HTMLElement {
  const existing = chatBodies.get(tabId)
  if (existing) return existing.root
  const root = el('div', { class: 'chat-host' })
  chatBodies.set(tabId, { root, unmount: mountChat(root, chatId) })
  return root
}

function forgetChatsExcept(live: ReadonlySet<string>): void {
  for (const [id, body] of chatBodies) {
    if (live.has(id)) continue
    chatBodies.delete(id)
    void body.unmount.then((unmount) => unmount())
  }
}
