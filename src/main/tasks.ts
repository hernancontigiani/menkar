import { log } from '../core/log'
import { emptyTasks, loadTasks, saveTasks, type Tasks } from '../core/orchestration/tasks'
import { addNotice } from './projects'

let tasks: Tasks = emptyTasks()

export async function startTasks(): Promise<void> {
  const loaded = await loadTasks()
  tasks = loaded.tasks
  if (loaded.movedTo !== null)
    addNotice({ key: 'tasks.fileUnreadable', params: { name: loaded.movedTo } })
}

export function currentTasks(): Tasks {
  return tasks
}

// Kept at once, written in the background: a failed write is logged and the next one retries.
export function setTasks(next: Tasks): void {
  tasks = next
  saveTasks(next).catch((error: unknown) => log.error('tasks could not be saved', { error }))
}
