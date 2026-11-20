// The captures' world, written through the app's own writers into a throwaway root. Every path is
// explicit: saveTasks() and its kin resolve theirs from this process's environment, which would be
// the developer's own config. What only an agent writes (a transcript) is written as the agent
// writes it, since the app has no writer for it.
import { chmodSync, copyFileSync, mkdirSync, utimesSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { flavorFacts } from '../../src/core/flavor'
import { writeJson } from '../../src/core/jsonstate'
import {
  emptyTasks,
  serializeTasks,
  type Tasks,
  taskTool,
} from '../../src/core/orchestration/tasks'
import {
  emptyTopics,
  serializeTopics,
  type Topics,
  topicTool,
} from '../../src/core/orchestration/topics'
import { workerName } from '../../src/core/orchestration/workers'
import { projectFilesFolder, tasksPath, topicsPath } from '../../src/core/paths'
import {
  addMember,
  createProject,
  freshProjects,
  type Projects,
  type Result,
  renameProject,
  type SavedTab,
  type SavedWindow,
  setCurrent,
  setFilesFolder,
} from '../../src/core/projects/model'
import { setMode, setOrchestrator, setRole, setSkills } from '../../src/core/projects/orchestration'
import { setParent } from '../../src/core/projects/parents'
import { projectsPath, serializeProjects } from '../../src/core/projects/store'
import { withSetting } from '../../src/core/settings'
import { parseState, statePath } from '../../src/core/state'
import { cachePath } from '../../src/core/usage/cache'
import { historyPath } from '../../src/core/usage/history'
import { runPass } from '../../src/core/usage/pass'
import { catppuccin } from '../fixtures'
import { e2ePath } from '../path'
import type { Locale, Theme } from './registry'
import { en } from './strings/en'
import { es } from './strings/es'

export type Text = keyof typeof en
export const STRINGS: Readonly<Record<Locale, Readonly<Record<Text, string>>>> = { en, es }

const MINUTE = 60_000
// The furthest back a "today" event goes, in minutes.
export const TODAY_SPAN_MINUTES = 600
// A run this close before midnight waits for it rather than straddle two days.
export const MIDNIGHT_MARGIN_MINUTES = 10

function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function nextMidnight(ms: number): number {
  const d = new Date(startOfDay(ms))
  d.setDate(d.getDate() + 1)
  return d.getTime()
}

// Today's events are never before this, so they stay in "today" whatever the hour.
const todayFloor = (ms: number) => startOfDay(ms) + MINUTE

// How long to wait before seeding at `nowMs`: within the margin before midnight, until just after
// it; in the minutes right after midnight, until today's events have room after the floor.
export function seedWait(nowMs: number): number {
  const midnight = nextMidnight(nowMs)
  if (nowMs >= midnight - MIDNIGHT_MARGIN_MINUTES * MINUTE) return midnight + 2 * MINUTE - nowMs
  const ready = startOfDay(nowMs) + 2 * MINUTE
  return nowMs < ready ? ready - nowMs : 0
}

export interface SeedClock {
  readonly now: number
  // `minutes` before now, at most TODAY_SPAN_MINUTES; squeezed in order between today's floor and
  // now when the day is younger than the span, so it is always today and never after now.
  today(minutes: number): number
  // A local wall time `days` days before today.
  daysAgo(days: number, hour: number, minute: number): number
}

export function seedClock(now: number): SeedClock {
  const room = now - todayFloor(now)
  const scale = Math.max(0, Math.min(1, room / (TODAY_SPAN_MINUTES * MINUTE)))
  return {
    now,
    today(minutes) {
      if (minutes < 0 || minutes > TODAY_SPAN_MINUTES)
        throw new RangeError(`today() takes 0 to ${TODAY_SPAN_MINUTES} minutes, got ${minutes}`)
      return now - Math.round(minutes * MINUTE * scale)
    },
    daysAgo(days, hour, minute) {
      const d = new Date(startOfDay(now))
      d.setDate(d.getDate() - days)
      d.setHours(hour, minute, 0, 0)
      return d.getTime()
    },
  }
}

const iso = (ms: number) => new Date(ms).toISOString()

export const PROJECT = {
  team: '4e0a7d1c9b2f',
  site: '7b3f0e9a1c5d',
  notes: '2c8d6a4f0e1b',
} as const

export const SESSION = {
  lead: '5eed0000-0000-4000-8000-000000000001',
  reviewer: '5eed0000-0000-4000-8000-000000000002',
  w1: '5eed0000-0000-4000-8000-000000000011',
  w2: '5eed0000-0000-4000-8000-000000000012',
  w3: '5eed0000-0000-4000-8000-000000000013',
  w4: '5eed0000-0000-4000-8000-000000000014',
  docs: '5eed0000-0000-4000-8000-000000000021',
  siteBuild: '5eed0000-0000-4000-8000-000000000022',
  notes: '5eed0000-0000-4000-8000-000000000031',
  release: '5eed0000-0000-4000-8000-000000000041',
  spike: '5eed0000-0000-4000-8000-000000000042',
} as const
export type SessionKey = keyof typeof SESSION

// The names Claude has for the seeded sessions: a worker's is the one Menkar gives it per task.
export function sessionNames(locale: Locale): Readonly<Record<SessionKey, string>> {
  const s = STRINGS[locale]
  return {
    lead: s.sessionLead,
    reviewer: s.sessionReviewer,
    w1: workerName(s.projectTeam, 1),
    w2: workerName(s.projectTeam, 2),
    w3: workerName(s.projectTeam, 3),
    w4: workerName(s.projectTeam, 4),
    docs: s.sessionDocs,
    siteBuild: s.sessionSiteBuild,
    notes: s.sessionNotes,
    release: s.sessionRelease,
    spike: s.sessionSpike,
  }
}

// Every text the seed writes in `locale`, by a name that is the same in both: the catalog's keys,
// and the sessions' names by their keys.
export function vocabulary(locale: Locale): Readonly<Record<string, string>> {
  const names = Object.fromEntries(
    Object.entries(sessionNames(locale)).map(([k, v]) => [`session:${k}`, v]),
  )
  return { ...STRINGS[locale], ...names }
}

const FOLDER: Readonly<Record<SessionKey, string>> = {
  lead: 'atlas',
  reviewer: 'atlas',
  w1: 'atlas',
  w2: 'atlas',
  w3: 'atlas',
  w4: 'atlas',
  docs: 'harbor-site',
  siteBuild: 'harbor-site',
  notes: 'research',
  release: 'atlas',
  spike: 'search-trial',
}

export type ShownState = 'working' | 'blocked' | 'idle'

// What a stand-in terminal shows for one session; the stand-in draws it.
export interface Screen {
  readonly title: string
  readonly state: ShownState
  readonly prompt: string
  readonly lines: readonly string[]
  // The command a blocked session asks to run.
  readonly ask?: string
}

export const SCREENS_ENV = 'MENKAR_STAND_IN_SCREENS'
export const DEFAULT_SCREEN = 'default'
// What a chat tab's stand-in answers, and the command it asks to run.
export const CHAT_SCREEN = 'chat'

function screens(locale: Locale): Record<SessionKey | typeof DEFAULT_SCREEN, Screen> {
  const s = STRINGS[locale]
  const n = sessionNames(locale)
  const screen = (
    key: SessionKey,
    state: ShownState,
    prompt: Text,
    lines: readonly Text[],
    ask?: Text,
  ): Screen => ({
    title: n[key],
    state,
    prompt: s[prompt],
    lines: lines.map((l) => s[l]),
    ...(ask ? { ask: s[ask] } : {}),
  })
  return {
    lead: screen('lead', 'working', 'promptLead', ['screenLead1', 'screenLead2']),
    reviewer: screen('reviewer', 'blocked', 'promptReviewer', ['screenReviewer1'], 'askReviewer'),
    w1: screen('w1', 'idle', 'promptNew', []),
    w2: screen('w2', 'working', 'promptWorker2', ['screenWorker2a', 'screenWorker2b']),
    w3: screen('w3', 'idle', 'promptWorker3', ['screenWorker3a', 'screenWorker3b']),
    w4: screen('w4', 'idle', 'promptWorker4', ['screenWorker4a', 'screenWorker4b']),
    docs: screen('docs', 'idle', 'promptDocs', ['screenDocs1']),
    siteBuild: screen('siteBuild', 'working', 'promptSiteBuild', ['screenSiteBuild1']),
    notes: screen('notes', 'idle', 'promptNotes', ['screenNotes1']),
    release: screen('release', 'idle', 'promptNew', []),
    spike: screen('spike', 'idle', 'promptNew', []),
    default: { title: '', state: 'idle', prompt: s.promptNew, lines: [] },
  }
}

function ok(result: Result): Projects {
  if (!result.ok) throw new Error(`the seed's project was refused: ${result.refusal}`)
  return result.projects
}

const TEAM: readonly SessionKey[] = ['lead', 'reviewer', 'w1', 'w2', 'w3', 'w4']

function projects(locale: Locale): { state: Projects; windows: SavedWindow[] } {
  const s = STRINGS[locale]
  let p = freshProjects(() => PROJECT.team)
  p = ok(renameProject(p, PROJECT.team, s.projectTeam))
  p = ok(createProject(p, s.projectSite, PROJECT.site))
  p = ok(createProject(p, s.projectNotes, PROJECT.notes))
  for (const key of TEAM) p = addMember(p, PROJECT.team, SESSION[key])
  for (const key of ['docs', 'siteBuild'] as const) p = addMember(p, PROJECT.site, SESSION[key])
  p = addMember(p, PROJECT.notes, SESSION.notes)
  for (const key of ['w1', 'w2', 'w3', 'w4'] as const) p = setParent(p, SESSION[key], SESSION.lead)
  p = setMode(p, PROJECT.team, true)
  p = setOrchestrator(p, PROJECT.team, SESSION.lead)
  p = setRole(p, PROJECT.team, SESSION.reviewer, s.roleReviewer)
  const skilled = setSkills(p, PROJECT.team, SESSION.reviewer, [
    { name: s.skillApiStyle, maintainer: true },
    { name: s.skillOpenapi },
  ])
  if (!skilled.ok) throw new Error(`the seed's skills were refused: ${skilled.refusal}`)
  p = setFilesFolder(skilled.projects, PROJECT.notes, s.filesFolder)
  p = setCurrent(p, PROJECT.team)
  const tab = (...keys: SessionKey[]): SavedTab => ({
    panes: keys.map((k) => SESSION[k]),
    orientation: 'horizontal',
  })
  const background = (key: SessionKey): SavedTab => ({ ...tab(key), place: 'background' })
  const windows: SavedWindow[] = [
    {
      current: PROJECT.team,
      maximized: false,
      tabs: {
        [PROJECT.team]: [
          tab('lead'),
          tab('reviewer'),
          background('w2'),
          background('w3'),
          background('w4'),
        ],
        [PROJECT.site]: [tab('docs', 'siteBuild')],
        [PROJECT.notes]: [tab('notes')],
      },
    },
  ]
  return { state: p, windows }
}

function work(locale: Locale, clock: SeedClock): { tasks: Tasks; topics: Topics } {
  const s = STRINGS[locale]
  const n = sessionNames(locale)
  const byName = new Map(Object.entries(n).map(([k, v]) => [v, SESSION[k as SessionKey]]))
  const nameOf = (id: string) => Object.entries(SESSION).find(([, v]) => v === id)?.[0] ?? id
  const idOf = (name: string) => {
    const id = byName.get(name)
    return id ? { id } : { refusal: `no session ${name}` }
  }
  let tasks = emptyTasks()
  const task = (
    caller: SessionKey,
    tool: Parameters<typeof taskTool>[0],
    args: Record<string, unknown>,
    at: number,
  ) => {
    const r = taskTool(tool, args, {
      tasks,
      projectId: PROJECT.team,
      caller: SESSION[caller],
      orchestrator: SESSION.lead,
      nameOf,
      idOf,
      at: iso(at),
    })
    if (!r.ok || !r.tasks) throw new Error(`the seed's ${tool} was refused: ${r.text}`)
    tasks = r.tasks
  }
  const steps = (...keys: Text[]) => keys.map((k) => s[k])
  const t = clock.today
  task('lead', 'task_add', { title: s.task1, assignee: n.w1 }, t(300))
  task(
    'w1',
    'task_steps',
    { number: 1, steps: steps('task1Step1', 'task1Step2', 'task1Step3') },
    t(295),
  )
  task('w1', 'task_review', { number: 1, note: s.task1Note }, t(200))
  task('lead', 'task_close', { number: 1, outcome: 'done' }, t(120))
  task('lead', 'task_add', { title: s.task2, assignee: n.w2, star: true }, t(240))
  task(
    'w2',
    'task_steps',
    {
      number: 2,
      steps: steps('task2Step1', 'task2Step2', 'task2Step3', 'task2Step4', 'task2Step5'),
    },
    t(235),
  )
  task('w2', 'task_progress', { number: 2, step: 3, note: s.task2Note }, t(20))
  task('lead', 'task_add', { title: s.task3, assignee: n.w3 }, t(230))
  task(
    'w3',
    'task_steps',
    { number: 3, steps: steps('task3Step1', 'task3Step2', 'task3Step3', 'task3Step4') },
    t(225),
  )
  task(
    'w3',
    'task_progress',
    { number: 3, step: 2, note: s.task3Note, waiting_on: n.reviewer },
    t(60),
  )
  task('lead', 'task_add', { title: s.task4, assignee: n.w4 }, t(220))
  task(
    'w4',
    'task_steps',
    { number: 4, steps: steps('task4Step1', 'task4Step2', 'task4Step3') },
    t(215),
  )
  task('w4', 'task_review', { number: 4, note: s.task4Note, waiting_on: 'human' }, t(15))
  task('lead', 'task_add', { title: s.task5 }, t(10))
  task('lead', 'task_add', { title: s.task6 }, clock.daysAgo(3, 10, 0))
  task('lead', 'task_close', { number: 6, outcome: 'dropped' }, clock.daysAgo(2, 16, 30))

  let topics = emptyTopics()
  const topic = (
    tool: Parameters<typeof topicTool>[0],
    args: Record<string, unknown>,
    at: number,
  ) => {
    const r = topicTool(tool, args, {
      topics,
      projectId: PROJECT.team,
      caller: SESSION.lead,
      tasks: [1, 2, 3, 4, 5, 6],
      starred: [2],
      nameOf,
      at: iso(at),
    })
    if (!r.ok || !r.topics) throw new Error(`the seed's ${tool} was refused: ${r.text}`)
    topics = r.topics
  }
  topic('topic_add', { title: s.topic1, context: s.topic1Context, task: 2 }, t(90))
  topic('topic_add', { title: s.topic2, context: s.topic2Context, task: 3, blocking: true }, t(70))
  topic('topic_update', { number: 2, status: 'discussing' }, t(30))
  topic('topic_add', { title: s.topic3, context: s.topic3Context, task: 1 }, t(280))
  topic('topic_close', { number: 3, decision: s.topic3Decision }, t(150))
  return { tasks, topics }
}

type Line = Record<string, unknown>
// Minutes between two of the human's messages in one sitting: under the usage's burst gap.
const SITTING_GAP_MINUTES = 6

// A week of turns per session, as Claude Code writes them: a prompt that opens the turn and the
// responses with their tokens. The same shape every run, at the seed's times.
function turns(
  key: SessionKey,
  index: number,
  cwd: string,
  locale: Locale,
  clock: SeedClock,
): Line[] {
  const s = STRINGS[locale]
  const lines: Line[] = []
  const id = SESSION[key]
  const turn = (n: number, start: number, end: number) => {
    const minutes = (end - start) / MINUTE
    lines.push({
      type: 'user',
      uuid: `${id}-u${n}`,
      sessionId: id,
      cwd,
      timestamp: iso(start),
      turnOrigin: 'human',
      message: { role: 'user', content: s.usagePrompt },
    })
    const responses = Math.max(2, Math.round(minutes / 3))
    for (let r = 1; r <= responses; r++) {
      lines.push({
        type: 'assistant',
        sessionId: id,
        timestamp: iso(start + Math.round(((end - start) * r) / responses)),
        requestId: `req_${id}_${n}_${r}`,
        message: {
          id: `msg_${id}_${n}_${r}`,
          role: 'assistant',
          model: 'claude-opus-5-5',
          usage: {
            input_tokens: 1200 + 100 * index,
            output_tokens: 300 + 40 * ((n + r) % 5),
            cache_creation_input_tokens: 2000,
            cache_read_input_tokens: 24_000 + 1000 * r,
          },
          content: [{ type: 'text', text: s.usageAnswer }],
        },
      })
    }
  }
  let n = 0
  // A sitting: a few short exchanges a few minutes apart, so the human's time reads as a burst,
  // then a last turn of `minutes`.
  const sitting = (start: number, exchanges: number, minutes: number) => {
    for (let k = 0; k < exchanges; k++) {
      const at = start + k * SITTING_GAP_MINUTES * MINUTE
      const last = k === exchanges - 1
      turn(++n, at, at + (last ? minutes : SITTING_GAP_MINUTES - 2) * MINUTE)
    }
  }
  for (let day = 6; day >= 1; day--) {
    if ((day + index) % 4 === 0) continue // a day off
    const morning = clock.daysAgo(day, 9 + (index % 4), (7 * day + 11 * index) % 50)
    sitting(morning, 2 + ((day + index) % 3), 12 + ((day * 7 + index * 5) % 25))
    const afternoon = clock.daysAgo(day, 14 + (index % 3), (5 * day + 3 * index) % 50)
    sitting(afternoon, 2 + ((day * 2 + index) % 2), 8 + ((day * 3 + index) % 20))
  }
  // Today's turn ends before now, whatever the hour.
  const since = 300 - 25 * index
  turn(++n, clock.today(since), clock.today(since - 20))
  return lines
}

export interface SeedDirs {
  readonly root: string
  readonly home: string
}

// Writes the world for one launch in `locale` and `theme`, at the time `now` (wait seedWait(now)
// first), and returns what the launch adds to the app's environment.
export async function seed(
  dirs: SeedDirs,
  locale: Locale,
  theme: Theme,
  now: number,
): Promise<Record<string, string>> {
  const clock = seedClock(now)
  const s = STRINGS[locale]
  const app = flavorFacts().dirName
  const config = join(dirs.root, 'config', app)
  const cache = join(dirs.root, 'cache', app)
  const data = join(dirs.root, 'data', app)

  const { state, windows } = projects(locale)
  await writeJson(join(config, basename(projectsPath())), serializeProjects(state, windows))
  const { tasks, topics } = work(locale, clock)
  await writeJson(join(config, basename(tasksPath())), serializeTasks(tasks))
  await writeJson(join(config, basename(topicsPath())), serializeTopics(topics))
  // state.json has no serializer of its own: written as its saver writes it.
  let settings = parseState({})
  settings = withSetting(settings, 'language', locale)
  settings = withSetting(settings, 'color_scheme', theme)
  settings = withSetting(settings, 'terminal_theme', catppuccin(theme))
  settings = withSetting(settings, 'terminal_colors', 'theme')
  // A session turning blocked raises a toast only while the window has focus, which varies under
  // Xvfb: off, the same screen comes out every run, and no sound plays.
  settings = withSetting(settings, 'notify_idle', false)
  settings = withSetting(settings, 'notify_sound', false)
  await writeJson(join(config, basename(statePath())), {
    ...settings.rest,
    names: settings.names,
    hidden: settings.hidden,
  })

  const names = sessionNames(locale)
  const claudeProjects = join(dirs.home, '.claude', 'projects')
  ;(Object.keys(SESSION) as SessionKey[]).forEach((key, index) => {
    const cwd = join(dirs.home, 'work', FOLDER[key])
    mkdirSync(cwd, { recursive: true })
    const folder = join(claudeProjects, cwd.replace(/[^A-Za-z0-9]/g, '-'))
    mkdirSync(folder, { recursive: true })
    const lines = [
      { type: 'custom-title', customTitle: names[key], sessionId: SESSION[key] },
      ...turns(key, index, cwd, locale, clock),
    ]
    const file = join(folder, `${SESSION[key]}.jsonl`)
    writeFileSync(file, `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`)
    const last = lines.at(-1)?.timestamp
    const mtime = typeof last === 'string' ? Date.parse(last) : now
    utimesSync(file, mtime / 1000, mtime / 1000)
  })

  // The project's own skills, as a repository keeps them, for the role dialog to find.
  const repo = join(dirs.home, 'work', FOLDER.lead)
  mkdirSync(join(repo, '.git'), { recursive: true })
  for (const [name, description] of [
    [s.skillApiStyle, s.skillApiStyleText],
    [s.skillOpenapi, s.skillOpenapiText],
    [s.skillChangelog, s.skillChangelogText],
  ] as const) {
    const dir = join(repo, '.claude', 'skills', name)
    mkdirSync(dir, { recursive: true })
    const file = join(dir, 'SKILL.md')
    writeFileSync(file, `---\nname: ${name}\ndescription: ${description}\n---\n\n${description}\n`)
    const at = clock.daysAgo(6, 9, 0) / 1000
    utimesSync(file, at, at)
  }

  const members = new Map<string, { id: string; name: string }>()
  for (const p of state.projects)
    for (const id of p.members) members.set(id, { id: p.id, name: p.name })
  runPass(
    {
      sessions: members,
      projectNames: new Map(state.projects.map((p) => [p.id, p.name])),
    },
    {
      claudeProjects,
      cache: join(cache, basename(cachePath())),
      history: join(data, basename(historyPath())),
    },
  )

  const files = projectFilesFolder(join(dirs.home, flavorFacts().filesFolder), s.filesFolder)
  mkdirSync(files, { recursive: true })
  for (const [name, text, minutes] of [
    [s.fileInterviews, s.fileInterviewsText, 45],
    [s.filePlan, s.filePlanText, 180],
  ] as const) {
    const path = join(files, name)
    writeFileSync(path, text)
    const at = clock.today(minutes) / 1000
    utimesSync(path, at, at)
  }

  const screenDir = join(dirs.root, 'stand-in')
  mkdirSync(screenDir, { recursive: true })
  for (const [key, screen] of Object.entries(screens(locale))) {
    const id = key === DEFAULT_SCREEN ? DEFAULT_SCREEN : SESSION[key as SessionKey]
    writeFileSync(join(screenDir, `${id}.json`), `${JSON.stringify(screen, null, 2)}\n`)
  }
  writeFileSync(
    join(screenDir, `${CHAT_SCREEN}.json`),
    `${JSON.stringify({ answer: s.chatAnswer, ask: s.chatAsk }, null, 2)}\n`,
  )
  const script = join(screenDir, 'claude.mjs')
  copyFileSync(fileURLToPath(new URL('./stand-in-claude.mjs', import.meta.url)), script)
  const bin = join(dirs.root, 'bin')
  mkdirSync(bin, { recursive: true })
  writeFileSync(join(bin, 'claude'), `#!/bin/sh\nexec node '${script}' "$@"\n`)
  chmodSync(join(bin, 'claude'), 0o755)

  return { PATH: e2ePath(dirs.root, bin), [SCREENS_ENV]: screenDir }
}
