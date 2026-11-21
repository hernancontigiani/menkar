import { forgetSession } from './earlier'
import type { Projects } from './model'
import { followNewId } from './rekey'

// A session started for an agent that picks its own id has none until its first message. Its pane
// holds a provisional id meanwhile, as member, child and assignee, so start_session can place it
// at once; the real id takes its place when it binds.
const PREFIX = 'pending:'

export const provisionalId = (key: string): string => `${PREFIX}${key}`

export const isProvisional = (id: string): boolean => id.startsWith(PREFIX)

// The real id takes the provisional one's place: its spot, group, hidden flag, parent, children
// and marks, and the earlier conversations it took over by name. The provisional id is gone, not
// an earlier conversation: it never was a session. Unchanged when the provisional id is in no
// project, or the real one already is in one.
export function bindProvisional(state: Projects, from: string, to: string): Projects {
  const followed = followNewId(state, from, to)
  return followed === state ? state : forgetSession(followed, from)
}

// Menkar stopped before a provisional id bound: nothing can bind it any more, so it leaves every
// project. The session, if its agent made one, is in the agent's data and can be added again.
export function dropProvisional(state: Projects): { projects: Projects; dropped: string[] } {
  const dropped = [...new Set(state.projects.flatMap((p) => p.members.filter(isProvisional)))]
  return { projects: dropped.reduce(forgetSession, state), dropped }
}
