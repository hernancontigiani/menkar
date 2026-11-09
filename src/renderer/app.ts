import type { AgentStates } from '../core/agentstate/shown'
import { faceBadge, rollup, type ShownState } from '../core/agentstate/shown'
import type { Reading } from '../core/context/types'
import type { Key } from '../core/i18n'
import type { ProjectInfo } from '../core/projects/info'
import { RING_RADIUS, RING_SIZE, RING_STROKE, ringOf } from '../core/ring'
import type { SessionInfo } from '../core/sessions/info'
import { SIDEBAR_MIN_WIDTH } from '../core/settings'
import type { Action, TabView, WindowState } from '../shared/workspace'
import { openAddSession, plusMenu } from './addsession'
import { mountChat } from './chat'
import { el, icon } from './dom'
import { fileElement, forgetFilesExcept, setFileTheme } from './editor'
import { t, translate } from './i18n'
import { applyLook } from './look'
import { forgetReplaysExcept, replayElement } from './replay'
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
} from './ui'

let state: WindowState | undefined
// Per tab: the pane that had the focus last, and whether it is zoomed (neither is saved).
export const focusedPane = new Map<string, string>()
export const zoomedTabs = new Set<string>()
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
  const r = ringOf(reading)
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
  const newButton = el(
    'button',
    { id: 'new-session', title: t('header.newSession') },
    icon('tabNew'),
  )
  newButton.addEventListener('click', () => openAddSession('new'))
  const newMenu = el(
    'button',
    { id: 'new-menu', 'aria-label': t('header.newSession') },
    icon('down'),
  )
  newMenu.addEventListener('click', () => {
    const r = newMenu.getBoundingClientRect()
    plusMenu({ x: r.left, y: r.bottom + 4 }, () => void newWindow())
  })
  const closeAll = el('button', { id: 'close-all', title: t('header.closeAll') }, icon('tabClose'))
  closeAll.addEventListener('click', () => void act({ type: 'closeAllTabs' }))

  const projectButton = el(
    'button',
    { id: 'project-button', title: t('projects.dropdown') },
    el('span', { class: 'project-name' }),
    icon('down'),
  )
  projectButton.addEventListener('click', () => openProjectPopover(projectButton))
  const gear = el('button', { id: 'main-menu', title: t('menu.main') }, icon('gear'))
  gear.addEventListener('click', () => {
    const r = gear.getBoundingClientRect()
    showMenu(
      [
        { label: t('menu.openSessionFile'), run: () => void mainMenuHandlers.openSessionFile() },
        {
          label: `${showHidden ? '✓ ' : ''}${t('menu.showHidden')}`,
          run: () => toggleShowHidden(),
        },
        'separator',
        { label: t('menu.mcp'), run: () => void act({ type: 'openMcpServers' }) },
        { label: t('menu.usage'), run: () => void act({ type: 'openUsage' }) },
        { label: t('menu.preferences'), run: () => void act({ type: 'openPreferences' }) },
        { label: t('menu.about'), run: () => void act({ type: 'openAbout' }) },
      ],
      { x: r.left, y: r.bottom + 4 },
    )
  })
  const addSession = el('button', { id: 'add-session' }, t('sidebar.addSession'))
  addSession.addEventListener('click', () => openAddSession('existing'))

  const divider = el('div', { id: 'divider' })
  dragDivider(divider)

  $('app').replaceChildren(
    el(
      'aside',
      { id: 'sidebar' },
      el('div', { class: 'sidebar-header' }, projectButton, gear),
      el('div', { id: 'session-list' }),
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
        el('div', { class: 'split' }, newButton, el('span', { class: 'sep' }), newMenu),
        closeAll,
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
  $('close-all').style.display = next.tabCount >= 2 ? '' : 'none'
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
  const height = Math.round(Number.parseFloat(style.minHeight))
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
  if (!project) {
    list.replaceChildren()
    return
  }
  const byId = sessionsById(s)
  const known = project.members.filter((id) => byId.has(id))
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
  const shownGroups = project.groups.filter((g) => g.members.some((m) => byId.has(m)))
  for (const group of shownGroups) {
    children.push(el('div', { class: 'group-heading dim' }, groupDot(group.color), group.name))
    for (const id of group.members) {
      const info = byId.get(id)
      if (info) children.push(row(info, showFolder, running.has(id), project))
    }
  }
  const loose = known.filter((id) => !grouped.has(id))
  if (loose.length > 0 && shownGroups.length > 0)
    children.push(el('div', { class: 'group-heading dim' }, t('sidebar.noGroup')))
  for (const id of loose) {
    const info = byId.get(id)
    if (info) children.push(row(info, showFolder, running.has(id), project))
  }
  list.replaceChildren(...children)
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

function row(
  info: SessionInfo,
  showFolder: boolean,
  running: boolean,
  project: ProjectInfo,
): HTMLElement {
  const dot = stateDot(sessionState(info.id))
  const phone = phoneIcon(info.id)
  if (phone) queueMicrotask(() => dot.after(phone))
  const more = el(
    'button',
    { class: 'more', title: t('sidebar.actionsFor', { name: info.name }) },
    icon('more'),
  )
  const node = el(
    'div',
    { class: 'row', 'data-session': info.id },
    dot,
    el(
      'div',
      { class: 'text' },
      el('div', { class: 'name' }, info.name),
      showFolder ? el('div', { class: 'folder dim' }, folderOf(info)) : null,
    ),
    more,
  )
  const ringNode = ring(readingOf(info.id))
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
  node.addEventListener('click', () => {
    const tab = state?.tabs.find((tb) => tb.panes.some((p) => p.sessionId === info.id))
    if (tab) void act({ type: 'selectTab', tab: tab.id })
  })
  node.addEventListener('dblclick', () => void act({ type: 'openSession', session: info.id }))
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
  ]
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
  entries.push('separator')
  entries.push({ label: t('row.rename'), run: () => void renameSessionDialog(info) })
  if (info.agent === 'claude')
    entries.push({
      label: t('row.fork'),
      run: () => void act({ type: 'forkSession', session: info.id }),
    })
  entries.push(...infoItems(info))
  entries.push('separator')
  entries.push({ label: t('row.remove'), run: () => void removeFromProject(info, running) })
  return entries
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
// Set by the module that owns the item (replay opens a chosen transcript).
export const mainMenuHandlers = {
  openSessionFile: async () => {
    const { refusal } = await act({ type: 'openSessionFile' })
    if (refusal) await showError(t('replay.notOpened'), refusal)
  },
}
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
  const readings = tab.panes.flatMap((p) => {
    const reading = p.sessionId ? readingOf(p.sessionId) : null
    return reading ? [reading] : []
  })
  const fullest = readings.sort((a, b) => b.percentage - a.percentage)[0]
  return ring(fullest ?? null)
}

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
  node.addEventListener('click', () => void act({ type: 'selectTab', tab: tab.id }))
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
        { label: t('tab.menuClose'), run: () => void closeTabAsking(tab.id) },
        ...remoteTabItems(tab),
      ],
      { x: r.left, y: r.bottom + 2 },
    )
  })
  return node
}

