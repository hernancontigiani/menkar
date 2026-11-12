import type { Closable, NotificationTray } from '../agentstate/tray'
import { type Topics, topicsOf } from './topics'

const PREFIX = 'topic:'

export const topicKey = (project: string, number: number): string => `${PREFIX}${project}:${number}`

// The dock counts the tray, so a topic's notice leaves it once nothing could lead the human to
// that topic any more: closed, seen, or its project out of the mode or gone.
export function closeStaleTopicNotices<N extends Closable>(
  tray: NotificationTray<N>,
  topics: Topics,
  on: (projectId: string) => boolean,
): void {
  const live = new Set<string>()
  for (const projectId of Object.keys(topics.projects)) {
    if (!on(projectId)) continue
    for (const x of topicsOf(topics, projectId))
      if (x.status !== 'closed' && !x.seen) live.add(topicKey(projectId, x.number))
  }
  for (const key of tray.keys()) if (key.startsWith(PREFIX) && !live.has(key)) tray.seen(key)
}
