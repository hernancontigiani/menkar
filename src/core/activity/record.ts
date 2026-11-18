import type { ReviewWaiter, TaskState } from '../orchestration/taskState'
import type { Task, Tasks } from '../orchestration/tasks'
import type { Topic, Topics } from '../orchestration/topics'

export type WaitKind = 'topic' | 'session' | 'other' | ReviewWaiter

// The journal line's fields, without its version, id and time. No field ever holds text a person
// typed.
export interface TaskStateChange {
  readonly kind: 'task_state'
  readonly projectId: string
  readonly task: number
  readonly state: TaskState
  readonly waitKind?: WaitKind
  // A topic's number or a session's id, never the name typed.
  readonly waitRef?: string
  readonly assignee?: string
}

export interface TopicActivity {
  readonly kind: 'topic_discussed' | 'topic_closed'
  readonly projectId: string
  readonly topic: number
  readonly task?: number
}

// A session's id from the name typed in a task's wait, among that project's sessions.
export type SessionIdByName = (projectId: string, name: string) => string | undefined

const TOPIC_WAIT = /^topic (\d+)$/

function waitOf(
  projectId: string,
  task: Task,
  sessionIdByName: SessionIdByName,
): Pick<TaskStateChange, 'waitKind' | 'waitRef'> {
  if (task.state === 'to review' && task.reviewWait) return { waitKind: task.reviewWait.on }
  if (task.state !== 'waiting' || task.waitingOn === undefined) return {}
  const topic = TOPIC_WAIT.exec(task.waitingOn)
  if (topic?.[1]) return { waitKind: 'topic', waitRef: topic[1] }
  const id = sessionIdByName(projectId, task.waitingOn)
  return id === undefined ? { waitKind: 'other' } : { waitKind: 'session', waitRef: id }
}

function taskStateEvent(
  projectId: string,
  task: Task,
  sessionIdByName: SessionIdByName,
): TaskStateChange {
  return {
    kind: 'task_state',
    projectId,
    task: task.number,
    state: task.state,
    ...waitOf(projectId, task, sessionIdByName),
    ...(task.assignee !== undefined ? { assignee: task.assignee } : {}),
  }
}

// The assignee, the note, the steps and the star are not a state: a renew alone records nothing.
const sameState = (a: Task, b: Task): boolean =>
  a.state === b.state &&
  (a.state !== 'waiting' || a.waitingOn === b.waitingOn) &&
  (a.state !== 'to review' || a.reviewWait?.on === b.reviewWait?.on)

export function taskEvents(
  before: Tasks,
  after: Tasks,
  sessionIdByName: SessionIdByName,
): TaskStateChange[] {
  const events: TaskStateChange[] = []
  for (const [projectId, own] of Object.entries(after.projects)) {
    const previous = new Map(before.projects[projectId]?.tasks.map((x) => [x.number, x]))
    for (const task of own.tasks) {
      const was = previous.get(task.number)
      if (!was || !sameState(was, task))
        events.push(taskStateEvent(projectId, task, sessionIdByName))
    }
  }
  return events
}

const TOPIC_KINDS = { discussing: 'topic_discussed', closed: 'topic_closed' } as const

export function topicEvents(before: Topics, after: Topics): TopicActivity[] {
  const events: TopicActivity[] = []
  for (const [projectId, own] of Object.entries(after.projects)) {
    const previous = new Map<number, Topic>(
      before.projects[projectId]?.topics.map((x) => [x.number, x]),
    )
    for (const topic of own.topics) {
      // Menkar raises and closes these itself; the human's answer is already a prompt answered.
      if (topic.kind === 'permission') continue
      if (topic.status === 'open' || previous.get(topic.number)?.status === topic.status) continue
      events.push({
        kind: TOPIC_KINDS[topic.status],
        projectId,
        topic: topic.number,
        ...(topic.task !== undefined ? { task: topic.task } : {}),
      })
    }
  }
  return events
}
