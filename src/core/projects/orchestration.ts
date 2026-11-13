import type { ProjectInfo } from './info'
import type { Orchestration, Project, Projects } from './model'

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const ids = (value: unknown, members: ReadonlySet<string>): string[] =>
  Array.isArray(value)
    ? [...new Set(value.filter((x): x is string => typeof x === 'string' && members.has(x)))]
    : []

// Only what is set, so an untouched project writes nothing and an empty one reads as absent.
function compact(o: Orchestration): Orchestration | undefined {
  const roles = o.roles && Object.keys(o.roles).length > 0 ? o.roles : undefined
  const withYou = o.withYou && o.withYou.length > 0 ? o.withYou : undefined
  const parked = o.parked && o.parked.length > 0 ? o.parked : undefined
  const cap = o.workersCap
  if (!o.on && !o.orchestrator && !roles && !withYou && !parked && cap === undefined)
    return undefined
  return {
    on: o.on,
    ...(o.orchestrator ? { orchestrator: o.orchestrator } : {}),
    ...(roles ? { roles } : {}),
    ...(withYou ? { withYou } : {}),
    ...(parked ? { parked } : {}),
    ...(cap !== undefined ? { workersCap: cap } : {}),
  }
}

// What holds of a project's marks, whatever changed its members since: every id is a member.
export function keptOrchestration(
  o: Orchestration | undefined,
  members: readonly string[],
): Orchestration | undefined {
  if (!o) return undefined
  const set = new Set(members)
  const roles: Record<string, string> = {}
  for (const [id, label] of Object.entries(o.roles ?? {})) if (set.has(id)) roles[id] = label
  return compact({
    on: o.on,
    ...(o.orchestrator && set.has(o.orchestrator) ? { orchestrator: o.orchestrator } : {}),
    roles,
    withYou: ids(o.withYou, set),
    parked: ids(o.parked, set),
    ...(o.workersCap !== undefined ? { workersCap: o.workersCap } : {}),
  })
}

export const isCap = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1

// The file's `orchestration`, read leniently: a key of the wrong type is dropped alone. A
// `priority` an earlier Menkar wrote is dropped: the ★ belongs to tasks now.
export function parseOrchestration(
  value: unknown,
  members: readonly string[],
): Orchestration | undefined {
  if (!isObject(value)) return undefined
  const roles: Record<string, string> = {}
  if (isObject(value.roles))
    for (const [id, label] of Object.entries(value.roles))
      if (typeof label === 'string' && label.trim() !== '') roles[id] = label
  return keptOrchestration(
    {
      on: value.on === true,
      ...(typeof value.orchestrator === 'string' ? { orchestrator: value.orchestrator } : {}),
      roles,
      withYou: ids(value.with_you, new Set(members)),
      parked: ids(value.parked, new Set(members)),
      ...(isCap(value.workers_cap) ? { workersCap: value.workers_cap } : {}),
    },
    members,
  )
}

export function serializeOrchestration(p: Project): Record<string, unknown> | undefined {
  const o = keptOrchestration(p.orchestration, p.members)
  if (!o) return undefined
  return {
    on: o.on,
    ...(o.orchestrator ? { orchestrator: o.orchestrator } : {}),
    ...(o.roles ? { roles: o.roles } : {}),
    ...(o.withYou ? { with_you: o.withYou } : {}),
    ...(o.parked ? { parked: o.parked } : {}),
    ...(o.workersCap !== undefined ? { workers_cap: o.workersCap } : {}),
  }
}

export function withOrchestration(p: Project, o: Orchestration | undefined): Project {
  const { orchestration: _, ...rest } = p
  const kept = keptOrchestration(o, p.members)
  return kept ? { ...rest, orchestration: kept } : rest
}

// The project with only the marks that still name members.
export const tidyOrchestration = (p: Project): Project => withOrchestration(p, p.orchestration)

// A session that took a new id in its tab takes the old one's marks; the old id keeps none.
export function followOrchestration(p: Project, from: string, to: string): Project {
  const o = p.orchestration
  if (!o) return p
  const swap = (list: readonly string[] | undefined) =>
    list?.includes(from) ? [...new Set(list.map((id) => (id === from ? to : id)))] : list
  const { [from]: fromRole, ...others } = o.roles ?? {}
  const roles = fromRole === undefined ? others : { ...others, [to]: fromRole }
  const { roles: _roles, withYou: _withYou, parked: _parked, ...base } = o
  const withYou = swap(o.withYou)
  const parked = swap(o.parked)
  return withOrchestration(p, {
    ...base,
    ...(o.orchestrator === from ? { orchestrator: to } : {}),
    roles,
    ...(withYou ? { withYou } : {}),
    ...(parked ? { parked } : {}),
  })
}

