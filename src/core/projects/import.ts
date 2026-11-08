import { access, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { Key } from '../i18n'
import { log } from '../log'
import { agentPaths } from '../paths'
import { parseState, saveState, statePath } from '../state'
import {
  DEFAULT_GROUP_COLOR,
  freshProjects,
  type Group,
  newProjectId,
  type Project,
  type Projects,
} from './model'
import { projectsPath, saveProjects } from './store'

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export interface ImportResult {
  readonly firstStart: boolean
  // Notices for the user (keys of `t()`), shown until dismissed.
  readonly notices: readonly Key[]
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return false
      throw error
    },
  )
}

// agent-tablet's files are opened for reading only: never written, renamed or moved aside, even
// when unreadable. undefined when the file is missing; 'unreadable' when it is not JSON.
async function readSource(path: string): Promise<unknown> {
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
  try {
    return JSON.parse(text)
  } catch (error) {
    if (error instanceof SyntaxError) return UNREADABLE
    throw error
  }
}

const UNREADABLE = Symbol('unreadable')

// Lenient where Menkar's own reading is strict: the good entries are kept and the rest dropped.
export function importProjects(
  value: unknown,
  newId: () => string,
): { projects: Projects | null; dropped: number } {
  if (!isObject(value) || value.version !== 1 || !Array.isArray(value.projects))
    return { projects: null, dropped: 0 }
  let dropped = 0
  const ids = new Set<string>()
  const taken = new Set<string>()
  const projects: Project[] = []
  for (const raw of value.projects) {
    if (
      !isObject(raw) ||
      typeof raw.id !== 'string' ||
      typeof raw.name !== 'string' ||
      ids.has(raw.id)
    ) {
      dropped += 1
      continue
    }
    ids.add(raw.id)
    const members: string[] = []
    for (const m of Array.isArray(raw.members) ? raw.members : []) {
      if (typeof m !== 'string') dropped += 1
      else if (!taken.has(m)) {
        taken.add(m)
        members.push(m)
      }
    }
    const memberSet = new Set(members)
    const grouped = new Set<string>()
    const groups: Group[] = []
    for (const g of Array.isArray(raw.groups) ? raw.groups : []) {
      if (!isObject(g) || typeof g.name !== 'string') {
        dropped += 1
        continue
      }
      const kept = (Array.isArray(g.members) ? g.members : []).filter(
        (m): m is string => typeof m === 'string' && memberSet.has(m) && !grouped.has(m),
      )
      for (const m of kept) grouped.add(m)
      if (kept.length === 0) {
        dropped += 1
        continue
      }
      groups.push({
        name: g.name,
        color: typeof g.color === 'string' ? g.color : DEFAULT_GROUP_COLOR,
        members: kept,
      })
    }
    projects.push({ id: raw.id, name: raw.name, members, groups, rest: {} })
  }
  const first = projects[0]
  if (!first) return { projects: freshProjects(newId), dropped }
  const current =
    typeof value.current === 'string' && ids.has(value.current) ? value.current : first.id
  return { projects: { current, projects, windows: [], rest: {} }, dropped }
}

type Check = (value: unknown) => boolean
const isInt: Check = (v) => Number.isInteger(v)
const isString: Check = (v) => typeof v === 'string'
const isBool: Check = (v) => typeof v === 'boolean'
const oneOf =
  (...values: string[]): Check =>
  (v) =>
    typeof v === 'string' && values.includes(v)

const SETTINGS: Readonly<Record<string, Check>> = {
  font: isString,
  scrollback: isInt,
  color_scheme: oneOf('system', 'light', 'dark'),
  terminal_theme: isString,
  ui_style: oneOf('tui', 'classic'),
  language: isString,
  notify_idle: isBool,
  notify_sound: isBool,
  new_session_dir: isString,
  sidebar_width: isInt,
  reopen_tabs: isBool,
  show_folder_path: isBool,
  classify_since: (v) => v === null || typeof v === 'number',
  classify_last: (v) =>
    isObject(v) &&
    typeof v.at === 'number' &&
    Number.isInteger(v.classified) &&
    typeof v.failed === 'boolean',
}

const idList = (value: unknown): string[] =>
  Array.isArray(value)
    ? [...new Set(value.filter((x): x is string => typeof x === 'string'))].sort()
    : []

// The keys of Menkar's own state.json, from agent-tablet's: the same meaning, the same names.
export function importState(value: unknown): Record<string, unknown> | null {
  if (!isObject(value)) return null
  const names: Record<string, string> = {}
  if (isObject(value.names)) {
    for (const [id, name] of Object.entries(value.names)) {
      if (id && typeof name === 'string' && name.trim()) names[id] = name.trim()
    }
  }
  const out: Record<string, unknown> = { names, hidden: idList(value.hidden) }
  const remote = idList(value.remote_control)
  if (remote.length > 0) out.remote_control = remote
  const settings: Record<string, unknown> = {}
  if (isObject(value.settings)) {
    for (const [key, check] of Object.entries(SETTINGS)) {
      if (key in value.settings && check(value.settings[key])) settings[key] = value.settings[key]
    }
  }
  if (Object.keys(settings).length > 0) out.settings = settings
  return out
}

// A first start is one where Menkar's config directory has neither state.json nor projects.json.
// It reads agent-tablet's two files (Linux only: it never ran elsewhere) and writes both of
// Menkar's, even when nothing was imported, so the next start is not a first start. If writing
// fails, neither file is left, and the next start is a first start again.
export async function firstStartImport(newId: () => string = newProjectId): Promise<ImportResult> {
  if ((await exists(statePath())) || (await exists(projectsPath())))
    return { firstStart: false, notices: [] }
  const notices: Key[] = []
  const source = agentPaths().agentTabletConfig
  const linux = process.platform === 'linux'
  const rawProjects = linux ? await readSource(join(source, 'projects.json')) : undefined
  const rawState = linux ? await readSource(join(source, 'state.json')) : undefined

  let projects = freshProjects(newId)
  if (rawProjects !== undefined) {
    const imported =
      rawProjects === UNREADABLE
        ? { projects: null, dropped: 0 }
        : importProjects(rawProjects, newId)
    if (imported.projects) projects = imported.projects
    else {
      notices.push('import.projectsUnreadable')
      log.warn("agent-tablet's projects.json could not be read; not imported", {
        path: join(source, 'projects.json'),
      })
    }
    if (imported.dropped > 0)
      log.warn("entries of agent-tablet's projects.json were dropped", {
        dropped: imported.dropped,
      })
  }

  let state = parseState({})
  if (rawState !== undefined) {
    const imported = rawState === UNREADABLE ? null : importState(rawState)
    if (imported) state = parseState(imported)
    else {
      notices.push('import.stateUnreadable')
      log.warn("agent-tablet's state.json could not be read; not imported", {
        path: join(source, 'state.json'),
      })
    }
  }

  try {
    await saveState(state)
    try {
      await saveProjects(projects, [])
    } catch (error) {
      await rm(statePath(), { force: true })
      throw error
    }
  } catch (error) {
    log.error("Menkar's state could not be written on the first start; it will be tried again", {
      error,
    })
  }
  return { firstStart: true, notices }
}
