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
