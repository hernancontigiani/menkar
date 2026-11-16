import { workCounts } from '../core/orchestration/counts'
import { type ModeRow, modeRows } from '../core/orchestration/rows'
import type { TaskState } from '../core/orchestration/taskState'
import type { ProjectInfo } from '../core/projects/info'
import type { SessionInfo } from '../core/sessions/info'
import type { DoneView, TaskView, WindowState } from '../shared/workspace'
import { act, sessionState, stateDot } from './app'
import { openBoardShowingAll, toggleBoard } from './board'
import { el } from './dom'
import { t } from './i18n'
import { topicsSection } from './orchestration'
import { showMenu } from './ui'

// The Work view of the sidebar in the orchestration mode (decisions 1.112, 1.115): what waits on
// the human and how far each delegated task is, in the sidebar's width.

const SHOWN_TASKS = 6

function stateLabel(state: TaskState): string {
  switch (state) {
    case 'queued':
      return t('task.queued')
    case 'in progress':
      return t('task.inProgress')
    case 'waiting':
      return t('task.waiting')
    case 'to review':
      return t('task.toReview')
    case 'done':
      return t('task.done')
    case 'dropped':
      return t('task.dropped')
  }
}

// "Work | Team" at the top of the sidebar while the mode is on.
export function viewSwitch(project: ProjectInfo): HTMLElement {
  const button = (team: boolean, label: string) => {
    const node = el(
      'button',
      {
        class: team ? 'view-team' : 'view-work',
        'aria-pressed': String(project.teamView === team),
      },
      label,
    )
    node.addEventListener('click', () => {
      if (project.teamView !== team) void act({ type: 'setTeamView', team })
    })
    return node
  }
  return el(
    'div',
    { class: 'view-switch segmented', role: 'group', 'aria-label': t('work.view') },
    button(false, t('work.work')),
    button(true, t('work.team')),
  )
}

export function workView(
  s: WindowState,
  project: ProjectInfo,
  byId: ReadonlyMap<string, SessionInfo>,
  listed: readonly string[],
): HTMLElement[] {
  const open = s.tasks.open
  const counts = workCounts(s.topics, open)
  const tiles = el(
    'div',
    { class: 'work-tiles' },
    tile(counts.topics, t('work.tileTopics'), 'topics'),
    tile(counts.working, t('work.tileWorking'), 'working'),
    tile(counts.waiting, t('work.tileWaiting'), 'waiting'),
  )
  return [
    tiles,
    el('div', { class: 'work-topics' }, ...topicsSection(s, project.topicsCollapsed)),
    ...tasksSection(open),
    ...consultantsSection(project, byId, listed, s.open),
    ...doneSection(s.doneToday, project.doneTodayOpen),
  ]
}

function tile(n: number, label: string, kind: string): HTMLElement {
  return el(
    'div',
    { class: `work-tile ${kind}`, 'data-tile': kind },
    el('span', { class: 'tile-n' }, String(n)),
    el('span', { class: 'tile-label dim' }, label),
  )
}

function heading(text: string): HTMLElement {
  return el('div', { class: 'work-heading dim' }, text)
}

function tasksSection(open: readonly TaskView[]): HTMLElement[] {
  const head = heading(t('work.tasks', { n: open.length }))
  if (open.length === 0) return [head, el('div', { class: 'work-empty dim' }, t('work.noTasks'))]
  const nodes = open.slice(0, SHOWN_TASKS).map(taskRow)
  if (open.length > SHOWN_TASKS) {
    const all = el('button', { class: 'see-all' }, t('work.seeAll', { n: open.length }))
    all.addEventListener('click', () => openBoardShowingAll())
    nodes.push(all)
  }
  return [head, ...nodes]
}

// A worker rarely reports its last step before the task is closed, so a done task is shown
// complete; a dropped one keeps the step it stopped at.
function shownStep(task: TaskView): { step: number; complete: boolean } {
  return task.state === 'done'
    ? { step: task.steps.length, complete: true }
    : { step: task.step, complete: false }
}

export function stepSegments(task: TaskView): HTMLElement {
  const { step, complete } = shownStep(task)
  return el(
    'span',
    { class: 'step-segments', 'aria-hidden': 'true' },
    ...task.steps.map((_, i) =>
      el('span', {
        class: `segment${complete || i + 1 < step ? ' done' : i + 1 === step ? ' current' : ''}`,
      }),
    ),
  )
}

// "3/5", or the state when the task has no steps yet.
export function progressText(task: TaskView): string {
  return task.steps.length > 0 && task.state !== 'queued'
    ? t('work.steps', { step: shownStep(task).step, steps: task.steps.length })
    : stateLabel(task.state)
}

export function star(task: TaskView): HTMLElement | null {
  return task.star ? el('span', { class: 'priority-star' }, '★') : null
}

export function taskMenu(node: HTMLElement, task: TaskView): void {
  node.addEventListener('contextmenu', (event) => {
    event.preventDefault()
    showMenu(
      [
        {
          label: task.star ? t('work.unstar') : t('work.star'),
          run: () => void act({ type: 'setTaskStar', number: task.number, on: !task.star }),
        },
      ],
      { x: event.clientX, y: event.clientY },
    )
  })
}

