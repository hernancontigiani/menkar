import type { Key } from '../core/i18n'
import { filterSearch, groupByFolder } from '../core/sessions/history'
import { matchShortcut, type ShortcutOf } from '../core/shortcuts'
import type { TabEntry } from '../shared/workspace'
import {
  act,
  currentState,
  focusedPane,
  sessionDotState,
  showHiddenSessions,
  stateDot,
  tabStateOf,
} from './app'
import { el } from './dom'
import { t, translate } from './i18n'
import { focusPane } from './terminals'
import { dialogClosed, dialogOpened } from './ui'

interface Entry {
  readonly title: string
  readonly subtitle: string
  readonly dot: HTMLElement | null
  readonly search: string
  readonly choose: () => void
  // Hidden in its project's list: listed, dimmed.
  readonly dimmed?: boolean
}

const FILTER_PAUSE_MS = 120
let open = false

interface JumpOptions {
  // The row selected at first (the project switcher starts on the previous project).
  readonly start?: number
  // Said, dimmed, when there is nothing to choose.
  readonly empty?: string
  // Pressed again while the list is open, this key moves the selection down, round.
  readonly cycle?: ShortcutOf<'window'>
  // Opened while Ctrl is held: letting it go chooses the selected row.
  readonly releaseToChoose?: boolean
}

// One jump dialog at a time: the quick switcher, Go to agent and the project switcher share it.
function jumpDialog(
  title: string,
  placeholder: string,
  entries: readonly Entry[],
  options: JumpOptions = {},
): void {
  if (open) return
  open = true
  dialogOpened()
  const input = el('input', { type: 'text', placeholder })
  const list = el('div', { class: 'jump-list', role: 'listbox' })
  let shown: Entry[] = []
  let selected = 0
  const close = (choice?: Entry) => {
    open = false
    dialogClosed()
    document.removeEventListener('keyup', released, true)
    scrim.remove()
    if (choice) choice.choose()
    else restoreFocus()
  }
  const draw = () => {
    if (shown.length === 0 && options.empty) {
      list.replaceChildren(el('div', { class: 'jump-empty dim' }, options.empty))
      return
    }
    list.replaceChildren(
      ...shown.map((entry, i) => {
        const row = el(
          'div',
          {
            class: `jump-row${i === selected ? ' selected' : ''}${entry.dimmed ? ' hidden-member' : ''}`,
            role: 'option',
          },
          entry.dot,
          el(
            'div',
            { class: 'jump-text' },
            el('div', { class: 'name' }, entry.title),
            el('div', { class: 'dim caption' }, entry.subtitle),
          ),
        )
        row.addEventListener('click', () => close(entry))
        return row
      }),
    )
    list.children[selected]?.scrollIntoView({ block: 'nearest' })
  }
  let first = true
  const filter = () => {
    shown = filterSearch(entries, input.value, (e) => e.search)
    selected = first ? Math.max(0, Math.min(options.start ?? 0, shown.length - 1)) : 0
    first = false
    draw()
  }
  const released = (event: KeyboardEvent) => {
    if (event.key !== 'Control') return
    const entry = shown[selected]
    if (entry) close(entry)
  }
  if (options.releaseToChoose) document.addEventListener('keyup', released, true)
  let timer: ReturnType<typeof setTimeout> | undefined
  input.addEventListener('input', () => {
    clearTimeout(timer)
    timer = setTimeout(filter, FILTER_PAUSE_MS)
  })
  input.addEventListener('keydown', (event) => {
    if (options.cycle && matchShortcut('window', event) === options.cycle) {
      if (shown.length > 0) selected = (selected + 1) % shown.length
      draw()
      event.preventDefault()
      event.stopPropagation()
      return
    }
    const id = matchShortcut('switcher', event)
    if (id === 'switcherMove') {
      selected = Math.max(
        0,
        Math.min(shown.length - 1, selected + (event.key === 'ArrowDown' ? 1 : -1)),
      )
      draw()
    } else if (id === 'switcherOpen') {
      clearTimeout(timer)
      if (input.value.trim() && shown === entries) filter()
      const entry = shown[selected]
      if (entry) close(entry)
    } else if (id === 'switcherClose') close()
    else return
    event.preventDefault()
    event.stopPropagation()
  })
  const dialog = el(
    'div',
    { class: 'dialog sheet jump', role: 'dialog' },
    el('div', { class: 'jump-head' }, el('div', { class: 'heading' }, title), input),
    list,
  )
  const scrim = el('div', { class: 'scrim' }, dialog)
  scrim.addEventListener('mousedown', (event) => {
    if (event.target === scrim) close()
  })
  document.body.append(scrim)
  filter()
  input.focus()
}

