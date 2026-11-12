import { basename } from 'node:path'
import { readJsonReport, UnreadableShape, writeJson } from '../jsonstate'
import { topicsPath } from '../paths'

export type TopicStatus = 'open' | 'discussing' | 'closed'

export interface Topic {
  // Per project, never reused.
  readonly number: number
  readonly title: string
  readonly context: string
  // The session that raised it, by id; shown by its current name.
  readonly from: string
  readonly blocking: boolean
  readonly status: TopicStatus
  readonly decision?: string
  readonly created: string
  readonly updated: string
}

interface ProjectTopics {
  // Higher than every number this project ever had.
  readonly next: number
  readonly topics: readonly Topic[]
}

export interface Topics {
  readonly projects: Readonly<Record<string, ProjectTopics>>
  // Keys a later version wrote, written back as they came.
  readonly rest: Readonly<Record<string, unknown>>
}

export const TOPICS_VERSION = 1

export function emptyTopics(): Topics {
  return { projects: {}, rest: {} }
}

export function topicsOf(t: Topics, projectId: string): readonly Topic[] {
  return t.projects[projectId]?.topics ?? []
}

const withProject = (t: Topics, projectId: string, p: ProjectTopics): Topics => ({
  ...t,
  projects: { ...t.projects, [projectId]: p },
})

export interface NewTopic {
  readonly title: string
  readonly context: string
  readonly from: string
  readonly blocking: boolean
}

// `at` is the time, an ISO string from the clock.
export function addTopic(
  t: Topics,
  projectId: string,
  topic: NewTopic,
  at: string,
): { readonly topics: Topics; readonly number: number } {
  const own = t.projects[projectId] ?? { next: 1, topics: [] }
  const number = own.next
  const added: Topic = { number, ...topic, status: 'open', created: at, updated: at }
  return {
    topics: withProject(t, projectId, { next: number + 1, topics: [...own.topics, added] }),
    number,
  }
}

function change(
  t: Topics,
  projectId: string,
  number: number,
  edit: (topic: Topic) => Topic,
): { readonly topics: Topics; readonly topic: Topic } | null {
  const own = t.projects[projectId]
  const found = own?.topics.find((x) => x.number === number)
  if (!own || !found) return null
  const topic = edit(found)
  return {
    topics: withProject(t, projectId, {
      ...own,
      topics: own.topics.map((x) => (x === found ? topic : x)),
    }),
    topic,
  }
}

export interface TopicChange {
  readonly title?: string
  readonly context?: string
  readonly blocking?: boolean
  readonly status?: 'open' | 'discussing'
}

// null when the project has no topic with that number.
export function updateTopic(
  t: Topics,
  projectId: string,
  number: number,
  changes: TopicChange,
  at: string,
): { readonly topics: Topics; readonly topic: Topic } | null {
  return change(t, projectId, number, (topic) => {
    const { decision: _, ...rest } = topic
    // Reopened, a topic no longer carries the decision that closed it.
    const base = changes.status ? rest : topic
    return {
      ...base,
      ...(changes.title !== undefined ? { title: changes.title } : {}),
      ...(changes.context !== undefined ? { context: changes.context } : {}),
      ...(changes.blocking !== undefined ? { blocking: changes.blocking } : {}),
      ...(changes.status ? { status: changes.status } : {}),
      updated: at,
    }
  })
}

export function closeTopic(
  t: Topics,
  projectId: string,
  number: number,
  decision: string,
  at: string,
): { readonly topics: Topics; readonly topic: Topic } | null {
  return change(t, projectId, number, (topic) => ({
    ...topic,
    status: 'closed',
    decision,
    updated: at,
  }))
}

