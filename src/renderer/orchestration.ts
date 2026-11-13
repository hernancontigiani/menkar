import { teamFolders } from '../core/orchestration/folders'
import type { ProjectInfo } from '../core/projects/info'
import { recentFolders } from '../core/sessions/history'
import type { SessionInfo } from '../core/sessions/info'
import { tilde } from '../core/tilde'
import type { TopicView, WindowState } from '../shared/workspace'
import { act, currentState, onRender, render } from './app'
import { el, icon } from './dom'
import { t, translate } from './i18n'
import { dialogClosed, dialogOpened, type MenuEntry, showDialog, toast } from './ui'

// The orchestration mode in the window (decisions 1.77, 1.89, 1.91): the header's switch, the
// project popover's team icon and the row menu's block.

// The switch beside Usage, for the project the window shows.
export function modeSwitch(): HTMLElement {
  onRender(watchGuide)
  window.menkar.agentState.onTopicToast(({ project, number, text }) =>
    toast(text, {
      action: {
        label: t('toast.show'),
        run: () => void act({ type: 'showTopic', project, number }),
      },
    }),
  )
  window.menkar.agentState.onTopicUnfold(({ number }) => {
    unfoldedTopics.add(number)
    const s = currentState()
    if (s) render(s)
  })
  const node = el(
    'button',
    {
      id: 'orchestration-switch',
      class: 'header-text',
      role: 'switch',
      'aria-checked': 'false',
      title: t('orch.switchTooltip'),
    },
    el('span', { class: 'switch-track' }, el('span', { class: 'switch-knob' })),
    t('orch.switch'),
  )
  node.addEventListener('click', () => {
    const s = currentState()
    const project = s?.projects.find((p) => p.id === s.shown)
    if (project) void switchMode(project, !project.orchestration.on)
  })
  return node
}

export function syncModeSwitch(project: ProjectInfo | undefined): void {
  const node = document.getElementById('orchestration-switch')
  node?.setAttribute('aria-checked', String(project?.orchestration.on ?? false))
}

// The popover's icon per project, lit while the mode is on.
export function teamButton(p: ProjectInfo, closePopover: () => void): HTMLElement {
  const on = p.orchestration.on
  const node = el(
    'button',
    {
      class: `team-button${on ? ' lit' : ''}`,
      'aria-pressed': String(on),
      title: on ? t('orch.teamOff') : t('orch.teamOn'),
    },
    icon('team'),
  )
  node.addEventListener('click', (event) => {
    event.stopPropagation()
    closePopover()
    void switchMode(p, !on)
  })
  return node
}

// Switching on a project with no orchestrator marked opens the first-time card instead (1.90).
export async function switchMode(p: ProjectInfo, on: boolean): Promise<void> {
  if (on && !p.orchestration.orchestrator) return firstTimeCard(p)
  await act({ type: 'setOrchestrationMode', project: p.id, on })
}

const NEW = '#new'

// Decisions 1.90–1.91, mock F1: what the mode is, who orchestrates — one of the project's sessions
// or a new one —, the guide, and a prompt to hand the guide to another session.
// Per window, in memory (decision 1.94): the card hidden while its guide is open, with what had
// been chosen; `guideTab` is the guide's tab once it shows.
interface HiddenCard {
  readonly project: string
  readonly pick: string
  readonly name: string
  readonly folder: string
  guideTab: string | null
}
let hiddenCard: HiddenCard | null = null

// Closing the guide's tab brings the hidden card back as it was left. Registered when the frame is
// built: app's listeners do not exist yet while this module loads.
const watchGuide = (s: WindowState): void => {
  const hidden = hiddenCard
  if (!hidden) return
  if (hidden.guideTab === null) {
    const tab = s.tabs.find((x) => x.id === s.selectedTab)
    if (tab?.file && !tab.file.preview && tab.file.path.endsWith('/guide/orchestration-mode.md'))
      hidden.guideTab = tab.id
    return
  }
  if (s.tabs.some((x) => x.id === hidden.guideTab)) return
  const project = s.projects.find((p) => p.id === hidden.project)
  if (!project) {
    hiddenCard = null
    return
  }
  queueMicrotask(() => void firstTimeCard(project))
}

