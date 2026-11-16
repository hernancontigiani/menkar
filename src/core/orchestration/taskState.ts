// Apart from the store so the window can name a task's state without the store's Node imports.
export const TASK_STATES = [
  'queued',
  'in progress',
  'waiting',
  'to review',
  'done',
  'dropped',
] as const
export type TaskState = (typeof TASK_STATES)[number]

// Whom a task in To review waits on (decision 1.164); the first is the default.
export const REVIEW_WAITERS = ['orchestrator', 'human', 'pr-approval', 'pr-merge'] as const
export type ReviewWaiter = (typeof REVIEW_WAITERS)[number]

export interface ReviewWait {
  readonly on: ReviewWaiter
  // One line, e.g. the PR's number; may be empty.
  readonly note: string
}

// A wait long enough that its worker may be parked.
import type { Key } from '../i18n'

// What a card says it waits on; the default says nothing.
export const REVIEW_WAITER_LABELS: Readonly<Record<ReviewWaiter, Key | null>> = {
  orchestrator: null,
  human: 'task.waitsOnHuman',
  'pr-approval': 'task.waitsOnPrApproval',
  'pr-merge': 'task.waitsOnPrMerge',
}

export const waitsOnPr = (on: ReviewWaiter): boolean => on === 'pr-approval' || on === 'pr-merge'
