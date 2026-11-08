import type { Key } from '../core/i18n'
import { filterSearch, groupByFolder } from '../core/sessions/history'
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
}

const FILTER_PAUSE_MS = 120
let open = false

// One jump dialog at a time: the quick switcher and Go to agent share it.
function jumpDialog(title: string, placeholder: string, entries: readonly Entry[]): void {
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
    scrim.remove()
    if (choice) choice.choose()
    else restoreFocus()
  }
  const draw = () => {
    list.replaceChildren(
      ...shown.map((entry, i) => {
        const row = el(
          'div',
          { class: `jump-row${i === selected ? ' selected' : ''}`, role: 'option' },
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
  const filter = () => {
    shown = filterSearch(entries, input.value, (e) => e.search)
    selected = 0
    draw()
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  input.addEventListener('input', () => {
    clearTimeout(timer)
    timer = setTimeout(filter, FILTER_PAUSE_MS)
  })
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      selected = Math.max(
        0,
        Math.min(shown.length - 1, selected + (event.key === 'ArrowDown' ? 1 : -1)),
      )
      draw()
    } else if (event.key === 'Enter') {
      clearTimeout(timer)
      if (input.value.trim() && shown === entries) filter()
      const entry = shown[selected]
      if (entry) close(entry)
    } else if (event.key === 'Escape') close()
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
  const members = new Set(project?.members ?? [])
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
      choose: () => void act({ type: 'openSession', session: session.id }),
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
