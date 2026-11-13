import type { ProjectInfo } from '../projects/info'

// What the sidebar draws in the orchestration mode (decision 1.89), in order.
export type ModeRow =
  // `section` is what a drag stays within: a group's name, '' for "No group", null where rows are
  // not dragged (the orchestrator's and the consultants' parts, and every nested child).
  | {
      readonly kind: 'session'
      readonly id: string
      readonly depth: 0 | 1
      readonly section: string | null
    }
  // A top row's children without a tab, folded into one row until a click unfolds them.
  | {
      readonly kind: 'earlier'
      readonly parent: string
      readonly ids: readonly string[]
      readonly open: boolean
    }
  | { readonly kind: 'heading'; readonly heading: 'consultants' | 'others' }
  | { readonly kind: 'group'; readonly name: string; readonly collapsed: boolean }
  | { readonly kind: 'noGroup' }

export interface ModeView {
  // The rows the list shows, in the project's member order: no hidden or earlier conversation.
  readonly listed: readonly string[]
  // Sessions with a tab in some window.
  readonly open: ReadonlySet<string>
  // Top rows whose "N earlier" row this window unfolded.
  readonly unfolded: ReadonlySet<string>
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
  const withChildren = (id: string, section: string | null): ModeRow[] => {
    const own = children.get(id) ?? []
    const shown = own.filter((c) => view.open.has(c))
    const folded = own.filter((c) => !view.open.has(c))
    const open = view.unfolded.has(id)
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
    ]
  }

  const o = project.orchestration
  const orchestrator = o.orchestrator && tops.includes(o.orchestrator) ? o.orchestrator : null
  // A loose session with a role label is a consultant (decision 1.107); a labelled child is an
  // expert and stays nested under the orchestrator.
  const consultants = tops.filter((id) => id !== orchestrator && o.roles[id] !== undefined)
  const team = new Set([...(orchestrator ? [orchestrator] : []), ...consultants])
  const others = tops.filter((id) => !team.has(id))

  const rows: ModeRow[] = orchestrator ? withChildren(orchestrator, null) : []
  if (consultants.length > 0) {
    rows.push({ kind: 'heading', heading: 'consultants' })
    for (const id of consultants) rows.push(...withChildren(id, null))
  }
  if (others.length === 0) return rows
  rows.push({ kind: 'heading', heading: 'others' })
  const othersSet = new Set(others)
  const grouped = new Set<string>()
  let groupsShown = 0
  for (const g of project.groups) {
    const members = g.members.filter((id) => othersSet.has(id))
    for (const id of members) grouped.add(id)
    if (members.length === 0) continue
    groupsShown += 1
    rows.push({ kind: 'group', name: g.name, collapsed: g.collapsed === true })
    if (!g.collapsed) for (const id of members) rows.push(...withChildren(id, g.name))
  }
  const loose = others.filter((id) => !grouped.has(id))
  if (loose.length > 0 && groupsShown > 0) rows.push({ kind: 'noGroup' })
  for (const id of loose) rows.push(...withChildren(id, ''))
  return rows
}
