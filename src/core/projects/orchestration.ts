import type { Key } from '../i18n'
import type { Params } from '../i18n/interpolate'
import { isAbsoluteFolder } from '../orchestration/folders'
import type { ProjectInfo } from './info'
import type { Orchestration, Project, Projects, StoredSkill } from './model'

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const ids = (value: unknown, members: ReadonlySet<string>): string[] =>
  Array.isArray(value)
    ? [...new Set(value.filter((x): x is string => typeof x === 'string' && members.has(x)))]
    : []

// Menkar's own skills follow from the marks; storing one would let a session be told to load the
// orchestrator's skill without being the orchestrator.
const isMenkarSkill = (name: string) => name.startsWith('menkar:')

const skill = (name: string, maintainer: boolean): StoredSkill =>
  maintainer ? { name, maintainer: true } : { name }

// One list as the file or the human gave it: an entry it cannot read is dropped alone, and a
// repeated name keeps the first.
function skillList(value: unknown): StoredSkill[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const list: StoredSkill[] = []
  for (const entry of value) {
    if (!isObject(entry) || typeof entry.name !== 'string') continue
    const name = entry.name.trim()
    if (name === '' || isMenkarSkill(name) || seen.has(name)) continue
    seen.add(name)
    list.push(skill(name, entry.maintainer === true))
  }
  return list
}

// Members only, in member order, so a name two sessions claim to maintain (a hand-edited file)
// stays with the first and reads as read only for the rest.
function keptSkills(
  skills: Orchestration['skills'],
  members: readonly string[],
): Record<string, StoredSkill[]> {
  const maintained = new Set<string>()
  const kept: Record<string, StoredSkill[]> = {}
  for (const id of members) {
    const list = skills?.[id]
    if (!list || list.length === 0) continue
    kept[id] = list.map((s) => {
      const maintainer = s.maintainer === true && !maintained.has(s.name)
      if (maintainer) maintained.add(s.name)
      return skill(s.name, maintainer)
    })
  }
  return kept
}

