import { randomUUID } from 'node:crypto'
import type { Key } from '../i18n'

export const DEFAULT_PROJECT_NAME = 'Default'
export const GROUP_COLORS = ['#5ec4b6', '#c17be0', '#e0b45b', '#7fb2ff', '#e57c9a'] as const
export const DEFAULT_GROUP_COLOR = GROUP_COLORS[0]

export interface Group {
  readonly name: string
  readonly color: string
  readonly members: readonly string[]
}

export interface Project {
  readonly id: string
  readonly name: string
  readonly members: readonly string[]
  readonly groups: readonly Group[]
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

function leaveGroups(p: Project, sessionId: string): Project {
  return {
    ...p,
    groups: dropEmpty(
      p.groups.map((g) => ({ ...g, members: g.members.filter((m) => m !== sessionId) })),
    ),
  }
}

export function createProject(state: Projects, name: string, id: string = newProjectId()): Result {
  const refusal = nameRefusal(state, name)
  if (refusal) return { ok: false, refusal }
  const created: Project = { id, name: name.trim(), members: [], groups: [], rest: {} }
  return { ok: true, projects: { ...state, current: id, projects: [...state.projects, created] } }
}

export function renameProject(state: Projects, id: string, name: string): Result {
  const refusal = nameRefusal(state, name, id)
  if (refusal) return { ok: false, refusal }
  return { ok: true, projects: update(state, id, (p) => ({ ...p, name: name.trim() })) }
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
      return leaveGroups({ ...p, members: p.members.filter((m) => m !== sessionId) }, sessionId)
    }),
  }
}

export function removeMember(state: Projects, sessionId: string): Projects {
  return {
    ...state,
    projects: state.projects.map((p) =>
      p.members.includes(sessionId)
        ? leaveGroups({ ...p, members: p.members.filter((m) => m !== sessionId) }, sessionId)
        : p,
    ),
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

// A new session joins the project its tab was started in, or `current` if that one is gone.
export function joinTarget(state: Projects, startedIn: string): string {
  return state.projects.some((p) => p.id === startedIn) ? startedIn : state.current
}
