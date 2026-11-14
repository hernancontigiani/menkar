import { boardCap, defaultBoardHeight, showAllHeight } from '../core/orchestration/board'
import type { ProjectInfo } from '../core/projects/info'
import type { TaskView, WindowState } from '../shared/workspace'
import { act, currentState, shownDrawerPixels } from './app'
import { el } from './dom'
import { t } from './i18n'
import { boardElement, taskCard } from './work'

// The Board panel (decision 1.126): between the header and the tab strip, over the right-hand area
// only. Its space comes from the agent's pane, never from the shell drawer.

// The agent's pane keeps its rows plus its own frame.
const PANE_CHROME = 8
const FALLBACK_ROW = 17

let panel: HTMLElement | undefined
let divider: HTMLElement | undefined
// A height dragged or picked here, shown until the saved one catches up.
let pending: number | null = null
let showAllWhenOpen = false
let lastProject: string | undefined

// A full card (decision 1.132): a title clamped to two lines, an assignee with its dot, the step bar
// and a note.
const PROBE_TASK: TaskView = {
  number: 1,
  title: 'x '.repeat(200),
  assignee: '',
  assigneeName: 'x',
  star: false,
  state: 'in progress',
  steps: ['a', 'b', 'c'],
  step: 1,
  note: 'x',
}

export function boardFrame(): HTMLElement[] {
  const button = (key: string, label: string, run: () => void) => {
    const node = el('button', { class: 'board-bar-button', 'data-key': key }, label)
    node.addEventListener('click', run)
    return node
  }
  panel = el(
    'div',
    { id: 'board-panel', class: 'hidden' },
    el(
      'div',
      { class: 'board-bar' },
      el('span', { class: 'board-bar-title' }, t('board.button')),
      button('show-all', t('board.showAll'), () => pick(showAllPixels())),
      button('default-size', t('board.defaultSize'), () => pick(null)),
      button('close', '×', () => void act({ type: 'setBoard', open: false })),
    ),
    el('div', { class: 'board' }),
    el('div', { class: 'board-column board-probe', 'aria-hidden': 'true' }),
  )
  panel.querySelector('[data-key="close"]')?.setAttribute('title', t('board.close'))
  divider = el('div', { id: 'board-divider', class: 'hidden', title: t('board.divider') })
  dragDivider(divider)
  new ResizeObserver(() => sizeBoard()).observe(document.documentElement)
  return [panel, divider]
}

const shownProject = (s: WindowState | undefined): ProjectInfo | undefined =>
  s?.projects.find((p) => p.id === s.shown)

const isOpen = (p: ProjectInfo | undefined): boolean => p?.orchestration.on === true && p.board.open

export function toggleBoard(): void {
  void act({ type: 'setBoard', open: !isOpen(shownProject(currentState())) })
}

// The Work view's "See all (N) →".
export function openBoardShowingAll(): void {
  if (isOpen(shownProject(currentState()))) {
    pick(showAllPixels())
    return
  }
  showAllWhenOpen = true
  void act({ type: 'setBoard', open: true })
}

function pick(height: number | null): void {
  pending = height
  sizeBoard()
  void act({ type: 'setBoard', height })
}

export function renderBoard(s: WindowState): void {
  if (!panel || !divider) return
  const project = shownProject(s)
  if (s.shown !== lastProject) pending = null
  lastProject = s.shown
  const open = isOpen(project)
  panel.classList.toggle('hidden', !open)
  divider.classList.toggle('hidden', !open)
  if (!open) {
    showAllWhenOpen = false
    panel.querySelector('.board')?.replaceChildren()
    return
  }
  const old = panel.querySelector<HTMLElement>('.board')
  const scrolled = new Map<string, number>()
  for (const column of old?.querySelectorAll<HTMLElement>('.board-column') ?? [])
    scrolled.set(column.dataset.column ?? '', column.querySelector('.board-cards')?.scrollTop ?? 0)
  const left = old?.scrollLeft ?? 0
  const board = boardElement(s, () => {
    const now = currentState()
    if (now) renderBoard(now)
  })
  old?.replaceWith(board)
  board.scrollLeft = left
  for (const column of board.querySelectorAll<HTMLElement>('.board-column')) {
    const cards = column.querySelector('.board-cards')
    if (cards) cards.scrollTop = scrolled.get(column.dataset.column ?? '') ?? 0
  }
  const probe = panel.querySelector('.board-probe')
  if (probe && probe.childElementCount === 0)
    probe.append(el('div', { class: 'board-heading' }, 'x'), taskCard(PROBE_TASK))
  if (pending !== null && project?.board.height === pending) pending = null
  sizeBoard()
  if (showAllWhenOpen) {
    showAllWhenOpen = false
    pick(showAllPixels())
  }
}

