import { randomUUID } from 'node:crypto'
import type { Key } from '../i18n'
import { tidyOrchestration } from './orchestration'

export const DEFAULT_PROJECT_NAME = 'Default'
export const GROUP_COLORS = ['#5ec4b6', '#c17be0', '#e0b45b', '#7fb2ff', '#e57c9a'] as const
export const DEFAULT_GROUP_COLOR = GROUP_COLORS[0]

export interface Group {
  readonly name: string
  readonly color: string
  readonly members: readonly string[]
  // Shown as one row in the list, in every window, until expanded.
  readonly collapsed?: true
}

// The orchestration mode's marks (decisions 1.77, 1.78, 1.83, 1.86). Switching the mode off keeps
// them, so switching it on again finds the team as it was.
export interface Orchestration {
  readonly on: boolean
  // One per project.
  readonly orchestrator?: string
  // A free label by session id, e.g. "Fabric expert".
  readonly roles?: Readonly<Record<string, string>>
  // Sessions with the ★: their topics and wakes come first.
  readonly priority?: readonly string[]
  // Sessions the human marked as talking with them directly.
  readonly withYou?: readonly string[]
}

export interface Project {
  readonly id: string
  readonly name: string
  readonly members: readonly string[]
  readonly groups: readonly Group[]
  // Members kept out of the project's list (decision 1.25): still members, so still counted.
  readonly hidden?: readonly string[]
  // The name its files folder took under the Menkar folder, once made (decision 1.51): saved so it
  // never changes behind the user's back.
  readonly filesFolder?: string
  // Its Files section in the sidebar shows the heading alone.
  readonly filesCollapsed?: true
  // A session's earlier conversations (decision 1.63): the sessions its tab left through `/clear` or
  // an in-session `/resume`, by the id that replaced them. Still members, so still counted; listed
  // only in that session's menu.
  readonly earlier?: Readonly<Record<string, readonly string[]>>
  // Who started a session through Menkar, by child id: the session woken when the child
  // waits at a prompt or ends its turn.
  readonly parents?: Readonly<Record<string, string>>
  readonly orchestration?: Orchestration
  // Its Topics section in the sidebar shows the heading alone.
  readonly topicsCollapsed?: true
  // Keys a later version wrote, written back as they came.
  readonly rest: Readonly<Record<string, unknown>>
}

export type Orientation = 'horizontal' | 'vertical'

export type SavedTab =
  | { readonly panes: readonly string[]; readonly orientation: Orientation }
  | { readonly file: string; readonly preview: boolean }

export interface SavedWindow {
  readonly current: string
  readonly tabs: Readonly<Record<string, readonly SavedTab[]>>
  readonly maximized: boolean
}

export interface Projects {
  readonly current: string
  readonly projects: readonly Project[]
  // As the file had them: the start validates each entry when it reopens (layout.ts), and a save
  // writes the live windows instead.
  readonly windows: readonly unknown[]
  readonly rest: Readonly<Record<string, unknown>>
}

export type Result =
  | { readonly ok: true; readonly projects: Projects }
  | { readonly ok: false; readonly refusal: Key }

export function newProjectId(): string {
  return randomUUID().replaceAll('-', '').slice(0, 12)
}

export function freshProjects(newId: () => string = newProjectId): Projects {
  const id = newId()
  return {
    current: id,
    projects: [{ id, name: DEFAULT_PROJECT_NAME, members: [], groups: [], rest: {} }],
    windows: [],
    rest: {},
  }
}

