import type { Project, Projects } from './model'

// A session started by another records its starter: Menkar wakes the
// parent when the child needs it. Both are members of one project, so the map lives there.

export type Parents = Readonly<Record<string, string>>

// What holds, whatever changed the members since: child and parent are both members, and differ.
export function keptParents(p: Project): Parents {
  const members = new Set(p.members)
  const kept: Record<string, string> = {}
  for (const [child, parent] of Object.entries(p.parents ?? {}))
    if (child !== parent && members.has(child) && members.has(parent)) kept[child] = parent
  return kept
}

const withParents = (p: Project, parents: Parents): Project => {
  const { parents: _, ...rest } = p
  return Object.keys(parents).length > 0 ? { ...rest, parents } : rest
}

export const tidyParents = (p: Project): Project => withParents(p, keptParents(p))

export function setParent(state: Projects, child: string, parent: string): Projects {
  return {
    ...state,
    projects: state.projects.map((p) =>
      p.members.includes(child) && p.members.includes(parent) && child !== parent
        ? withParents(p, { ...keptParents(p), [child]: parent })
        : p,
    ),
  }
}

// A session that took a new id in its tab keeps its parent and its children.
export function followParents(p: Project, from: string, to: string): Project {
  if (!p.parents) return p
  const moved: Record<string, string> = {}
  for (const [child, parent] of Object.entries(p.parents))
    moved[child === from ? to : child] = parent === from ? to : parent
  return tidyParents({ ...p, parents: moved })
}

// Taken back from the orchestrator: the session no longer wakes anyone.
export function clearParent(state: Projects, child: string): Projects {
  return {
    ...state,
    projects: state.projects.map((p) => {
      const { [child]: _, ...rest } = keptParents(p)
      return p.members.includes(child) ? withParents(p, rest) : p
    }),
  }
}
