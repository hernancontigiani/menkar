import type { ProjectInfo } from '../projects/info'
import type { TabPlace } from '../projects/place'

// What the sidebar draws in the orchestration mode (decision 1.89), in order.
export type ModeRow =
  // `section` is what a drag stays within: a group's name, '' for "No group", null where rows are
  // not dragged (the orchestrator's and the consultants' parts, and every nested child).
  | {
      readonly kind: 'session'
      readonly id: string
      readonly depth: 0 | 1
      readonly section: string | null
      // Under the orchestrator's "Parked" row.
      readonly parked?: true
      // The orchestrator's row while anyone is under it (decision 1.171): everyone under it, and
      // whether they are folded into its row.
      readonly fold?: { readonly ids: readonly string[]; readonly folded: boolean }
    }
  // A top row's children without a tab, folded into one row until a click unfolds them.
  | {
      readonly kind: 'earlier'
      readonly parent: string
      readonly ids: readonly string[]
      readonly open: boolean
    }
  // The orchestrator's parked workers (decision 1.120), folded into one row until a click unfolds
  // them; they are not among its "earlier" children.
  | { readonly kind: 'parked'; readonly ids: readonly string[]; readonly open: boolean }
  | {
      readonly kind: 'heading'
      readonly heading: 'consultants' | 'others'
      readonly collapsed?: true
    }
  | { readonly kind: 'group'; readonly name: string; readonly collapsed: boolean }
  | { readonly kind: 'noGroup' }

export interface ModeView {
  // The rows the list shows, in the project's member order: no hidden or earlier conversation.
  readonly listed: readonly string[]
  // Sessions with a tab in some window.
  readonly open: ReadonlySet<string>
  // Top rows whose "N earlier" row this window unfolded.
  readonly unfolded: ReadonlySet<string>
  // This window unfolded the orchestrator's "Parked" row.
  readonly parkedOpen?: boolean
}

export function modeRows(project: ProjectInfo, view: ModeView): ModeRow[] {
  const listed = new Set(view.listed)
  // A child sits under the top row of its line of parents: one level of indent, however deep.
  const topOf = (id: string): string => {
    let top = id
    const seen = new Set([id])
    for (let up = project.parents[id]; up && !seen.has(up); up = project.parents[up]) {
      seen.add(up)
      if (listed.has(up)) top = up
    }
    return top
  }
  const children = new Map<string, string[]>()
  for (const id of view.listed) {
    const top = topOf(id)
    if (top !== id) children.set(top, [...(children.get(top) ?? []), id])
  }
  const tops = view.listed.filter((id) => topOf(id) === id)
  const o = project.orchestration
  const orchestrator = o.orchestrator && tops.includes(o.orchestrator) ? o.orchestrator : null
  const parkedMarks = new Set(o.parked)
  const withChildren = (id: string, section: string | null): ModeRow[] => {
    const own = children.get(id) ?? []
    const shown = own.filter((c) => view.open.has(c))
    const stopped = own.filter((c) => !view.open.has(c))
    const parked = id === orchestrator ? stopped.filter((c) => parkedMarks.has(c)) : []
    const folded = stopped.filter((c) => !parked.includes(c))
    const open = view.unfolded.has(id)
    const parkedOpen = view.parkedOpen === true
    return [
      { kind: 'session', id, depth: 0, section },
      ...shown.map((c): ModeRow => ({ kind: 'session', id: c, depth: 1, section: null })),
      ...(folded.length > 0
        ? [
            { kind: 'earlier', parent: id, ids: folded, open } as const,
            ...(open
              ? folded.map((c): ModeRow => ({ kind: 'session', id: c, depth: 1, section: null }))
              : []),
          ]
        : []),
      ...(parked.length > 0
        ? [
            { kind: 'parked', ids: parked, open: parkedOpen } as const,
            ...(parkedOpen
              ? parked.map(
                  (c): ModeRow => ({
                    kind: 'session',
                    id: c,
                    depth: 1,
                    section: null,
                    parked: true,
                  }),
                )
              : []),
          ]
        : []),
    ]
  }

  function orchestratorRows(id: string): ModeRow[] {
    const ids = children.get(id) ?? []
    if (ids.length === 0) return withChildren(id, null)
    const folded = project.orchestratorCollapsed
    const top: ModeRow = { kind: 'session', id, depth: 0, section: null, fold: { ids, folded } }
    return folded ? [top] : [top, ...withChildren(id, null).slice(1)]
  }

  // A loose session with a role label is a consultant (decision 1.107); a labelled child is an
  // expert and stays nested under the orchestrator.
  const consultants = tops.filter((id) => id !== orchestrator && o.roles[id] !== undefined)
  const team = new Set([...(orchestrator ? [orchestrator] : []), ...consultants])
  const others = tops.filter((id) => !team.has(id))

  const rows: ModeRow[] = orchestrator ? orchestratorRows(orchestrator) : []
  if (consultants.length > 0) {
    rows.push({
      kind: 'heading',
      heading: 'consultants',
      ...(project.consultantsCollapsed ? { collapsed: true as const } : {}),
    })
    if (!project.consultantsCollapsed)
      for (const id of consultants) rows.push(...withChildren(id, null))
  }
  if (others.length === 0) return rows
  rows.push({
    kind: 'heading',
    heading: 'others',
    ...(project.othersCollapsed ? { collapsed: true as const } : {}),
  })
  if (project.othersCollapsed) return rows
  // One flat list, no group headings (decision 1.183); the groups are kept for the mode off. Each
  // row keeps its group as its drag section, so a drop still reorders only within its group.
  const groupOf = (id: string) => project.groups.find((g) => g.members.includes(id))?.name ?? ''
  for (const id of others) rows.push(...withChildren(id, groupOf(id)))
  return rows
}

export const TOPICS_SHOWN = 5

// The sidebar's "Awaiting you", in `shownTopics`' order: the first few, the rest behind "N more"
// until it is unfolded.
export function topicsFolded<T>(
  shown: readonly T[],
  unfolded: boolean,
): { readonly rows: readonly T[]; readonly more: number } {
  if (unfolded || shown.length <= TOPICS_SHOWN) return { rows: shown, more: 0 }
  return { rows: shown.slice(0, TOPICS_SHOWN), more: shown.length - TOPICS_SHOWN }
}

export const TASKS_SHOWN = 3

export function tasksFolded<T>(open: readonly T[]): {
  readonly rows: readonly T[]
  readonly more: number
} {
  return { rows: open.slice(0, TASKS_SHOWN), more: Math.max(0, open.length - TASKS_SHOWN) }
}

export type RowWeight = 'pinned' | 'background' | 'peek' | 'none'

// A worker's name says where its tab is; `null` leaves the row as it was drawn before, which is
// every row that is not a worker's.
export function rowWeight(worker: boolean, place: TabPlace | 'ordinary' | null): RowWeight | null {
  if (!worker) return null
  if (place === null) return 'none'
  return place === 'ordinary' ? 'pinned' : place
}