// What a waiting task waits on, or one in To review when not on the orchestrator (decision 1.164).
export function waitsOn(task: TaskView): string {
  if (task.state === 'waiting') return task.waitingOn ?? ''
  const wait = task.state === 'to review' ? task.reviewWait : undefined
  const label = !wait
    ? ''
    : wait.on === 'human'
      ? t('task.waitsOnHuman')
      : wait.on === 'pr-approval'
        ? t('task.waitsOnPrApproval')
        : wait.on === 'pr-merge'
          ? t('task.waitsOnPrMerge')
          : ''
  return label ? [label, wait?.note].filter(Boolean).join(' ') : ''
}

function taskRow(task: TaskView): HTMLElement {
  const on = waitsOn(task)
  const note = on ? t('work.waitingOn', { on }) : ''
  const node = el(
    'button',
    {
      class: `task-row${task.state === 'waiting' ? ' waiting' : ''}`,
      'data-task': String(task.number),
      title: task.title,
    },
    el(
      'div',
      { class: 'task-line' },
      star(task),
      el('span', { class: 'task-title' }, task.title),
      el('span', { class: 'task-progress dim' }, progressText(task)),
    ),
    el(
      'div',
      { class: 'task-line dim' },
      el('span', { class: 'task-assignee' }, assigneeText(task)),
      task.steps.length > 0 ? stepSegments(task) : null,
    ),
    task.note || note
      ? el('div', { class: 'task-note dim' }, [note, task.note].filter(Boolean).join(' · '))
      : null,
  )
  node.addEventListener('click', () => {
    if (task.assignee !== null) void act({ type: 'selectSessionTab', session: task.assignee })
  })
  taskMenu(node, task)
  return node
}

function foldHeading(
  text: string,
  folded: boolean,
  labels: { readonly expand: string; readonly collapse: string },
  section: string,
  toggle: () => void,
): HTMLElement {
  const node = el(
    'button',
    {
      class: `topics-toggle dim${folded ? ' collapsed' : ''}`,
      'aria-expanded': String(!folded),
      'aria-label': folded ? labels.expand : labels.collapse,
      'data-section': section,
    },
    text,
  )
  node.addEventListener('click', toggle)
  return el('div', { class: `topics-heading${folded ? ' collapsed' : ''}` }, node)
}

// The loose sessions with a role label (decision 1.107), as the Team view lists them.
function consultantIds(project: ProjectInfo, listed: readonly string[], open: readonly string[]) {
  const rows = modeRows(project, { listed, open: new Set(open), unfolded: new Set() })
  const ids: string[] = []
  let inConsultants = false
  for (const r of rows as readonly ModeRow[]) {
    if (r.kind === 'heading') inConsultants = r.heading === 'consultants'
    else if (inConsultants && r.kind === 'session' && r.depth === 0) ids.push(r.id)
  }
  return ids
}

function consultantsSection(
  project: ProjectInfo,
  byId: ReadonlyMap<string, SessionInfo>,
  listed: readonly string[],
  open: readonly string[],
): HTMLElement[] {
  const ids = consultantIds(project, listed, open)
  if (ids.length === 0) return []
  const folded = project.consultantsCollapsed
  const head = foldHeading(
    t('work.consultants', { n: ids.length }),
    folded,
    { expand: t('work.consultantsExpand'), collapse: t('work.consultantsCollapse') },
    'consultants',
    () => void act({ type: 'setConsultantsCollapsed', collapsed: !folded }),
  )
  if (folded) return [head]
  return [
    head,
    ...ids.flatMap((id) => {
      const info = byId.get(id)
      if (!info) return []
      const node = el(
        'button',
        { class: 'consultant-row', 'data-session': id, title: info.name },
        stateDot(sessionState(id)),
        el('span', { class: 'consultant-name' }, info.name),
        el('span', { class: 'consultant-role dim' }, project.orchestration.roles[id] ?? ''),
      )
      node.addEventListener('click', () => void act({ type: 'openSession', session: id }))
      return [node]
    }),
  ]
}

function doneSection(done: readonly DoneView[], open: boolean): HTMLElement[] {
  const head = foldHeading(
    t('work.doneToday', { n: done.length }),
    !open,
    { expand: t('work.doneExpand'), collapse: t('work.doneCollapse') },
    'done',
    () => void act({ type: 'setDoneTodayOpen', open: !open }),
  )
  if (!open) return [head]
  return [
    head,
    ...done.map((x) =>
      el(
        'div',
        { class: 'done-row', 'data-done': `${x.kind}-${x.number}`, title: x.title },
        el('span', { class: 'done-check' }, '✓'),
        el('span', { class: 'done-title' }, x.title),
        el(
          'span',
          { class: 'done-kind dim' },
          x.kind === 'topic'
            ? t('work.doneTopic', { n: x.number })
            : t('work.doneTask', { n: x.number }),
        ),
      ),
    ),
  ]
}