function firstTimeCard(p: ProjectInfo): Promise<void> {
  const s = currentState()
  if (!s) return Promise.resolve()
  // What was chosen before the guide opened, when the card comes back for the same project.
  const kept = hiddenCard?.project === p.id ? hiddenCard : null
  hiddenCard = null
  const byId = new Map(s.sessions.map((x) => [x.id, x]))
  const earlier = new Set(Object.values(p.earlier).flat())
  const open = new Set(s.open)
  const candidates = p.members
    .flatMap((id) => {
      const info = byId.get(id)
      return info && !earlier.has(id) && !p.hidden.includes(id) ? [info] : []
    })
    .sort((a, b) => Number(open.has(b.id)) - Number(open.has(a.id)) || a.name.localeCompare(b.name))
  const radio = (value: string, label: string, checked: boolean) => {
    const input = el('input', { type: 'radio', name: 'orchestrator', value })
    input.checked = checked
    return el('label', { class: 'card-choice' }, input, el('span', {}, label))
  }
  const name = el('input', { type: 'text', class: 'card-name', placeholder: t('dialog.name') })
  name.value = kept?.name ?? 'orchestrator'
  const folders = cardFolders(s, p)
  const folder = el(
    'select',
    { class: 'card-folder' },
    ...folders.map((f) => el('option', { value: f }, tilde(f, s.home))),
  )
  if (kept && folders.includes(kept.folder)) folder.value = kept.folder
  const choices = el(
    'div',
    { class: 'card-choices' },
    ...candidates.map((info, i) =>
      radio(info.id, info.name, kept ? kept.pick === info.id : i === 0),
    ),
    radio(NEW, t('orch.cardNew'), kept ? kept.pick === NEW : candidates.length === 0),
    el('div', { class: 'card-new' }, name, folder),
  )
  const chosen = () =>
    choices.querySelector<HTMLInputElement>('input[name="orchestrator"]:checked')?.value ?? NEW
  // Decision 1.102: the sessions the orchestrator manages, all checked; the one chosen to
  // orchestrate is not listed.
  const boxes = candidates.map((info) => {
    const box = el('input', { type: 'checkbox', value: info.id })
    box.checked = true
    return el(
      'label',
      { class: 'card-managed', 'data-session': info.id },
      box,
      el('span', {}, info.name),
    )
  })
  const managedList = el('div', { class: 'card-choices' }, ...boxes)
  const syncManaged = () => {
    const pick = chosen()
    for (const row of boxes) row.hidden = row.dataset.session === pick
  }
  choices.addEventListener('change', syncManaged)
  syncManaged()
  const managed = () =>
    boxes
      .filter((row) => !row.hidden && row.querySelector('input')?.checked)
      .flatMap((row) => (row.dataset.session ? [row.dataset.session] : []))

  return new Promise((resolve) => {
    dialogOpened()
    const close = () => {
      dialogClosed()
      scrim.remove()
      resolve()
    }
    const button = (label: string, value: string, style = '') => {
      const node = el('button', { class: style, 'data-value': value }, label)
      return node
    }
    const guide = button(t('orch.cardGuide'), 'guide')
    const copy = button(t('orch.cardCopy'), 'copy')
    const later = button(t('orch.cardNotNow'), 'later')
    const start = button(t('orch.cardStart'), 'start', 'suggested-text')
    // The card hides while the guide is read; the mode does not move (decision 1.94).
    guide.addEventListener('click', () => {
      hiddenCard = {
        project: p.id,
        pick: chosen(),
        name: name.value,
        folder: folder.value,
        guideTab: null,
      }
      close()
      void act({ type: 'openFilePath', path: s.guidePath })
    })
    copy.addEventListener('click', () => {
      void navigator.clipboard
        .writeText(t('orch.cardPrompt', { path: s.guidePath }))
        .then(() => toast(t('orch.cardCopied')))
    })
    later.addEventListener('click', close)
    start.addEventListener('click', () => {
      const pick = chosen()
      const sessions = managed()
      close()
      void startTeam(p, pick, name.value.trim() || 'orchestrator', folder.value, sessions)
    })
    const card = el(
      'div',
      { class: 'dialog orch-card', role: 'alertdialog' },
      el(
        'div',
        { class: 'message' },
        el('div', { class: 'heading' }, t('orch.cardTitle', { name: p.name })),
        el('div', { class: 'body' }, t('orch.cardWhat')),
        el('div', { class: 'body dim' }, t('orch.cardOrchestrator')),
        el('div', { class: 'card-question' }, t('orch.cardWho')),
        choices,
        candidates.length > 0 ? el('div', { class: 'card-question' }, t('orch.cardManaged')) : null,
        candidates.length > 0 ? managedList : null,
      ),
      el('div', { class: 'responses' }, guide, copy, later, start),
    )
    const scrim = el('div', { class: 'scrim' }, card)
    scrim.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      }
    })
    document.body.append(scrim)
    start.focus()
  })
}

// The folders the project's running sessions work in, as Ctrl+` offers them; with none, the
// recent folders Add session offers.
function cardFolders(s: WindowState, p: ProjectInfo): string[] {
  const running = new Set(s.running)
  const panes = s.tabs
    .filter((tab) => tab.project === p.id)
    .flatMap((tab) => tab.panes)
    .map((pane) => ({
      cwd: pane.cwd,
      running: pane.sessionId !== null && running.has(pane.sessionId),
    }))
  const team = teamFolders(panes)
  return team.length > 0 ? team : recentFolders(s.sessions)
}

