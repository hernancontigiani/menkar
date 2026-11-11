import type { Project, Projects } from './model'

export type Earlier = Readonly<Record<string, readonly string[]>>

// What holds of a project's earlier conversations, whatever changed its members since: a key and
// every id in a list are members, an id is in one list at most and never a key, and no list is
// empty. Anything else is dropped, so the session shows as an ordinary row again.
export function keptEarlier(p: Project): Earlier {
  const members = new Set(p.members)
  const entries = Object.entries(p.earlier ?? {}).filter(([key]) => members.has(key))
  const keys = new Set(entries.map(([key]) => key))
  const seen = new Set<string>()
  const kept: Record<string, string[]> = {}
  for (const [key, ids] of entries) {
    const list = ids.filter((id) => members.has(id) && !keys.has(id) && !seen.has(id))
    for (const id of list) seen.add(id)
    if (list.length > 0) kept[key] = list
  }
  return kept
}

// Every earlier conversation of the project, under whichever session.
export function earlierIds(p: Project): Set<string> {
  return new Set(Object.values(keptEarlier(p)).flat())
}

const withEarlier = (p: Project, earlier: Earlier): Project => {
  const { earlier: _, ...rest } = p
  return Object.keys(earlier).length > 0 ? { ...rest, earlier } : rest
}

// The project with only what still holds of its earlier conversations.
export const tidyEarlier = (p: Project): Project => withEarlier(p, keptEarlier(p))

// Opened or picked again: an ordinary session of the list, in no session's earlier conversations.
export function releaseEarlier(state: Projects, sessionId: string): Projects {
  if (!state.projects.some((p) => earlierIds(p).has(sessionId))) return state
  return {
    ...state,
    projects: state.projects.map((p) => {
      const kept = keptEarlier(p)
      const left: Record<string, readonly string[]> = {}
      for (const [key, ids] of Object.entries(kept)) {
        const list = ids.filter((id) => id !== sessionId)
        if (list.length > 0) left[key] = list
      }
      return earlierIds(p).has(sessionId) ? withEarlier(p, left) : p
    }),
  }
}

// `from` became an earlier conversation of `to`, a member of the same project: it goes first in
// `to`'s list, and the ones it had come after it (a chain of clears lists every one).
export function becomeEarlier(p: Project, from: string, to: string): Project {
  const kept = keptEarlier(p)
  const moved = [from, ...(kept[from] ?? []), ...(kept[to] ?? [])].filter(
    (id, i, all) => id !== to && all.indexOf(id) === i,
  )
  const { [from]: _from, [to]: _to, ...others } = kept
  return withEarlier(p, { ...others, [to]: moved })
}