const px = (value: string): number => Number.parseFloat(value) || 0

function boardSizes() {
  const bar = panel?.querySelector<HTMLElement>('.board-bar')?.offsetHeight ?? 0
  const board = panel?.querySelector<HTMLElement>('.board')
  const column = board?.querySelector<HTMLElement>('.board-column')
  const probe = panel?.querySelector<HTMLElement>('.board-probe')
  // The columns share the panel's width, so the probe's title wraps as a real card's does.
  if (probe && column) probe.style.width = `${column.offsetWidth}px`
  const boardStyle = board ? getComputedStyle(board) : undefined
  const columnStyle = column ? getComputedStyle(column) : undefined
  return {
    bar,
    heading: column?.querySelector<HTMLElement>('.board-heading')?.offsetHeight ?? 0,
    card: probe?.querySelector<HTMLElement>('.board-card')?.offsetHeight ?? 0,
    gap: px(columnStyle?.rowGap ?? ''),
    padding:
      px(boardStyle?.paddingTop ?? '') +
      px(boardStyle?.paddingBottom ?? '') +
      px(columnStyle?.paddingTop ?? '') +
      px(columnStyle?.paddingBottom ?? ''),
  }
}

// The right-hand area under the header.
function areaHeight(): number {
  const content = document.getElementById('content')
  const header = content?.querySelector<HTMLElement>('.content-header')
  return (content?.clientHeight ?? 0) - (header?.offsetHeight ?? 0)
}

function cap(): number {
  const row = document.querySelector<HTMLElement>('.xterm-rows > div')?.offsetHeight || FALLBACK_ROW
  return boardCap({
    area: areaHeight(),
    strip: document.getElementById('tab-strip')?.offsetHeight ?? 0,
    drawer: shownDrawerPixels() + (divider?.offsetHeight ?? 0),
    row,
    chrome: PANE_CHROME,
  })
}

// Every card of the tallest column, with the bar and the paddings.
function showAllPixels(): number {
  const sizes = boardSizes()
  const board = panel?.querySelector<HTMLElement>('.board')
  let tallest = 0
  for (const column of board?.querySelectorAll<HTMLElement>('.board-column') ?? []) {
    const heading = column.querySelector<HTMLElement>('.board-heading')?.offsetHeight ?? 0
    const cards = column.querySelector<HTMLElement>('.board-cards')?.scrollHeight ?? 0
    tallest = Math.max(tallest, heading + sizes.gap + cards)
  }
  const scrollbar = board ? board.offsetHeight - board.clientHeight : 0
  return Math.ceil(showAllHeight(sizes.bar + sizes.padding + tallest + scrollbar, areaHeight()))
}

export function sizeBoard(): void {
  const project = shownProject(currentState())
  if (!panel || !isOpen(project)) return
  const wanted = pending ?? project?.board.height ?? defaultBoardHeight(boardSizes())
  panel.style.height = `${Math.round(Math.min(wanted, cap()))}px`
}

// The drawer's divider is the precedent: the moves follow the pointer captured on the divider.
function dragDivider(node: HTMLElement): void {
  node.addEventListener('pointerdown', (event) => {
    event.preventDefault()
    node.setPointerCapture(event.pointerId)
    const top = panel?.getBoundingClientRect().top ?? 0
    const least = (panel?.querySelector<HTMLElement>('.board-bar')?.offsetHeight ?? 0) * 2
    const move = (e: PointerEvent) => {
      pending = Math.round(Math.max(least, Math.min(e.clientY - top, cap())))
      sizeBoard()
    }
    node.addEventListener('pointermove', move)
    node.addEventListener(
      'pointerup',
      () => {
        node.removeEventListener('pointermove', move)
        if (pending !== null) void act({ type: 'setBoard', height: pending })
      },
      { once: true },
    )
  })
}
