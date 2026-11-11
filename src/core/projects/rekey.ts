import type { Layout } from './layout'
import { addMember, type Group, type Project, type Projects, projectOf, showMember } from './model'

// Claude Code gives a running session a new id when the user clears it (`/clear`, decision 1.56). The new id
// takes the old one's place: its spot among the project's members, its group and the group's
// leader mark, and its hidden flag. The old id stays a member, right after it and outside any
// group, as a stopped session of the same project.

const swap = (ids: readonly string[], from: string, to: string) =>
  ids.map((id) => (id === from ? to : id))

function followInGroup(g: Group, from: string, to: string): Group {
  if (!g.members.includes(from)) return g
  const members = swap(g.members, from, to)
  return g.leader === from ? { ...g, members, leader: to } : { ...g, members }
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
    projects: state.projects.map((p) => (p.id === project.id ? followInProject(p, from, to) : p)),
  }
}

// An in-session resume (decision 1.57) picks another session: it joins the tab's project, out of
// any other one and its group there, and shows, since it runs. The session it left stays where it
// was, stopped.
export function followResume(state: Projects, projectId: string, to: string): Projects {
  return showMember(addMember(state, projectId, to), to)
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
