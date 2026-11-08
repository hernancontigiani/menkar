import { now } from '../core/clock'
import type { Key } from '../core/i18n'
import {
  countLine,
  filterSearch,
  folderName,
  groupByFolder,
  recentFolders,
  relativeTime,
  sessionSearchText,
} from '../core/sessions/history'
import type { SessionInfo } from '../core/sessions/info'
import type { WindowState } from '../shared/workspace'
import { act, currentState, onRender, showHiddenSessions } from './app'
import { el, icon } from './dom'
import { t, translate } from './i18n'
import { historyRowMenu, renameFromHistory, trashSelected } from './sessionmenus'
import { dialogClosed, dialogOpened, showDialog, showMenu, toast } from './ui'

type Agent = 'claude' | 'cursor'

export interface NewOptions {
  readonly agent?: Agent
  readonly folder?: string
  readonly flags?: { readonly model?: string; readonly mode?: string; readonly addDir?: string }
}

let openDialog: { close(): void } | null = null

const home = () =>
  currentState()
    ?.sessions.find((s) => s.cwd?.startsWith('/home/'))
    ?.cwd?.split('/')
    .slice(0, 3)
    .join('/') ?? ''
const tilde = (path: string) => {
  const h = home()
  return h && (path === h || path.startsWith(`${h}/`)) ? `~${path.slice(h.length)}` : path
}
const parentOf = (path: string) => tilde(path.split('/').slice(0, -1).join('/') || '/')
const lastOf = (path: string) => path.split('/').filter(Boolean).pop() ?? path

function relative(mtimeMs: number): string {
  const r = relativeTime(mtimeMs, now())
  return 'date' in r ? r.date : translate(r.key, r.params)
}

