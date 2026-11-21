// Decision 1.125: every post to the orchestrator ends with the Work view's three counts, from the
// same function as its tiles, so the human following the orchestrator from a phone sees the team.
import { describe, expect, expectTypeOf, test } from 'vitest'
import {
  type CountedTopicStatus,
  postCounts,
  workCounts,
} from '../../../src/core/orchestration/counts'
import type { TopicStatus } from '../../../src/core/orchestration/topics'
import {
  orchestrationInfo,
  setMode,
  setOrchestrator,
} from '../../../src/core/projects/orchestration'
import { project, projects } from '../../factories/projects'

const topics = [
  { status: 'open' as const },
  { status: 'discussing' as const },
  { status: 'closed' as const },
]
const tasks = [
  { state: 'queued' as const },
  { state: 'in progress' as const },
  { state: 'in progress' as const },
  { state: 'waiting' as const },
  { state: 'to review' as const },
  { state: 'done' as const },
  { state: 'dropped' as const },
]

const team = (on: boolean) => {
  let s = setMode(projects([project('p1', 'Work', ['O', 'W'])]), 'p1', true)
  s = setOrchestrator(s, 'p1', 'O')
  const p = setMode(s, 'p1', on).projects[0]
  return p ? orchestrationInfo(p) : undefined
}

describe('the Work view’s counts', () => {
  test('open and discussing topics; tasks in progress; tasks waiting', () => {
    expect(workCounts(topics, tasks)).toEqual({ forYou: 2, working: 2, waiting: 1 })
    expect(workCounts([], [])).toEqual({ forYou: 0, working: 0, waiting: 0 })
  })

  // Decision 1.197: a PR waiting on the human awaits them as a topic does.
  test('"for you" counts each task in To review waiting on a PR, and nothing else in To review', () => {
    const review = (on: 'orchestrator' | 'human' | 'pr-approval' | 'pr-merge') => ({
      state: 'to review' as const,
      reviewWait: { on },
    })
    const waits = [
      review('pr-approval'),
      review('pr-merge'),
      review('human'),
      review('orchestrator'),
    ]
    expect(workCounts(topics, [...tasks, ...waits]).forYou).toBe(4)
    expect(postCounts(team(true), 'O', [], waits)?.forYou).toBe(2)
    expect(workCounts([], [{ state: 'waiting', reviewWait: { on: 'pr-merge' } }]).forYou).toBe(0)
  })

  test('the tiles’ lists (closed topics and closed tasks already left out) count the same', () => {
    const shownTopics = topics.filter((x) => x.status !== 'closed')
    const openTasks = tasks.filter((x) => !['done', 'dropped'].includes(x.state))
    expect(workCounts(shownTopics, openTasks)).toEqual(workCounts(topics, tasks))
  })

  test('only the orchestrator of a project in the mode hears them', () => {
    expect(postCounts(team(true), 'O', topics, tasks)).toEqual({
      forYou: 2,
      working: 2,
      waiting: 1,
    })
    expect(postCounts(team(true), 'W', topics, tasks)).toBeUndefined()
    expect(postCounts(team(false), 'O', topics, tasks)).toBeUndefined()
    expect(postCounts(undefined, 'O', topics, tasks)).toBeUndefined()
  })

  test('the statuses it counts are the topics’ store’s, spelled out for the renderer', () => {
    expectTypeOf<CountedTopicStatus>().toEqualTypeOf<TopicStatus>()
  })
})
