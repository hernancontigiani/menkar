import { localIso, now } from '../core/clock'
import { log } from '../core/log'
import { emptyTopics, loadTopics, saveTopics, type Topics } from '../core/orchestration/topics'
import { addNotice } from './projects'

let topics: Topics = emptyTopics()

export async function startTopics(): Promise<void> {
  const loaded = await loadTopics()
  topics = loaded.topics
  if (loaded.movedTo !== null)
    addNotice({ key: 'topics.fileUnreadable', params: { name: loaded.movedTo } })
}

export function currentTopics(): Topics {
  return topics
}

export function topicsNow(): string {
  return localIso(now())
}

// Kept at once, written in the background: a failed write is logged and the next one retries.
export function setTopics(next: Topics): void {
  topics = next
  saveTopics(next).catch((error: unknown) => log.error('topics could not be saved', { error }))
}