function restoreFocus(): void {
  const s = currentState()
  const tab = s?.tabs.find((tb) => tb.id === s.selectedTab)
  const pane = tab ? (focusedPane.get(tab.id) ?? tab.panes[0]?.id) : undefined
  if (pane) focusPane(pane)
}

// Ctrl+Shift+K: the shown project's known members, in the history's order.
export function quickSwitcher(): void {
  const s = currentState()
  if (!s) return
  const project = s.projects.find((p) => p.id === s.shown)
  // Earlier conversations (decision 1.63) are reached from their session's menu only.
  const earlier = new Set(Object.values(project?.earlier ?? {}).flat())
  const members = new Set((project?.members ?? []).filter((id) => !earlier.has(id)))
  const hiddenHere = new Set(project?.hidden ?? [])
  const known = s.sessions.filter((x) => members.has(x.id) && (showHiddenSessions() || !x.hidden))
  const ordered = groupByFolder(known).flatMap((g) =>
    g.sessions.map((session) => ({ session, folder: g.name })),
  )
  jumpDialog(
    t('switcher.title'),
    t('switcher.placeholder'),
    ordered.map(({ session, folder }) => ({
      title: session.name,
      subtitle: session.preview ? `${folder} · ${session.preview}` : folder,
      dot: null,
      search: [session.name, folder, session.preview, session.id].join(' ').toLowerCase(),
      // Opening it runs it, which shows it again in the list.
      choose: () => void act({ type: 'openSession', session: session.id }),
      dimmed: hiddenHere.has(session.id),
    })),
  )
}

const AGENT_LABEL: Record<string, Key> = {
  claude: 'agent.claude',
  cursor: 'agent.cursor',
  shell: 'agent.shell',
  file: 'agent.file',
}

// Ctrl+B g: every tab of every window.
export async function goToAgent(): Promise<void> {
  if (open) return
  const { tabs } = await act({ type: 'listTabs' })
  const entries = (tabs ?? []).map((entry: TabEntry) => {
    const state = tabStateOf(entry.panes)
    const agent = translate(
      AGENT_LABEL[entry.kind === 'file' ? 'file' : (entry.agent ?? 'shell')] ?? 'agent.shell',
    )
    const word = translate(sessionDotState[state])
    return {
      title: `${entry.projectName} · ${entry.title}`,
      subtitle: `${agent} · ${word}`,
      dot: stateDot(state),
      search: [entry.title, entry.projectName, agent, word].join(' ').toLowerCase(),
      choose: () => void act({ type: 'revealTab', tab: entry.tab }),
    }
  })
  jumpDialog(t('goto.title'), t('goto.placeholder'), entries)
}

let asking = false

// Ctrl+Shift+E (decision 1.38): the projects in use, the most recent first, starting on the one
// before this. Held like Alt+Tab: each E moves down, letting Ctrl go jumps there.
export async function projectSwitcher(): Promise<void> {
  if (open || asking) return
  asking = true
  // Ctrl may be let go before the list arrives; then it is an ordinary list.
  let held = true
  const early = (event: KeyboardEvent) => {
    if (event.key === 'Control') held = false
  }
  document.addEventListener('keyup', early, true)
  const { active } = await act({ type: 'listActiveProjects' })
  document.removeEventListener('keyup', early, true)
  asking = false
  const shown = currentState()?.shown
  const list = active ?? []
  const others = list.filter((p) => p.id !== shown)
  const entries =
    others.length === 0
      ? []
      : list.map((p) => {
          const tabs =
            p.tabs === 1
              ? t('projectSwitch.oneTab')
              : t('projectSwitch.tabs', { count: String(p.tabs) })
          return {
            title: p.name,
            subtitle: p.here ? tabs : `${tabs} · ${t('projectSwitch.otherWindow')}`,
            dot: null,
            search: p.name.toLowerCase(),
            choose: () => void act({ type: 'switchProject', project: p.id }),
          }
        })
  jumpDialog(t('projectSwitch.title'), t('projectSwitch.placeholder'), entries, {
    start: 1,
    empty: t('projectSwitch.none'),
    cycle: 'projectSwitcher',
    releaseToChoose: held && entries.length > 0,
  })
}