function change(
  state: Projects,
  projectId: string,
  edit: (o: Orchestration) => Orchestration,
): Projects {
  return {
    ...state,
    projects: state.projects.map((p) =>
      p.id === projectId ? withOrchestration(p, edit(p.orchestration ?? { on: false })) : p,
    ),
  }
}

const toggled = (list: readonly string[] | undefined, id: string, on: boolean) => {
  const rest = (list ?? []).filter((x) => x !== id)
  return on ? [...rest, id] : rest
}

export function setMode(state: Projects, projectId: string, on: boolean): Projects {
  return change(state, projectId, (o) => ({ ...o, on }))
}

// One orchestrator per project (decision 1.77): marking one unmarks the previous; null unmarks.
export function setOrchestrator(
  state: Projects,
  projectId: string,
  sessionId: string | null,
): Projects {
  return change(state, projectId, (o) => {
    const { orchestrator: _, ...rest } = o
    return sessionId ? { ...rest, orchestrator: sessionId } : rest
  })
}

// A free label (decision 1.83); an empty one removes it.
export function setRole(
  state: Projects,
  projectId: string,
  sessionId: string,
  label: string,
): Projects {
  return change(state, projectId, (o) => {
    const { [sessionId]: _, ...roles } = o.roles ?? {}
    const trimmed = label.trim()
    return { ...o, roles: trimmed ? { ...roles, [sessionId]: trimmed } : roles }
  })
}

export function setWithYou(
  state: Projects,
  projectId: string,
  sessionId: string,
  on: boolean,
): Projects {
  return change(state, projectId, (o) => ({ ...o, withYou: toggled(o.withYou, sessionId, on) }))
}

export function setParked(
  state: Projects,
  projectId: string,
  sessionId: string,
  on: boolean,
): Projects {
  return change(state, projectId, (o) => ({ ...o, parked: toggled(o.parked, sessionId, on) }))
}

// null, or anything but a whole number from 1, is unlimited.
export function setWorkersCap(state: Projects, projectId: string, cap: number | null): Projects {
  return change(state, projectId, (o) => {
    const { workersCap: _, ...rest } = o
    return isCap(cap) ? { ...rest, workersCap: cap } : rest
  })
}

type Flag = 'topicsCollapsed' | 'teamView' | 'consultantsCollapsed' | 'doneTodayOpen'

// A project's flag, written only while true.
function setFlag(state: Projects, projectId: string, flag: Flag, on: boolean): Projects {
  return {
    ...state,
    projects: state.projects.map((p) => {
      if (p.id !== projectId) return p
      const { [flag]: _, ...rest } = p
      return on ? { ...rest, [flag]: true } : rest
    }),
  }
}

export const setTopicsCollapsed = (state: Projects, projectId: string, collapsed: boolean) =>
  setFlag(state, projectId, 'topicsCollapsed', collapsed)

export const setTeamView = (state: Projects, projectId: string, team: boolean) =>
  setFlag(state, projectId, 'teamView', team)

export const setConsultantsCollapsed = (state: Projects, projectId: string, collapsed: boolean) =>
  setFlag(state, projectId, 'consultantsCollapsed', collapsed)

export const setDoneTodayOpen = (state: Projects, projectId: string, open: boolean) =>
  setFlag(state, projectId, 'doneTodayOpen', open)

export function orchestrationInfo(p: Project): ProjectInfo['orchestration'] {
  const o = keptOrchestration(p.orchestration, p.members)
  return {
    on: o?.on ?? false,
    orchestrator: o?.orchestrator ?? null,
    roles: o?.roles ?? {},
    withYou: o?.withYou ?? [],
    parked: o?.parked ?? [],
    workersCap: o?.workersCap ?? null,
  }
}

// What list_sessions says of a session; with the mode off, nothing: off is the ordinary Menkar.
// `priority` is the ★ of its current task.
export function sessionMarks(
  p: Project,
  sessionId: string,
  onStarredTask = false,
): {
  readonly role: string | null
  readonly orchestrator: boolean
  readonly priority: boolean
  readonly withYou: boolean
} {
  const o = keptOrchestration(p.orchestration, p.members)
  if (!o?.on) return { role: null, orchestrator: false, priority: false, withYou: false }
  return {
    role: o.roles?.[sessionId] ?? null,
    orchestrator: o.orchestrator === sessionId,
    priority: onStarredTask,
    withYou: o.withYou?.includes(sessionId) ?? false,
  }
}
