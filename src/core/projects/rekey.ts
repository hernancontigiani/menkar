import { becomeEarlier, keptEarlier, releaseEarlier, tidyEarlier } from './earlier'
import type { Layout } from './layout'
import {
  addMember,
  type Group,
  leaveGroups,
  type Project,
  type Projects,
  projectOf,
  removeMember,
  showMember,
} from './model'
import { followOrchestration } from './orchestration'
import { followParents, keptParents, tidyParents } from './parents'

// Claude Code gives a running session a new id when the user clears it (`/clear`, decision 1.56),
// and another when the user resumes a session inside it (1.57). The id the tab moves to takes the
// old one's place: its spot among the project's members, its group, its hidden flag and its
// orchestration marks. The old id stays a member, right after it and outside any group, as one of
// the new session's earlier conversations (1.63): in no list, in that session's menu.

const swap = (ids: readonly string[], from: string, to: string) =>
  ids.map((id) => (id === from ? to : id))

function followInGroup(g: Group, from: string, to: string): Group {
  return g.members.includes(from) ? { ...g, members: swap(g.members, from, to) } : g
}

function followInProject(p: Project, from: string, to: string): Project {
  const at = p.members.indexOf(from)
  const members = [...p.members.slice(0, at), to, from, ...p.members.slice(at + 1)]
  const followed: Project = {
    ...p,
    members,
    groups: p.groups.map((g) => followInGroup(g, from, to)),
  }
  return p.hidden?.includes(from) ? { ...followed, hidden: swap(p.hidden, from, to) } : followed
}

// Unchanged when the old id is in no project, or when the new one already is in one: a session
// belongs to one project at most, and the new id's own membership is the user's to change.
export function followNewId(state: Projects, from: string, to: string): Projects {
  const project = projectOf(state, from)
  if (from === to || !project || projectOf(state, to)) return state
  return {
    ...state,
    projects: state.projects.map((p) =>
      p.id === project.id
        ? followOrchestration(
            followParents(becomeEarlier(followInProject(p, from, to), from, to), from, to),
            from,
            to,
          )
        : p,
    ),
  }
}

// An in-session resume picks a session that may be anywhere: in another project (and a group
// there), in this one, or an earlier conversation itself. It leaves wherever it was and takes the
// old one's place in the tab's project, bringing its own earlier conversations along, since a
// session is in one project at most.
export function followResume(
  state: Projects,
  from: string,
  to: string,
  projectId: string,
): Projects {
  if (from === to) return state
  const released = releaseEarlier(state, to)
  const owner = projectOf(released, to)
  const carried = owner ? (keptEarlier(owner)[to] ?? []) : []
  const removed = [to, ...carried].reduce(removeMember, released)
  const out = { ...removed, projects: removed.projects.map(tidyEarlier) }
  const project = projectOf(out, from)
  if (!project) return showMember(addMember(state, projectId, to), to)
  return {
    ...out,
    projects: out.projects.map((p) => {
      if (p.id !== project.id) return p
      const placed = followInProject(p, from, to)
      const at = placed.members.indexOf(from) + 1
      const members = [...placed.members.slice(0, at), ...carried, ...placed.members.slice(at)]
      const withCarried: Project = {
        ...placed,
        members,
        earlier: { ...keptEarlier(placed), ...(carried.length > 0 ? { [to]: carried } : {}) },
      }
      return followOrchestration(becomeEarlier(withCarried, from, to), from, to)
    }),
  }
}

// One more stopped session goes after the ones `to` already holds, with its own earlier ones; its
// group is left and its children wake `to`.
function joinEarlier(p: Project, from: string, to: string): Project {
  const kept = keptEarlier(p)
  const list = [...(kept[to] ?? []), from, ...(kept[from] ?? [])].filter(
    (id, i, all) => id !== to && all.indexOf(id) === i,
  )
  const { [from]: _from, [to]: _to, ...others } = kept
  const parents = Object.fromEntries(
    Object.entries(keptParents(p)).map(([child, parent]) => [child, parent === from ? to : parent]),
  )
  return tidyParents({ ...leaveGroups(p, from), earlier: { ...others, [to]: list }, parents })
}

// A new id, in no project yet, started with the name of stopped sessions (most recently active
// first): it follows them as after a renew. The first gives its place, group, hidden flag, parent,
// children and marks; the others join its earlier conversations after it.
export function takeOverName(state: Projects, stopped: readonly string[], to: string): Projects {
  const [first, ...rest] = stopped
  if (first === undefined) return state
  const followed = followNewId(state, first, to)
  if (followed === state) return state
  return {
    ...followed,
    projects: followed.projects.map((p) =>
      p.members.includes(to) ? rest.reduce((q, from) => joinEarlier(q, from, to), p) : p,
    ),
  }
}

// The tab that ran the old id runs the new one, in the same pane.
export function followNewIdInLayout(layout: Layout, from: string, to: string): Layout {
  if (from === to) return layout
  return {
    windows: layout.windows.map((w) => ({
      ...w,
      tabs: w.tabs.map((t) =>
        t.kind === 'session' && t.panes.includes(from)
          ? { ...t, panes: swap(t.panes, from, to) }
          : t,
      ),
    })),
  }
}