// The Add session dialog, on Existing or New. One at a time.
export function openAddSession(page: 'existing' | 'new', options: NewOptions = {}): void {
  if (openDialog) return
  const initial = currentState()
  if (!initial) return
  const s: WindowState = initial
  dialogOpened()
  const project = s.projects.find((p) => p.id === s.shown)
  const collapsed = new Map<string, boolean>()
  const selection = new Set<string>()
  let selectMode = false
  let query = ''
  let current: 'existing' | 'new' = page
  let newStep: 'folder' | 'name' = 'folder'
  let folder = options.folder ?? ''
  let agent: Agent = options.agent ?? s.agents[0] ?? 'claude'
  let flags = options.flags ?? {}

  const body = el('div', { class: 'add-body' })
  const existingButton = el('button', { class: 'switch' }, t('add.existing'))
  const newButton = el('button', { class: 'switch' }, t('add.new'))
  const closeButton = el('button', { 'aria-label': t('tab.close') }, icon('close'))
  const dialog = el(
    'div',
    { class: 'dialog sheet add-session', role: 'dialog' },
    el(
      'div',
      { class: 'add-head' },
      el('div', { class: 'heading' }, t('add.title', { name: project?.name ?? '' })),
      el('div', { class: 'switcher' }, existingButton, newButton),
      closeButton,
    ),
    body,
  )
  const scrim = el('div', { class: 'scrim' }, dialog)
  const off = onRender(() => {
    if (current === 'existing') drawExisting(false)
  })
  const close = () => {
    off()
    dialogClosed()
    scrim.remove()
    openDialog = null
  }
  openDialog = { close }
  closeButton.addEventListener('click', close)
  scrim.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    }
  })
  existingButton.addEventListener('click', () => show('existing'))
  newButton.addEventListener('click', () => show('new'))

  // ------------------------------------------------------------ Existing
  const search = el('input', { type: 'text', placeholder: t('add.searchSessions') })
  search.addEventListener('input', () => {
    query = search.value
    drawExisting(false)
  })
  const collapseAll = el('button', { title: t('add.collapseAll') }, icon('up'))
  const expandAll = el('button', { title: t('add.expandAll') }, icon('down'))
  const selectToggle = el(
    'button',
    { title: t('add.selectMode'), 'aria-pressed': 'false' },
    icon('check'),
  )
  const refresh = el('button', { title: t('add.refresh') }, '⟳')
  const list = el('div', { class: 'history-list' })
  const bar = el('div', { class: 'select-bar', hidden: '' })
  const count = el('div', { class: 'count-line dim caption' })
  const existingPage = el(
    'div',
    { class: 'add-page' },
    el('div', { class: 'search-row' }, search, collapseAll, expandAll, selectToggle, refresh),
    list,
    bar,
    count,
  )
  collapseAll.addEventListener('click', () => {
    for (const g of groups()) collapsed.set(g.name, true)
    drawExisting(false)
  })
  expandAll.addEventListener('click', () => {
    for (const g of groups()) collapsed.set(g.name, false)
    drawExisting(false)
  })
  selectToggle.addEventListener('click', () => {
    selectMode = !selectMode
    selection.clear()
    drawExisting(false)
  })
  refresh.addEventListener('click', () => void act({ type: 'refreshSessions' }))

  const visibleSessions = (state: WindowState) =>
    state.sessions.filter((x) => showHiddenSessions() || !x.hidden)
  const groups = () => groupByFolder(visibleSessions(currentState() ?? s))

  function pickButton(info: SessionInfo, state: WindowState): HTMLElement {
    const owner = state.projects.find((p) => p.members.includes(info.id))
    if (owner?.id === state.shown)
      return el('button', { class: 'pick flat', disabled: '' }, t('add.added'))
    const label = owner ? t('add.moveFrom', { name: owner.name }) : t('add.add')
    const button = el('button', { class: 'pick suggested' }, label)
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      void pick(info)
    })
    return button
  }

  async function pick(info: SessionInfo): Promise<void> {
    const { refusal } = await act({ type: 'pickSession', session: info.id })
    if (refusal) toast(translate(refusal))
  }

  function historyRow(info: SessionInfo, state: WindowState): HTMLElement {
    const open = state.open.includes(info.id)
    const check = el('input', { type: 'checkbox' })
    check.checked = selection.has(info.id)
    const rename = el('button', { class: 'flat', title: t('add.renameSession') }, icon('edit'))
    rename.addEventListener('click', (event) => {
      event.stopPropagation()
      void renameFromHistory(info)
    })
    const badge =
      info.badge === 'waiting'
        ? el('span', { class: 'badge waiting', title: t('badge.waiting') }, '?')
        : info.badge === 'interrupted'
          ? el('span', { class: 'badge interrupted', title: t('badge.interrupted') }, '■')
          : null
    const showPath = state.settings.show_folder_path && info.cwd !== null
    const node = el(
      'div',
      { class: 'history-row', 'data-session': info.id },
      el(
        'div',
        { class: 'top' },
        selectMode ? check : null,
        el('span', { class: `dot${open ? ' idle' : ''}` }),
        el(
          'span',
          {
            class: 'agent dim',
            title: info.agent === 'claude' ? t('agent.claude') : t('agent.cursor'),
          },
          info.agent === 'claude' ? '✳' : '➤',
        ),
        el('span', { class: 'name' }, info.name),
        badge,
        rename,
        pickButton(info, state),
      ),
      el('div', { class: 'dim caption' }, `${folderName(info)} · ${relative(info.mtimeMs)}`),
      showPath && info.cwd ? el('div', { class: 'dim caption path' }, tilde(info.cwd)) : null,
      info.preview ? el('div', { class: 'dim caption preview' }, info.preview) : null,
    )
    node.addEventListener('click', () => {
      if (selectMode) {
        if (selection.has(info.id)) selection.delete(info.id)
        else selection.add(info.id)
        drawExisting(false)
        return
      }
      const owner = state.projects.find((p) => p.members.includes(info.id))
      if (owner?.id !== state.shown) void pick(info)
    })
    node.addEventListener('contextmenu', (event) => {
      event.preventDefault()
      historyRowMenu(info, { x: event.clientX, y: event.clientY })
    })
    return node
  }

  function drawExisting(focus: boolean): void {
    const state = currentState() ?? s
    const all = state.sessions
    const known = new Set(all.map((x) => x.id))
    for (const id of [...selection]) if (!known.has(id)) selection.delete(id)
    selectToggle.setAttribute('aria-pressed', String(selectMode))
    if (all.length === 0) {
      list.replaceChildren(
        el(
          'div',
          { class: 'status-page compact' },
          el('div', { class: 'heading' }, t('add.emptyTitle')),
          el('div', { class: 'body dim' }, t('add.emptyBody')),
        ),
      )
    } else {
      const searching = query.trim() !== ''
      const rows: HTMLElement[] = []
      const shownRows: SessionInfo[] = []
      for (const group of groupByFolder(visibleSessions(state))) {
        const matched = searching
          ? filterSearch(group.sessions, query, sessionSearchText, Number.POSITIVE_INFINITY)
          : group.sessions
        if (searching && matched.length === 0) continue
        if (!collapsed.has(group.name)) collapsed.set(group.name, true)
        const isCollapsed = !searching && collapsed.get(group.name) === true
        const header = el(
          'div',
          { class: 'history-group', 'data-group': group.name },
          el('span', { class: 'dim' }, isCollapsed ? '▸' : '▾'),
          el('span', { class: 'group-name dim' }, group.name.toUpperCase()),
          el('span', { class: 'count-badge' }, String(group.sessions.length)),
        )
        header.addEventListener('click', () => {
          collapsed.set(group.name, !isCollapsed)
          drawExisting(false)
        })
        rows.push(header)
        if (!isCollapsed) {
          for (const info of matched) {
            rows.push(historyRow(info, state))
            shownRows.push(info)
          }
        }
      }
      list.replaceChildren(...rows)
      drawBar(shownRows)
    }
    const c = countLine(all, state.open.length)
    const parts = [
      t('add.countSessions', { n: c.sessions }),
      t('add.countProjects', { n: c.projects }),
      c.size,
    ]
    if (c.open > 0) parts.push(t('add.countOpen', { n: c.open }))
    count.textContent = parts.join(' · ')
    if (focus) search.focus()
  }

  function drawBar(shownRows: readonly SessionInfo[]): void {
    bar.toggleAttribute('hidden', !selectMode)
    if (!selectMode) return
    const all = el('button', { title: t('add.selectAll') }, t('add.all'))
    const none = el('button', { title: t('add.selectNone') }, t('add.none'))
    const openSelected = el('button', { title: t('add.openSelected') }, icon('tabNew'))
    const hideSelected = el('button', { title: t('add.hideSelected') }, '⊘')
    const trash = el('button', { title: t('add.trashSelected') }, icon('trash'))
    all.addEventListener('click', () => {
      for (const info of shownRows) selection.add(info.id)
      drawExisting(false)
    })
    none.addEventListener('click', () => {
      selection.clear()
      drawExisting(false)
    })
    openSelected.addEventListener('click', () => {
      for (const id of selection) void act({ type: 'openSession', session: id })
    })
    hideSelected.addEventListener('click', () => {
      if (selection.size > 0) void window.menkar.sessions.setHidden([...selection], true)
    })
    trash.addEventListener('click', () => {
      if (selection.size > 0) void trashSelected([...selection])
    })
    bar.replaceChildren(
      el('span', { class: 'selected-count' }, t('add.selectedCount', { n: selection.size })),
      all,
      none,
      el('span', { class: 'spacer' }),
      openSelected,
      hideSelected,
      trash,
    )
  }

  // ------------------------------------------------------------ New
  const newPage = el('div', { class: 'add-page' })

  async function drawNew(): Promise<void> {
    if (newStep === 'folder') {
      const folderSearch = el('input', { type: 'text', placeholder: t('add.searchFolders') })
      const folders = el('div', { class: 'folder-list' })
      const drawFolders = () => {
        const q = folderSearch.value.trim().toLowerCase()
        const all = recentFolders((currentState() ?? s).sessions)
        const shown = q ? all.filter((f) => f.toLowerCase().includes(q)) : all
        const rows = shown.map((path) => {
          const row = el(
            'div',
            { class: 'folder-row', 'data-folder': path },
            el('div', { class: 'name' }, lastOf(path)),
            el('div', { class: 'dim caption' }, parentOf(path)),
          )
          row.addEventListener('click', () => chooseFolder(path))
          return row
        })
        const another = el(
          'div',
          { class: 'folder-row another' },
          el('div', { class: 'name' }, t('add.anotherFolder')),
        )
        another.addEventListener('click', () => void chooseAnother())
        folders.replaceChildren(...rows, another)
        return shown
      }
      folderSearch.addEventListener('input', () => drawFolders())
      folderSearch.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return
        const first = drawFolders()[0]
        if (first) chooseFolder(first)
      })
      newPage.replaceChildren(folderSearch, folders)
      drawFolders()
      folderSearch.focus()
      return
    }
    const state = currentState() ?? s
    const nameEntry = el('input', { type: 'text', placeholder: t('dialog.name') })
    const error = el('div', { class: 'error-line', hidden: '' })
    const change = el('button', { class: 'flat' }, t('add.change'))
    change.addEventListener('click', () => {
      newStep = 'folder'
      void drawNew()
    })
    const agentRow =
      state.agents.length > 1
        ? (() => {
            const select = el('select', {})
            for (const a of state.agents) {
              const option = el(
                'option',
                { value: a },
                a === 'claude' ? t('agent.claude') : t('agent.cursor'),
              )
              option.selected = a === agent
              select.append(option)
            }
            select.addEventListener('change', () => {
              agent = select.value === 'cursor' ? 'cursor' : 'claude'
            })
            return el('label', { class: 'form-row' }, el('span', {}, t('add.agent')), select)
          })()
        : null
    const start = el('button', { class: 'pill' }, t('newSession.start'))
    const submit = async () => {
      const name = nameEntry.value.trim()
      if (!name && agent === 'claude') return showError(error, 'newSession.needName')
      const { refusal } = await act({ type: 'startNew', agent, folder, name, ...flags })
      if (refusal) return showError(error, refusal)
      flags = {}
      close()
    }
    start.addEventListener('click', () => void submit())
    nameEntry.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') void submit()
    })
    newPage.replaceChildren(
      el('div', { class: 'dim' }, t('add.nameNote')),
      el(
        'div',
        { class: 'form-row folder' },
        el('span', { class: 'name' }, lastOf(folder)),
        el('span', { class: 'dim caption' }, parentOf(folder)),
        change,
      ),
      el('label', { class: 'form-row' }, el('span', {}, t('dialog.name')), nameEntry),
      ...(agentRow ? [agentRow] : []),
      error,
      el('div', { class: 'form-actions' }, start),
    )
    nameEntry.focus()
  }

  function showError(node: HTMLElement, key: Key): void {
    node.textContent = translate(key)
    node.hidden = false
  }

  function chooseFolder(path: string): void {
    folder = path
    newStep = 'name'
    void drawNew()
  }

  async function chooseAnother(): Promise<void> {
    const { value } = await act({ type: 'pickFolder' })
    if (typeof value === 'string') chooseFolder(value)
  }

  function show(which: 'existing' | 'new'): void {
    current = which
    existingButton.classList.toggle('selected', which === 'existing')
    newButton.classList.toggle('selected', which === 'new')
    if (which === 'existing') {
      body.replaceChildren(existingPage)
      drawExisting(true)
    } else {
      body.replaceChildren(newPage)
      void drawNew()
    }
  }

  document.body.append(scrim)
  void (async () => {
    // The remembered folder, or the one given, skips straight to the name when it still exists.
    const candidate = options.folder ?? s.settings.new_session_dir
    if (candidate) {
      const { value } = await act({ type: 'checkFolder', folder: candidate })
      if (typeof value === 'string') {
        folder = value
        newStep = 'name'
      }
    }
    show(current)
  })()
}