function renderContent(s: WindowState): void {
  // Re-attaching the kept nodes below takes the focus away from an editor or terminal in them.
  const active = document.activeElement
  const content = $('tab-content')
  const live = new Set(s.tabs.flatMap((tab) => tab.panes.map((p) => p.id)))
  forgetPanesExcept(live)
  forgetReplaysExcept(new Set(s.tabs.filter((tab) => tab.replay).map((tab) => tab.id)))
  forgetFilesExcept(new Set(s.tabs.filter((tab) => tab.file).map((tab) => tab.id)))
  forgetChatsExcept(new Set(s.tabs.filter((tab) => tab.chat !== undefined).map((tab) => tab.id)))
  const bodies: HTMLElement[] = []
  for (const tab of s.tabs) {
    const visible = tab.id === s.selectedTab && tab.project === s.shown
    const body = el('div', {
      class: `tab-body ${tab.orientation}${visible ? '' : ' hidden'}`,
      'data-tab-body': tab.id,
    })
    const zoomed = zoomedTabs.has(tab.id) && tab.panes.length === 2
    const focused = focusedPane.get(tab.id)
    if (tab.replay) body.append(replayElement(tab.id, tab.replay))
    if (tab.file) body.append(fileElement(tab))
    if (tab.chat !== undefined) body.append(chatElement(tab.id, tab.chat))
    for (const pane of tab.panes) {
      const node = paneElement(pane)
      node.classList.toggle('hidden', zoomed && pane.id !== focused)
      body.append(node)
    }
    if (tab.panes.length < 2) zoomedTabs.delete(tab.id)
    bodies.push(body)
  }
  if (!s.tabs.some((tab) => tab.id === s.selectedTab && tab.project === s.shown)) {
    bodies.push(
      el(
        'div',
        { class: 'status-page', id: 'empty-content' },
        logo('big'),
        el('div', { class: 'heading' }, t('empty.noSessionTitle')),
        el('div', { class: 'body dim' }, t('empty.noSessionBody')),
      ),
    )
  }
  content.replaceChildren(...bodies)
  if (active instanceof HTMLElement && active.isConnected && document.activeElement !== active)
    active.focus()
  const selected = s.tabs.find((tab) => tab.id === s.selectedTab)
  if (selected)
    showPanes(
      [...selected.panes.map((p) => p.id)].sort((a) =>
        a === focusedPane.get(selected.id) ? -1 : 1,
      ),
      lastSelected !== selected.id,
    )
  lastSelected = selected?.id ?? null
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
      el('span', { class: 'dim', title: t('projects.memberCount') }, String(p.members.length)),
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

// "Save changes to {names}?": Save (default), Discard, Cancel. True when the close may go on.
async function unsavedQuestion(
  paths: readonly string[],
  names: readonly string[],
): Promise<boolean> {
  const answer = await showDialog({
    heading: t('files.saveChanges', { names: names.join(', ') }),
    body: t('files.unsavedBody'),
    buttons: [
      { label: t('dialog.cancel'), value: 'cancel' },
      { label: t('files.discard'), value: 'discard', style: 'destructive' },
      { label: t('dialog.save'), value: 'save', style: 'suggested' },
    ],
    defaultValue: 'save',
  })
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
  if (await unsavedQuestion([result.value], result.unsaved))
    await act({ type: 'closeTab', tab, force: true })
}

window.menkar.window.onConfirmUnsaved(({ paths, names }) => {
  void unsavedQuestion(paths, names).then((go) => {
    if (go) void act({ type: 'closeWindowNow' })
  })
})

export async function saveSelectedFile(): Promise<void> {
  const tab = selectedTabView()
  if (!tab?.file || tab.file.preview) return
  const name = tab.file.path.split('/').pop() ?? ''
  const { refusal } = await act({ type: 'saveFile', path: tab.file.path })
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
  const s = state
  if (!s) return null
  const inList = s.remoteControl.includes(sessionId)
  const pane = s.tabs.flatMap((tab) => tab.panes).find((p) => p.sessionId === sessionId)
  const running = s.running.includes(sessionId)
  let tip: Key | null = null
  if (inList) tip = running && pane && !pane.remote ? 'rc.nextStart' : 'rc.on'
  else if (running && pane?.remote) tip = 'rc.untilRestart'
  return tip ? el('span', { class: 'phone dim', title: translate(tip) }, '📱') : null
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