export function projectOf(state: Projects, sessionId: string): Project | undefined {
  return state.projects.find((p) => p.members.includes(sessionId))
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

function nameRefusal(state: Projects, name: string, except?: string): Key | null {
  if (!name.trim()) return 'projects.nameEmpty'
  if (state.projects.some((p) => p.id !== except && sameName(p.name, name)))
    return 'projects.nameTaken'
  return null
}

function update(state: Projects, id: string, change: (p: Project) => Project): Projects {
  return { ...state, projects: state.projects.map((p) => (p.id === id ? change(p) : p)) }
}

const dropEmpty = (groups: readonly Group[]) => groups.filter((g) => g.members.length > 0)

export function leaveGroups(p: Project, sessionId: string): Project {
  return {
    ...p,
    groups: dropEmpty(
      p.groups.map((g) =>
        g.members.includes(sessionId)
          ? { ...g, members: g.members.filter((m) => m !== sessionId) }
          : g,
      ),
    ),
  }
}

// A member leaving its project leaves its group, the project's hidden list and its marks too.
function leave(p: Project, sessionId: string): Project {
  const left = tidyOrchestration(
    leaveGroups({ ...p, members: p.members.filter((m) => m !== sessionId) }, sessionId),
  )
  return p.hidden?.includes(sessionId)
    ? { ...left, hidden: p.hidden.filter((m) => m !== sessionId) }
    : left
}

export function createProject(state: Projects, name: string, id: string = newProjectId()): Result {
  const refusal = nameRefusal(state, name)
  if (refusal) return { ok: false, refusal }
  const created: Project = { id, name: name.trim(), members: [], groups: [], rest: {} }
  return { ok: true, projects: { ...state, current: id, projects: [...state.projects, created] } }
}

// `filesFolder` when its files folder was renamed with it.
export function renameProject(
  state: Projects,
  id: string,
  name: string,
  filesFolder?: string,
): Result {
  const refusal = nameRefusal(state, name, id)
  if (refusal) return { ok: false, refusal }
  return {
    ok: true,
    projects: update(state, id, (p) => ({
      ...p,
      name: name.trim(),
      ...(filesFolder === undefined ? {} : { filesFolder }),
    })),
  }
}

// Its members are released (in no project); which windows switch is the layout's business.
export function deleteProject(state: Projects, id: string): Result {
  if (state.projects.length <= 1) return { ok: false, refusal: 'projects.lastProject' }
  const remaining = state.projects.filter((p) => p.id !== id)
  const first = remaining[0]
  if (!first) return { ok: false, refusal: 'projects.lastProject' }
  return {
    ok: true,
    projects: {
      ...state,
      projects: remaining,
      current: state.current === id ? first.id : state.current,
    },
  }
}

export function setCurrent(state: Projects, id: string): Projects {
  return state.projects.some((p) => p.id === id) ? { ...state, current: id } : state
}

// Joining one project takes the session out of the one that had it, and out of its group there.
export function addMember(state: Projects, projectId: string, sessionId: string): Projects {
  if (projectOf(state, sessionId)?.id === projectId) return state
  return {
    ...state,
    projects: state.projects.map((p) => {
      if (p.id === projectId) return { ...p, members: [...p.members, sessionId] }
      if (!p.members.includes(sessionId)) return p
      return leave(p, sessionId)
    }),
  }
}

export function removeMember(state: Projects, sessionId: string): Projects {
  return {
    ...state,
    projects: state.projects.map((p) => (p.members.includes(sessionId) ? leave(p, sessionId) : p)),
  }
}

// `group` is what the menu showed: a group dropped since then comes back with this session alone,
// its name and color kept. null is "No group".
export function setGroup(
  state: Projects,
  projectId: string,
  sessionId: string,
  group: { readonly name: string; readonly color: string } | null,
): Projects {
  const current = state.projects
    .find((p) => p.id === projectId)
    ?.groups.find((g) => g.members.includes(sessionId))
  // Its own group again: leaving and rejoining would move it last and take its lead.
  if (group && current?.name === group.name) return state
  return update(state, projectId, (p) => {
    const left = leaveGroups(p, sessionId)
    if (!group) return left
    const exists = left.groups.some((g) => g.name === group.name)
    const groups = exists
      ? left.groups.map((g) =>
          g.name === group.name ? { ...g, members: [...g.members, sessionId] } : g,
        )
      : [...left.groups, { name: group.name, color: group.color, members: [sessionId] }]
    return { ...left, groups }
  })
}

export function newGroup(
  state: Projects,
  projectId: string,
  sessionId: string,
  name: string,
): Result {
  const project = state.projects.find((p) => p.id === projectId)
  if (!project) return { ok: false, refusal: 'groups.nameEmpty' }
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, refusal: 'groups.nameEmpty' }
  if (project.groups.some((g) => sameName(g.name, trimmed)))
    return { ok: false, refusal: 'groups.nameTaken' }
  const left = leaveGroups(project, sessionId)
  const color = GROUP_COLORS[left.groups.length % GROUP_COLORS.length] ?? DEFAULT_GROUP_COLOR
  const after: Project = {
    ...left,
    groups: [...left.groups, { name: trimmed, color, members: [sessionId] }],
  }
  return { ok: true, projects: update(state, projectId, () => after) }
}