// The advanced new session (M8): a folder, then optional flags, then New at its name step.
const MODELS: Record<Agent, ReadonlyArray<[string, string]>> = {
  claude: [
    ['Opus', 'opus'],
    ['Sonnet', 'sonnet'],
    ['Haiku', 'haiku'],
  ],
  cursor: [
    ['Sonnet 4', 'sonnet-4'],
    ['Sonnet 4 (thinking)', 'sonnet-4-thinking'],
    ['GPT-5', 'gpt-5'],
  ],
}
const MODES: Record<Agent, ReadonlyArray<[Key, string]>> = {
  claude: [
    ['advanced.modePlan', 'plan'],
    ['advanced.modeAcceptEdits', 'acceptEdits'],
    ['advanced.modeBypass', 'bypassPermissions'],
  ],
  cursor: [
    ['advanced.modePlan', 'plan'],
    ['advanced.modeAsk', 'ask'],
  ],
}

export async function advancedNewSession(agent: Agent): Promise<void> {
  const { value: folder } = await act({ type: 'pickFolder' })
  if (typeof folder !== 'string') return
  const model = el(
    'select',
    {},
    el('option', { value: '' }, t('advanced.default')),
    ...MODELS[agent].map(([label, v]) => el('option', { value: v }, label)),
  )
  const mode = el(
    'select',
    {},
    el('option', { value: '' }, t('advanced.default')),
    ...MODES[agent].map(([key, v]) => el('option', { value: v }, translate(key))),
  )
  let addDir = ''
  const dirLabel = el('span', { class: 'dim caption' }, t('advanced.none'))
  const choose = el('button', {}, t('newSession.choose'))
  choose.addEventListener('click', async () => {
    const { value } = await act({ type: 'pickFolder' })
    if (typeof value === 'string') {
      addDir = value
      dirLabel.textContent = value
    }
  })
  const form = el(
    'div',
    { class: 'advanced-form' },
    el('label', { class: 'form-row' }, el('span', {}, t('advanced.model')), model),
    el('label', { class: 'form-row' }, el('span', {}, t('advanced.mode')), mode),
    agent === 'claude'
      ? el('div', { class: 'form-row' }, el('span', {}, t('advanced.extraDir')), dirLabel, choose)
      : null,
  )
  const answer = await showDialog({
    heading: t('newSession.heading', {
      agent: agent === 'claude' ? t('agent.claude') : t('agent.cursor'),
    }),
    body: t('advanced.body'),
    extra: form,
    buttons: [
      { label: t('dialog.cancel'), value: 'cancel' },
      { label: t('advanced.start'), value: 'start', style: 'suggested' },
    ],
    defaultValue: 'start',
  })
  if (answer.value !== 'start') return
  openAddSession('new', {
    agent,
    folder,
    flags: {
      ...(model.value ? { model: model.value } : {}),
      ...(mode.value ? { mode: mode.value } : {}),
      ...(addDir ? { addDir } : {}),
    },
  })
}

export function plusMenu(anchor: { x: number; y: number }, newWindow: () => void): void {
  const agents = currentState()?.agents ?? ['claude']
  const name = (a: Agent) => (a === 'claude' ? t('agent.claude') : t('agent.cursor'))
  showMenu(
    [
      ...agents.map((a) => ({
        label: t('menu.newAgent', { agent: name(a) }),
        run: () => openAddSession('new', { agent: a }),
      })),
      ...agents.map((a) => ({
        label: t('menu.advanced', { agent: name(a) }),
        run: () => void advancedNewSession(a),
      })),
      'separator' as const,
      ...agents.map((a) => ({
        label: t('menu.continueAgent', { agent: name(a) }),
        run: () => void act({ type: 'continueLast', agent: a }),
      })),
      'separator' as const,
      { label: t('menu.newWindow'), run: newWindow },
    ],
    anchor,
  )
}