// Under a session's name in the Team view (decision 1.116): its current task and step.
export function teamTaskLine(task: TaskView | undefined): HTMLElement | null {
  if (!task) return null
  return el(
    'div',
    { class: `team-task dim${task.state === 'waiting' ? ' waiting' : ''}` },
    el('span', { class: 'team-task-title' }, task.title),
    el('span', { class: 'team-task-step' }, ` · ${progressText(task)}`),
  )
}

// Per window, not saved: the Board's "Done before" unfolded.
let doneBeforeOpen = false

// The Board's columns (decisions 1.112, 1.116, 1.126): every topic and task of the project by
// state; read only. A column's cards scroll under its fixed heading.
export function boardElement(s: WindowState, rerender: () => void): HTMLElement {
  const by = (state: TaskState) => s.tasks.open.filter((x) => x.state === state)
  const column = (key: string, title: string, cards: HTMLElement[], extra: HTMLElement[] = []) =>
    el(
      'section',
      { class: 'board-column', 'data-column': key },
      el(
        'div',
        { class: 'board-heading' },
        el('span', {}, title),
        el('span', { class: 'dim' }, String(cards.length)),
      ),
      el(
        'div',
        { class: 'board-cards' },
        ...(cards.length === 0 && extra.length === 0
          ? [el('div', { class: 'board-empty dim' }, t('board.empty'))]
          : cards),
        ...extra,
      ),
    )
  const before = s.tasks.closedBefore
  const foldBefore = el(
    'button',
    {
      class: `board-before topics-toggle dim${doneBeforeOpen ? '' : ' collapsed'}`,
      'aria-expanded': String(doneBeforeOpen),
    },
    t('board.doneBefore', { n: before.length }),
  )
  foldBefore.addEventListener('click', () => {
    doneBeforeOpen = !doneBeforeOpen
    rerender()
  })
  return el(
    'div',
    { class: 'board' },
    column(
      'topics',
      t('board.topics'),
      s.topics.map((x) =>
        el(
          'div',
          {
            class: `board-card topic-card${x.blocking ? ' blocking' : ''}`,
            'data-topic': String(x.number),
          },
          el(
            'div',
            { class: 'card-title', title: x.title },
            x.star ? el('span', { class: 'priority-star' }, '★') : null,
            el('span', { class: 'dim' }, `${x.number} `),
            x.title,
          ),
          el('div', { class: 'card-meta dim' }, x.from),
        ),
      ),
    ),
    column('queued', t('board.queued'), by('queued').map(taskCard)),
    column('in-progress', t('board.inProgress'), by('in progress').map(taskCard)),
    column('waiting', t('board.waiting'), by('waiting').map(taskCard)),
    column('to-review', t('board.toReview'), by('to review').map(taskCard)),
    column(
      'done',
      t('board.done'),
      s.tasks.closedToday.map(taskCard),
      before.length > 0 ? [foldBefore, ...(doneBeforeOpen ? before.map(taskCard) : [])] : [],
    ),
  )
}

export function taskCard(task: TaskView): HTMLElement {
  const on = waitsOn(task)
  const note = on ? t('work.waitingOn', { on }) : ''
  const node = el(
    'button',
    {
      class: `board-card task-card${task.state === 'waiting' ? ' waiting' : ''}${task.state === 'dropped' ? ' dropped' : ''}`,
      'data-task': String(task.number),
    },
    el(
      'div',
      { class: 'card-title', title: task.title },
      star(task),
      el('span', { class: 'dim' }, `${task.number} `),
      task.title,
    ),
    el(
      'div',
      { class: 'card-meta' },
      task.assignee === null ? null : stateDot(sessionState(task.assignee)),
      el('span', { class: 'card-assignee' }, assigneeText(task)),
      el('span', { class: 'card-progress dim' }, progressText(task)),
    ),
    task.steps.length > 0 && task.state !== 'queued' ? stepSegments(task) : null,
    task.note || note
      ? el('div', { class: 'card-note dim' }, [note, task.note].filter(Boolean).join(' · '))
      : null,
  )
  node.addEventListener('click', () => {
    if (task.assignee !== null) void act({ type: 'selectSessionTab', session: task.assignee })
  })
  taskMenu(node, task)
  return node
}

// Right of the header's Orchestration switch, only while the mode is on; pressed while the Board
// is open.
export function boardButton(): HTMLElement {
  const node = el(
    'button',
    {
      id: 'board-button',
      class: 'header-text hidden',
      title: t('board.tooltip'),
      'aria-pressed': 'false',
    },
    t('board.button'),
  )
  node.addEventListener('click', () => toggleBoard())
  return node
}

export function syncBoardButton(project: ProjectInfo | undefined): void {
  const node = document.getElementById('board-button')
  node?.classList.toggle('hidden', project?.orchestration.on !== true)
  node?.setAttribute('aria-pressed', String(project?.board.open === true))
}

const assigneeText = (task: TaskView): string =>
  task.assignee === null ? t('work.unassigned') : task.assigneeName