// Only what is set, so an untouched project writes nothing and an empty one reads as absent.
function compact(o: Orchestration): Orchestration | undefined {
  const roles = o.roles && Object.keys(o.roles).length > 0 ? o.roles : undefined
  const skills = o.skills && Object.keys(o.skills).length > 0 ? o.skills : undefined
  const withYou = o.withYou && o.withYou.length > 0 ? o.withYou : undefined
  const parked = o.parked && o.parked.length > 0 ? o.parked : undefined
  const cap = o.workersCap
  const folders = o.folders && o.folders.length > 0 ? o.folders : undefined
  if (
    !o.on &&
    !o.orchestrator &&
    !roles &&
    !skills &&
    !withYou &&
    !parked &&
    cap === undefined &&
    !folders
  )
    return undefined
  return {
    on: o.on,
    ...(o.orchestrator ? { orchestrator: o.orchestrator } : {}),
    ...(roles ? { roles } : {}),
    ...(skills ? { skills } : {}),
    ...(withYou ? { withYou } : {}),
    ...(parked ? { parked } : {}),
    ...(cap !== undefined ? { workersCap: cap } : {}),
    ...(folders ? { folders } : {}),
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
    skills: keptSkills(o.skills, members),
    withYou: ids(o.withYou, set),
    parked: ids(o.parked, set),
    ...(o.workersCap !== undefined ? { workersCap: o.workersCap } : {}),
    ...(o.folders ? { folders: o.folders } : {}),
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
  const skills: Record<string, StoredSkill[]> = {}
  if (isObject(value.skills))
    for (const [id, list] of Object.entries(value.skills)) skills[id] = skillList(list)
  return keptOrchestration(
    {
      on: value.on === true,
      ...(typeof value.orchestrator === 'string' ? { orchestrator: value.orchestrator } : {}),
      roles,
      skills,
      withYou: ids(value.with_you, new Set(members)),
      parked: ids(value.parked, new Set(members)),
      ...(isCap(value.workers_cap) ? { workersCap: value.workers_cap } : {}),
      folders: Array.isArray(value.folders)
        ? [
            ...new Set(
              value.folders.filter(
                (x): x is string => typeof x === 'string' && isAbsoluteFolder(x),
              ),
            ),
          ]
        : [],
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
    ...(o.skills ? { skills: o.skills } : {}),
    ...(o.withYou ? { with_you: o.withYou } : {}),
    ...(o.parked ? { parked: o.parked } : {}),
    ...(o.workersCap !== undefined ? { workers_cap: o.workersCap } : {}),
    ...(o.folders ? { folders: o.folders } : {}),
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
  const { [from]: fromSkills, ...otherSkills } = o.skills ?? {}
  const skills = fromSkills === undefined ? otherSkills : { ...otherSkills, [to]: fromSkills }
  const { roles: _roles, skills: _skills, withYou: _withYou, parked: _parked, ...base } = o
  const withYou = swap(o.withYou)
  const parked = swap(o.parked)
  return withOrchestration(p, {
    ...base,
    ...(o.orchestrator === from ? { orchestrator: to } : {}),
    roles,
    skills,
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

// Off, the Board closes too: nothing of the mode shows with it off.
export function setMode(state: Projects, projectId: string, on: boolean): Projects {
  const next = change(state, projectId, (o) => ({ ...o, on }))
  return on ? next : setBoard(next, projectId, { open: false })
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

export type SkillsResult =
  | { readonly ok: true; readonly projects: Projects }
  | { readonly ok: false; readonly refusal: Key; readonly params: Params }

// The human's list for a session (decision 1.152), replacing the one stored. One maintainer per
// skill (decision 1.119): moving it means unsetting it on the other session first. `nameOf` gives
// the name a refusal shows for a session id.
export function setSkills(
  state: Projects,
  projectId: string,
  sessionId: string,
  skills: readonly StoredSkill[],
  nameOf: (sessionId: string) => string = (id) => id,
): SkillsResult {
  const own = state.projects.find((p) => p.id === projectId)?.orchestration?.skills ?? {}
  for (const s of skills) {
    if (isMenkarSkill(s.name.trim()))
      return { ok: false, refusal: 'refusal.menkarSkill', params: { name: s.name.trim() } }
    if (s.maintainer !== true) continue
    const holder = Object.entries(own).find(
      ([id, list]) =>
        id !== sessionId && list.some((x) => x.name === s.name.trim() && x.maintainer),
    )
    if (holder)
      return {
        ok: false,
        refusal: 'refusal.maintainedBy',
        params: { name: s.name.trim(), session: nameOf(holder[0]) },
      }
  }
  return {
    ok: true,
    projects: change(state, projectId, (o) => ({
      ...o,
      skills: { ...o.skills, [sessionId]: skillList(skills) },
    })),
  }
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

// A folder added by hand (decision 1.124), once.
export function addFolder(state: Projects, projectId: string, path: string): Projects {
  if (!isAbsoluteFolder(path)) return state
  return change(state, projectId, (o) => ({
    ...o,
    folders: [...(o.folders ?? []).filter((x) => x !== path), path],
  }))
}

export function removeFolder(state: Projects, projectId: string, path: string): Projects {
  return change(state, projectId, (o) => ({
    ...o,
    folders: (o.folders ?? []).filter((x) => x !== path),
  }))
}

type Flag =
  | 'topicsCollapsed'
  | 'teamView'
  | 'consultantsCollapsed'
  | 'orchestratorCollapsed'
  | 'othersCollapsed'
  | 'doneTodayOpen'

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

export const setOrchestratorCollapsed = (state: Projects, projectId: string, collapsed: boolean) =>
  setFlag(state, projectId, 'orchestratorCollapsed', collapsed)

export const setOthersCollapsed = (state: Projects, projectId: string, collapsed: boolean) =>
  setFlag(state, projectId, 'othersCollapsed', collapsed)

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
    folders: o?.folders ?? [],
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
  readonly skills: readonly { readonly name: string; readonly maintainer: boolean }[]
} {
  const o = keptOrchestration(p.orchestration, p.members)
  if (!o?.on)
    return { role: null, orchestrator: false, priority: false, withYou: false, skills: [] }
  return {
    role: o.roles?.[sessionId] ?? null,
    orchestrator: o.orchestrator === sessionId,
    priority: onStarredTask,
    withYou: o.withYou?.includes(sessionId) ?? false,
    skills: (o.skills?.[sessionId] ?? []).map((s) => ({
      name: s.name,
      maintainer: s.maintainer === true,
    })),
  }
}

export const isBoardHeight = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

// The Board panel (decision 1.126): `height` null goes back to the default.
export function setBoard(
  state: Projects,
  projectId: string,
  what: { readonly open?: boolean; readonly height?: number | null },
): Projects {
  return {
    ...state,
    projects: state.projects.map((p) => {
      if (p.id !== projectId) return p
      let next: Project = p
      if (what.open !== undefined) {
        const { boardOpen: _, ...rest } = next
        next = what.open ? { ...rest, boardOpen: true } : rest
      }
      if (what.height !== undefined) {
        const { boardHeight: _, ...rest } = next
        next = isBoardHeight(what.height) ? { ...rest, boardHeight: Math.round(what.height) } : rest
      }
      return next
    }),
  }
}
