import { basename, join } from 'node:path'
import { readJsonReport, UnreadableShape, writeJson } from '../jsonstate'
import { appDirs } from '../paths'
import {
  DEFAULT_GROUP_COLOR,
  freshProjects,
  type Group,
  type Project,
  type Projects,
  type SavedWindow,
} from './model'

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
    const { id, name, members, groups, hidden, ...projectRest } = raw
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
        return {
          name: g.name,
          color,
          members: strings(g.members, 'group members').filter((m) => memberSet.has(m)),
        }
      })
      .filter((g) => g.members.length > 0)
    // Lenient, unlike members: a list this version cannot read only shows every member again.
    const keptHidden = Array.isArray(hidden)
      ? [...new Set(hidden.filter((h): h is string => typeof h === 'string' && memberSet.has(h)))]
      : []
    return {
      id,
      name,
      members: unique,
      groups: parsedGroups,
      ...(keptHidden.length > 0 ? { hidden: keptHidden } : {}),
      rest: projectRest,
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
// keys, then id, name, members, groups, and hidden when any. A group keeps only its three keys.
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
      groups: p.groups.map((g) => ({ name: g.name, color: g.color, members: g.members })),
      ...(p.hidden && p.hidden.length > 0 ? { hidden: p.hidden } : {}),
    })),
    windows,
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