// Open and discussing ones, those raised by a ★ session first, then by number; a blocking one is
// marked where it is, not moved. `all` adds the closed ones, in the same order.
export function shownTopics(
  project: { readonly orchestration?: { readonly priority?: readonly string[] } },
  list: readonly Topic[],
  all = false,
): Topic[] {
  const priority = new Set(project.orchestration?.priority ?? [])
  const rank = (x: Topic) => (priority.has(x.from) ? 0 : 1)
  return list
    .filter((x) => all || x.status !== 'closed')
    .sort((a, b) => rank(a) - rank(b) || a.number - b.number)
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const STATUSES: readonly TopicStatus[] = ['open', 'discussing', 'closed']

function parseTopic(value: unknown): Topic | null {
  if (!isObject(value)) return null
  const { number, title, context, from, blocking, status, decision, created, updated } = value
  if (typeof number !== 'number' || !Number.isInteger(number) || number < 1) return null
  if (typeof title !== 'string' || typeof from !== 'string') return null
  const known = STATUSES.find((s) => s === status)
  return {
    number,
    title,
    context: typeof context === 'string' ? context : '',
    from,
    blocking: blocking === true,
    status: known ?? 'open',
    ...(typeof decision === 'string' ? { decision } : {}),
    created: typeof created === 'string' ? created : '',
    updated: typeof updated === 'string' ? updated : '',
  }
}

// Version 1: a file of another shape is unreadable (moved aside); within it, a topic that is not
// one is dropped, a number seen twice keeps its first, and `next` never falls to a number in use.
export function parseTopics(value: unknown): Topics {
  if (!isObject(value)) throw new UnreadableShape('not an object')
  const { version, projects, ...rest } = value
  if (version !== TOPICS_VERSION) throw new UnreadableShape('not version 1')
  const read: Record<string, ProjectTopics> = {}
  for (const [id, raw] of Object.entries(isObject(projects) ? projects : {})) {
    if (!isObject(raw)) continue
    const seen = new Set<number>()
    const topics: Topic[] = []
    for (const entry of Array.isArray(raw.topics) ? raw.topics : []) {
      const topic = parseTopic(entry)
      if (!topic || seen.has(topic.number)) continue
      seen.add(topic.number)
      topics.push(topic)
    }
    const highest = Math.max(0, ...seen)
    const next = typeof raw.next === 'number' && Number.isInteger(raw.next) ? raw.next : 1
    read[id] = { next: Math.max(next, highest + 1), topics }
  }
  return { projects: read, rest }
}

export function serializeTopics(t: Topics): Record<string, unknown> {
  return { ...t.rest, version: TOPICS_VERSION, projects: t.projects }
}

export async function loadTopics(): Promise<{
  readonly topics: Topics
  readonly movedTo: string | null
}> {
  const report = await readJsonReport(topicsPath(), parseTopics, emptyTopics)
  return {
    topics: report.value,
    movedTo: report.movedTo === null ? null : basename(report.movedTo),
  }
}

export function saveTopics(t: Topics): Promise<void> {
  return writeJson(topicsPath(), serializeTopics(t))
}

export type TopicTool = 'topic_add' | 'topic_update' | 'topic_close' | 'topic_list'

export interface TopicCall {
  readonly topics: Topics
  readonly projectId: string
  // The calling session's id.
  readonly caller: string
  readonly priority: readonly string[]
  readonly nameOf: (id: string) => string
  readonly at: string
}

// A topic tool's answer, in English for the agent that called, and the topics to keep when they
// changed.
export function topicTool(
  tool: TopicTool,
  args: Readonly<Record<string, unknown>>,
  call: TopicCall,
): { readonly ok: boolean; readonly text: string; readonly topics?: Topics } {
  const refuse = (text: string) => ({ ok: false, text })
  const text = (key: string) => (typeof args[key] === 'string' ? (args[key] as string).trim() : '')
  const number = args.number
  const notFound = `This project has no topic ${String(number)}.`
  if (tool === 'topic_list') {
    const list = shownTopics(
      { orchestration: { priority: call.priority } },
      topicsOf(call.topics, call.projectId),
      args.all === true,
    )
    if (list.length === 0) return { ok: true, text: 'No open topics.' }
    return { ok: true, text: list.map((x) => topicLine(x, call)).join('\n') }
  }
  if (tool === 'topic_add') {
    if (!text('title')) return refuse('A topic needs a title.')
    if (args.blocking !== undefined && typeof args.blocking !== 'boolean')
      return refuse('blocking must be true or false.')
    const added = addTopic(
      call.topics,
      call.projectId,
      {
        title: text('title'),
        context: text('context'),
        from: call.caller,
        blocking: args.blocking === true,
      },
      call.at,
    )
    return { ok: true, text: `Topic ${added.number} added.`, topics: added.topics }
  }
  if (typeof number !== 'number' || !Number.isInteger(number))
    return refuse("Give the topic's number.")
  if (tool === 'topic_close') {
    if (!text('decision')) return refuse('Closing a topic needs its decision.')
    const closed = closeTopic(call.topics, call.projectId, number, text('decision'), call.at)
    return closed
      ? { ok: true, text: `Topic ${number} closed.`, topics: closed.topics }
      : refuse(notFound)
  }
  const status = args.status
  if (status !== undefined && status !== 'open' && status !== 'discussing')
    return refuse('status must be "open" or "discussing".')
  if (args.blocking !== undefined && typeof args.blocking !== 'boolean')
    return refuse('blocking must be true or false.')
  if (args.title !== undefined && !text('title')) return refuse('A topic needs a title.')
  const updated = updateTopic(
    call.topics,
    call.projectId,
    number,
    {
      ...(args.title !== undefined ? { title: text('title') } : {}),
      ...(typeof args.context === 'string' ? { context: args.context.trim() } : {}),
      ...(typeof args.blocking === 'boolean' ? { blocking: args.blocking } : {}),
      ...(status === 'open' || status === 'discussing' ? { status } : {}),
    },
    call.at,
  )
  return updated
    ? { ok: true, text: `Topic ${number} updated.`, topics: updated.topics }
    : refuse(notFound)
}

function topicLine(x: Topic, call: TopicCall): string {
  const star = call.priority.includes(x.from) ? '★ ' : ''
  const parts = [
    `${x.number}. ${star}${x.title}`,
    `from ${call.nameOf(x.from)}`,
    ...(x.blocking ? ['blocking'] : []),
    x.status,
    ...(x.decision !== undefined ? [`decision: ${x.decision}`] : []),
  ]
  return `${parts.join(' · ')}\n   ${x.context}`
}
