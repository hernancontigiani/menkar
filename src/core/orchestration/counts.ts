import type { ProjectInfo } from '../projects/info'
import { type ReviewWaiter, type TaskState, waitsOnPr } from './taskState'

// Spelled out rather than imported: the renderer counts the tiles here and cannot load the topics'
// store, which reads files.
export type CountedTopicStatus = 'open' | 'discussing' | 'closed'

export interface WorkCounts {
  // "Awaiting you": the open topics and the tasks in To review waiting on a PR (decision 1.197).
  readonly forYou: number
  readonly working: number
  readonly waiting: number
}

export interface CountedTask {
  readonly state: TaskState
  readonly reviewWait?: { readonly on: ReviewWaiter }
}

// A task in To review whose PR the human approves or merges: it awaits the human as a topic does.
export const awaitsPr = (task: CountedTask): boolean =>
  task.state === 'to review' && task.reviewWait !== undefined && waitsOnPr(task.reviewWait.on)

// The sidebar's count tiles, and the tail of every post to the orchestrator: one count for both,
// or the phone and the sidebar disagree.
export function workCounts(
  topics: readonly { readonly status: CountedTopicStatus }[],
  tasks: readonly CountedTask[],
): WorkCounts {
  return {
    forYou: topics.filter((x) => x.status !== 'closed').length + tasks.filter(awaitsPr).length,
    working: tasks.filter((x) => x.state === 'in progress').length,
    waiting: tasks.filter((x) => x.state === 'waiting').length,
  }
}

// Only the orchestrator of a project in the mode hears the counts; any other session's posts are
// left as they were.
export function postCounts(
  mode: Pick<ProjectInfo['orchestration'], 'on' | 'orchestrator'> | undefined,
  sessionId: string,
  topics: readonly { readonly status: CountedTopicStatus }[],
  tasks: readonly CountedTask[],
): WorkCounts | undefined {
  if (!mode?.on || mode.orchestrator !== sessionId) return undefined
  return workCounts(topics, tasks)
}