async function startTeam(
  p: ProjectInfo,
  pick: string,
  name: string,
  folder: string,
  managed: readonly string[],
): Promise<void> {
  if (pick === NEW) {
    if (!folder) return
    const { refusal } = await act({
      type: 'startNew',
      agent: 'claude',
      folder,
      name,
      prompt: t('orch.firstPrompt', { name: p.name }),
      orchestrator: true,
    })
    if (refusal) return toast(translate(refusal))
  } else await act({ type: 'setOrchestrator', session: pick, on: true })
  // A new orchestrator is marked as it starts, so it exists by now.
  if (managed.length > 0) await act({ type: 'setManaged', sessions: managed, on: true })
  await act({ type: 'setOrchestrationMode', project: p.id, on: true })
}

const checked = (on: boolean, label: string) => `${on ? '✓ ' : ''}${label}`

// After "Group ▸", only while the mode is on: Orchestrator, Role…, With you.
export function orchestrationItems(info: SessionInfo, project: ProjectInfo): MenuEntry[] {
  const o = project.orchestration
  if (!o.on) return []
  const isOrchestrator = o.orchestrator === info.id
  const withYou = o.withYou.includes(info.id)
  const managed = o.orchestrator !== null && project.parents[info.id] === o.orchestrator
  const hand: MenuEntry[] =
    o.orchestrator && !isOrchestrator
      ? [
          {
            label: managed ? t('orch.takeBack') : t('orch.handTo'),
            run: () => void act({ type: 'setManaged', sessions: [info.id], on: !managed }),
          },
        ]
      : []
  return [
    'separator',
    {
      label: checked(isOrchestrator, t('orch.orchestrator')),
      run: () => void act({ type: 'setOrchestrator', session: info.id, on: !isOrchestrator }),
    },
    { label: t('orch.role'), run: () => void roleDialog(info, o.roles[info.id] ?? '') },
    {
      label: checked(withYou, t('orch.withYou')),
      run: () => void act({ type: 'setWithYou', session: info.id, on: !withYou }),
    },
    ...hand,
  ]
}

async function roleDialog(info: SessionInfo, current: string): Promise<void> {
  const answer = await showDialog({
    heading: t('orch.roleHeading', { name: info.name }),
    body: t('orch.roleBody'),
    entry: { value: current, placeholder: t('orch.rolePlaceholder') },
    buttons: [
      { label: t('dialog.cancel'), value: 'cancel' },
      { label: t('dialog.save'), value: 'save', style: 'suggested' },
    ],
    defaultValue: 'save',
  })
  if (answer.value === 'save') await act({ type: 'setRole', session: info.id, label: answer.text })
}

// Per window and not saved: the topics whose context is unfolded.
const unfoldedTopics = new Set<number>()

// At the top of the sidebar while the mode is on (decision 1.89, mock A1): read only, the
// discussion happens in the orchestrator's chat (1.86).
export function topicsSection(s: WindowState, collapsed: boolean): HTMLElement[] {
  const toggle = el(
    'button',
    {
      class: `topics-toggle dim${collapsed ? ' collapsed' : ''}`,
      'aria-expanded': String(!collapsed),
      'aria-label': collapsed ? t('orch.topicsExpand') : t('orch.topicsCollapse'),
    },
    t('orch.topics', { n: s.topics.length }),
  )
  toggle.addEventListener(
    'click',
    () => void act({ type: 'setTopicsCollapsed', collapsed: !collapsed }),
  )
  const head = el('div', { class: `topics-heading${collapsed ? ' collapsed' : ''}` }, toggle)
  if (collapsed) return [head]
  if (s.topics.length === 0)
    return [head, el('div', { class: 'topics-empty dim' }, t('orch.noTopics'))]
  return [head, ...s.topics.map(topicRow)]
}

function topicRow(topic: TopicView): HTMLElement {
  const open = unfoldedTopics.has(topic.number)
  const line = el(
    'button',
    {
      class: `topic-row${open ? ' open' : ''}`,
      'data-topic': String(topic.number),
      'aria-expanded': String(open),
      title: topic.title,
    },
    topic.star ? el('span', { class: 'priority-star' }, '★') : null,
    el('span', { class: 'topic-number dim' }, String(topic.number)),
    el('span', { class: 'topic-title' }, topic.title),
    topic.blocking ? el('span', { class: 'topic-blocking', title: t('orch.blocking') }) : null,
  )
  const node = el('div', { class: 'topic' }, line)
  if (open)
    node.append(
      el(
        'div',
        { class: 'topic-detail' },
        topic.context ? el('div', { class: 'topic-context' }, topic.context) : null,
        el(
          'div',
          { class: 'topic-meta dim' },
          t('orch.topicMeta', {
            from: topic.from,
            status: topic.status === 'discussing' ? t('orch.discussing') : t('orch.open'),
          }),
          topic.blocking ? ` · ${t('orch.blocking')}` : '',
        ),
      ),
    )
  line.addEventListener('click', () => {
    if (open) unfoldedTopics.delete(topic.number)
    else {
      unfoldedTopics.add(topic.number)
      void act({ type: 'seeTopic', number: topic.number })
    }
    const s = currentState()
    if (s) render(s)
  })
  line.addEventListener('dblclick', () => void act({ type: 'discussTopic', number: topic.number }))
  return node
}
