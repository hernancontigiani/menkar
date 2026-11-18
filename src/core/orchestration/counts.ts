import type { ProjectInfo } from '../projects/info'
import type { TaskState } from './taskState'

// Spelled out rather than imported: the renderer counts the tiles here and cannot load the topics'
// store, which reads files.
export type CountedTopicStatus = 'open' | 'discussing' | 'closed'

export interface WorkCounts {
  readonly topics: number
  readonly working: number
  readonly waiting: number
}

// The sidebar's count tiles, and the tail of every post to the orchestrator: one count for both,
// or the phone and the sidebar disagree.
export function workCounts(
  topics: readonly { readonly status: CountedTopicStatus }[],
  tasks: readonly { readonly state: TaskState }[],
): WorkCounts {
  return {
    topics: topics.filter((x) => x.status !== 'closed').length,
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
  tasks: readonly { readonly state: TaskState }[],
): WorkCounts | undefined {
  if (!mode?.on || mode.orchestrator !== sessionId) return undefined
  return workCounts(topics, tasks)
}