// A row dragged in the list (2026-11-10): `session` goes right before or after `target`, a row of
// the same group, or both in "No group". The move is relative to a row the user saw, so a hidden
// member not shown between them keeps its place. Anything else changes nothing: a drop never
// changes a group.
export function moveMember(
  state: Projects,
  sessionId: string,
  target: string,
  place: 'before' | 'after',
): Projects {
  const project = projectOf(state, sessionId)
  if (!project || target === sessionId || !project.members.includes(target)) return state
  const groupOf = (id: string) => project.groups.find((g) => g.members.includes(id))
  const group = groupOf(sessionId)
  if (group !== groupOf(target)) return state
  const moved = (list: readonly string[]) => {
    const rest = list.filter((id) => id !== sessionId)
    const at = rest.indexOf(target) + (place === 'after' ? 1 : 0)
    return [...rest.slice(0, at), sessionId, ...rest.slice(at)]
  }
  return update(state, project.id, (p) =>
    group
      ? {
          ...p,
          groups: p.groups.map((g) => (g === group ? { ...g, members: moved(g.members) } : g)),
        }
      : { ...p, members: moved(p.members) },
  )
}

export function setCollapsed(
  state: Projects,
  projectId: string,
  groupName: string,
  collapsed: boolean,
): Projects {
  return update(state, projectId, (p) => ({
    ...p,
    groups: p.groups.map((g) => {
      if (g.name !== groupName) return g
      const { collapsed: _, ...rest } = g
      return collapsed ? { ...rest, collapsed: true } : rest
    }),
  }))
}

export function setFilesFolder(state: Projects, projectId: string, folderName: string): Projects {
  return update(state, projectId, (p) => ({ ...p, filesFolder: folderName }))
}

export function setFilesCollapsed(
  state: Projects,
  projectId: string,
  collapsed: boolean,
): Projects {
  return update(state, projectId, (p) => {
    const { filesCollapsed: _, ...rest } = p
    return collapsed ? { ...rest, filesCollapsed: true } : rest
  })
}

// Hidden in its project's list (decision 1.25): only while it does not run, since a running session
// has a tab and a tab is never without its row. A session in no project has no list to leave.
export function hideMember(state: Projects, sessionId: string, running: boolean): Result {
  if (running) return { ok: false, refusal: 'projects.hideRunning' }
  const project = projectOf(state, sessionId)
  if (!project || project.hidden?.includes(sessionId)) return { ok: true, projects: state }
  return {
    ok: true,
    projects: update(state, project.id, (p) => ({
      ...p,
      hidden: [...(p.hidden ?? []), sessionId],
    })),
  }
}

// Shown again: from its menu, picked in Add session, or started (running implies shown).
export function showMember(state: Projects, sessionId: string): Projects {
  const project = projectOf(state, sessionId)
  if (!project?.hidden?.includes(sessionId)) return state
  return update(state, project.id, (p) => ({
    ...p,
    hidden: (p.hidden ?? []).filter((m) => m !== sessionId),
  }))
}

// A new session joins the project its tab was started in, or `current` if that one is gone.
export function joinTarget(state: Projects, startedIn: string): string {
  return state.projects.some((p) => p.id === startedIn) ? startedIn : state.current
}
