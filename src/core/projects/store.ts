import { basename, join } from 'node:path'
import { readJsonReport, UnreadableShape, writeJson } from '../jsonstate'
import { appDirs } from '../paths'
import { keptEarlier } from './earlier'
import {
  DEFAULT_GROUP_COLOR,
  freshProjects,
  type Group,
  type Project,
  type Projects,
  type SavedWindow,
} from './model'
import { parseOrchestration, serializeOrchestration } from './orchestration'
import { keptParents } from './parents'

export const PROJECTS_VERSION = 1

export function projectsPath(): string {
  return join(appDirs().config, 'projects.json')
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function unreadable(why: string): never {
  throw new UnreadableShape(why)
}

function strings(value: unknown, what: string): string[] {
  if (!Array.isArray(value) || !value.every((x) => typeof x === 'string'))
    unreadable(`${what} is not a list of strings`)
  return value
}

// A session id → earlier ids map, read as far as it is one.
function earlierLists(value: unknown): Record<string, string[]> {
  if (!isObject(value)) return {}
  const lists: Record<string, string[]> = {}
  for (const [key, ids] of Object.entries(value))
    if (Array.isArray(ids)) lists[key] = ids.filter((id): id is string => typeof id === 'string')
  return lists
}

// A child id → parent id map, read as far as it is one.
function parentMap(value: unknown): Record<string, string> {
  if (!isObject(value)) return {}
  const map: Record<string, string> = {}
  for (const [child, parent] of Object.entries(value))
    if (typeof parent === 'string') map[child] = parent
  return map
}

// Version 1, read strictly: a shape it cannot hold makes the whole file unreadable (moved aside),
// while what can be repaired is repaired (a session kept in its first project, group members that
// are not the project's dropped, a missing color).
export function parseProjects(value: unknown): Projects {
  if (!isObject(value)) unreadable('not an object')
  const { version, current, projects, windows, ...rest } = value
  if (version !== PROJECTS_VERSION) unreadable('not version 1')
  if (!Array.isArray(projects) || projects.length === 0) unreadable('no projects')
  const seen = new Set<string>()
  const parsed: Project[] = projects.map((raw) => {
    if (!isObject(raw)) unreadable('a project is not an object')
    const {
      id,
      name,
      members,
      groups,
      hidden,
      files_folder,
      files_collapsed,
      earlier,
      parents,
      orchestration,
      topics_collapsed,
      team_view,
      consultants_collapsed,
      done_today_open,
      ...projectRest
    } = raw
    if (typeof id !== 'string') unreadable('a project id is not a string')
    if (typeof name !== 'string') unreadable('a project name is not a string')
    const own = (members === undefined ? [] : strings(members, 'members')).filter(
      (m) => !seen.has(m),
    )
    const unique = [...new Set(own)]
    for (const m of unique) seen.add(m)
    const memberSet = new Set(unique)
    const rawGroups = groups === undefined || groups === null ? [] : groups
    if (!Array.isArray(rawGroups)) unreadable('groups is not a list')
    const parsedGroups: Group[] = rawGroups
      .map((g): Group => {
        if (!isObject(g) || typeof g.name !== 'string') unreadable('a group has no name')
        const color =
          g.color === undefined || g.color === null || g.color === ''
            ? DEFAULT_GROUP_COLOR
            : String(g.color)
        // A group's other keys (a `leader` an earlier version wrote, say) are not read.
        return {
          name: g.name,
          color,
          members: strings(g.members, 'group members').filter((m) => memberSet.has(m)),
          ...(g.collapsed === true ? { collapsed: true as const } : {}),
        }
      })
      .filter((g) => g.members.length > 0)
    // Lenient, unlike members: a list this version cannot read only shows every member again.
    const keptHidden = Array.isArray(hidden)
      ? [...new Set(hidden.filter((h): h is string => typeof h === 'string' && memberSet.has(h)))]
      : []
    const read: Project = {
      id,
      name,
      members: unique,
      groups: parsedGroups,
      ...(keptHidden.length > 0 ? { hidden: keptHidden } : {}),
      ...(typeof files_folder === 'string' && files_folder !== ''
        ? { filesFolder: files_folder }
        : {}),
      ...(files_collapsed === true ? { filesCollapsed: true as const } : {}),
      rest: projectRest,
    }
    // Lenient too: a list this version cannot read only lists those sessions again.
    const earlierKept = keptEarlier({ ...read, earlier: earlierLists(earlier) })
    const withEarlier =
      Object.keys(earlierKept).length > 0 ? { ...read, earlier: earlierKept } : read
    const parentsKept = keptParents({ ...read, parents: parentMap(parents) })
    const withParents =
      Object.keys(parentsKept).length > 0 ? { ...withEarlier, parents: parentsKept } : withEarlier
    const marks = parseOrchestration(orchestration, unique)
    return {
      ...withParents,
      ...(marks ? { orchestration: marks } : {}),
      ...(topics_collapsed === true ? { topicsCollapsed: true as const } : {}),
      ...(team_view === true ? { teamView: true as const } : {}),
      ...(consultants_collapsed === true ? { consultantsCollapsed: true as const } : {}),
      ...(done_today_open === true ? { doneTodayOpen: true as const } : {}),
    }
  })
  const first = parsed[0]
  if (!first) unreadable('no projects')
  const currentId =
    typeof current === 'string' && parsed.some((p) => p.id === current) ? current : first.id
  return {
    current: currentId,
    projects: parsed,
    windows: Array.isArray(windows) ? windows : [],
    rest,
  }
}

// Key order: unknown top-level keys, version, current, projects, windows; in a project its unknown
// keys, then id, name, members, groups, and hidden, the files keys, earlier, parents, orchestration
// and topics_collapsed, team_view, consultants_collapsed and done_today_open when any. A group writes name, color, members,
// then collapsed only when set; a group's unknown keys are not kept.
export function serializeProjects(
  state: Projects,
  windows: readonly SavedWindow[] = [],
): Record<string, unknown> {
  return {
    ...state.rest,
    version: PROJECTS_VERSION,
    current: state.current,
    projects: state.projects.map((p) => ({
      ...p.rest,
      id: p.id,
      name: p.name,
      members: p.members,
      groups: p.groups.map((g) => ({
        name: g.name,
        color: g.color,
        members: g.members,
        ...(g.collapsed ? { collapsed: true } : {}),
      })),
      ...(p.hidden && p.hidden.length > 0 ? { hidden: p.hidden } : {}),
      ...(p.filesFolder ? { files_folder: p.filesFolder } : {}),
      ...(p.filesCollapsed ? { files_collapsed: true } : {}),
      ...(Object.keys(keptEarlier(p)).length > 0 ? { earlier: keptEarlier(p) } : {}),
      ...(Object.keys(keptParents(p)).length > 0 ? { parents: keptParents(p) } : {}),
      ...orchestrationKeys(p),
    })),
    windows,
  }
}

function orchestrationKeys(p: Project): Record<string, unknown> {
  const marks = serializeOrchestration(p)
  return {
    ...(marks ? { orchestration: marks } : {}),
    ...(p.topicsCollapsed ? { topics_collapsed: true } : {}),
    ...(p.teamView ? { team_view: true } : {}),
    ...(p.consultantsCollapsed ? { consultants_collapsed: true } : {}),
    ...(p.doneTodayOpen ? { done_today_open: true } : {}),
  }
}

export interface LoadedProjects {
  readonly projects: Projects
  // The name an unreadable file was kept as, for the toast; null when it was read or absent.
  readonly movedTo: string | null
}

export async function loadProjects(newId?: () => string): Promise<LoadedProjects> {
  const report = await readJsonReport(projectsPath(), parseProjects, () => freshProjects(newId))
  return {
    projects: report.value,
    movedTo: report.movedTo === null ? null : basename(report.movedTo),
  }
}

export function saveProjects(state: Projects, windows: readonly SavedWindow[]): Promise<void> {
  return writeJson(projectsPath(), serializeProjects(state, windows))
}
