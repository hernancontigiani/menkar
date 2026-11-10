import { keyOf, type UsageHistory } from './history'
import {
  addModels,
  addTokens,
  CATEGORIES,
  formatCost,
  formatDuration,
  formatPercent,
  formatTokens,
  type Models,
  NO_PROJECT,
  type Node,
  type Report,
  type Tokens,
  totalExecution,
  totalTokens,
  UNCLASSIFIED,
  ZERO_TOKENS,
} from './nodes'
import { type Bounds, type Bucket, buckets, localDay } from './periods'
import { latestLimits, statuslineIncrements } from './statusline'

export {
  CATEGORIES,
  formatCost,
  formatDuration,
  formatPercent,
  formatTokens,
  type Models,
  NO_PROJECT,
  type Node,
  type Report,
  totalExecution,
  totalTokens,
  UNCLASSIFIED,
}

function sum(label: string, kind: Node['kind'], children: Node[], category?: string | null): Node {
  const execution: Record<string, number> = {}
  let tokens = ZERO_TOKENS
  let models: Models = {}
  let blocked = 0
  let cost = 0
  for (const child of children) {
    models = addModels(models, child.models)
    for (const [origin, seconds] of Object.entries(child.execution)) {
      execution[origin] = (execution[origin] ?? 0) + seconds
    }
    tokens = addTokens(tokens, child.tokens)
    blocked += child.blocked
    cost += child.cost
  }
  return {
    label,
    kind,
    execution,
    blocked,
    tokens,
    models,
    cost,
    costExact: children.every((c) => c.costExact),
    allPriced: children.every((c) => c.allPriced),
    children,
    ...(category === undefined ? {} : { category }),
  }
}

const fold = (text: string) => text.toLocaleLowerCase('en')
const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

// Largest execution first, then by label, case-insensitive.
function byLargest(a: Node, b: Node): number {
  return totalExecution(b) - totalExecution(a) || compareText(fold(a.label), fold(b.label))
}

// (category, session node) → one node per category, in their fixed order, unclassified last.
function byCategoryNodes(sessions: readonly { category: string | null; node: Node }[]): Node[] {
  const grouped = new Map<string | null, Node[]>()
  for (const { category, node } of sessions) {
    const list = grouped.get(category) ?? []
    list.push(node)
    grouped.set(category, list)
  }
  const known: readonly string[] = CATEGORIES
  // A category this version does not know (stored by a newer classifier) follows the known ones.
  const unknown = [...grouped.keys()].filter((c): c is string => c !== null && !known.includes(c))
  const order: (string | null)[] = [...CATEGORIES.filter((c) => grouped.has(c)), ...unknown.sort()]
  if (grouped.has(null)) order.push(null)
  return order.map((c) =>
    sum(c ?? UNCLASSIFIED, 'category', (grouped.get(c) ?? []).sort(byLargest), c),
  )
}

export interface ReportOptions {
  // the name the app shows for each session, when it has one
  readonly names?: ReadonlyMap<string, string>
  // each project's current name
  readonly projectNames?: ReadonlyMap<string, string>
  readonly categories?: boolean
  // only this project's turns (a project id); every project when absent
  readonly project?: string
  // the statusline's logs, oldest first
  readonly statuslineLogs: readonly string[]
}

// Project → session for [start, end) from the history, or project → category → session with
// categories. A turn counts for the project it was filed under, so a session moved between
// projects shows under each with its own turns.
export function buildReport(history: UsageHistory, bounds: Bounds, options: ReportOptions): Report {
  const categories = options.categories ?? false
  const exact = new Map<string, number>()
  for (const inc of statuslineIncrements(
    options.statuslineLogs,
    bounds.start,
    bounds.end,
    (sessionId, at) => history.inFirstTurn(sessionId, at),
  )) {
    const category = categories ? history.categoryAt(inc.sessionId, inc.at) : null
    const key = keyOf(history.projectAt(inc.sessionId, inc.at), inc.sessionId, category)
    exact.set(key, (exact.get(key) ?? 0) + inc.dollars)
  }
  const labels = history.projectLabels(options.projectNames ?? new Map())
  const byProject = new Map<string | null, { category: string | null; node: Node }[]>()
  for (const [id, { key, usage }] of history.usage(bounds.start, bounds.end, categories)) {
    if (options.project !== undefined && key.projectId !== options.project) continue
    const label =
      options.names?.get(key.sessionId) || history.name(key.sessionId) || key.sessionId.slice(0, 8)
    const exactCost = exact.get(id)
    const node: Node = {
      label,
      kind: 'session',
      execution: usage.execution,
      blocked: usage.blocked,
      tokens: usage.tokens,
      models: usage.models,
      cost: exactCost ?? usage.cost,
      costExact: exactCost !== undefined,
      allPriced: usage.allPriced,
      children: [],
    }
    const list = byProject.get(key.projectId) ?? []
    list.push({ category: key.category, node })
    byProject.set(key.projectId, list)
  }
  const projects = [...byProject.keys()].map((id) => ({
    id,
    label: (id === null ? null : labels.get(id)) || id || NO_PROJECT,
  }))
  projects.sort(
    (a, b) =>
      Number(a.id === null) - Number(b.id === null) || compareText(fold(a.label), fold(b.label)),
  )
  const nodes = projects.map(({ id, label }) => {
    const found = byProject.get(id) ?? []
    const children = categories ? byCategoryNodes(found) : found.map((f) => f.node).sort(byLargest)
    return sum(label, 'project', children)
  })
  return { bounds, nodes, limits: latestLimits(options.statuslineLogs), tooNew: history.tooNew }
}

// One report per bucket, so a bar and the period's total cannot disagree.
export function buildSeries(
  history: UsageHistory,
  bounds: Bounds,
  unit: Bucket,
  options: ReportOptions,
): Report[] {
  return buckets(bounds, unit).map((b) => buildReport(history, b, options))
}

// A report built with categories, its projects folded away: one node per category across them.
export function foldByCategory(result: Report): Report {
  const found: { category: string | null; node: Node }[] = []
  for (const project of result.nodes) {
    for (const node of project.children) {
      if (node.kind === 'category') {
        for (const session of node.children)
          found.push({ category: node.category ?? null, node: session })
      }
    }
  }
  return { ...result, nodes: byCategoryNodes(found) }
}

// -- formats, shared by the terminal and the window -----------------------------------------

const pad2 = (n: number) => String(n).padStart(2, '0')

// Local time with its offset, to the second: 2026-11-02T00:00:00-03:00.
export function isoLocal(seconds: number): string {
  const d = new Date(seconds * 1000)
  const offset = -d.getTimezoneOffset()
  const abs = Math.abs(offset)
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
    `T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}` +
    `${offset >= 0 ? '+' : '-'}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`
  )
}

// Local date and minute: 2026-11-08 09:00.
export function localMinute(seconds: number): string {
  const d = new Date(seconds * 1000)
  const day = localDay(seconds)
  return `${day.year}-${pad2(day.month)}-${pad2(day.day)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export interface NodeJson {
  label: string
  kind: Node['kind']
  category?: string | null
  execution_seconds: Record<string, number>
  blocked_seconds: number
  tokens: TokensJson
  // by model id: the same tokens and their list-price cost (an exact cost is never per model)
  models: Record<string, TokensJson & { cost_usd: number; priced: boolean }>
  cost_usd: number
  cost_exact: boolean
  all_priced: boolean
  children: NodeJson[]
}

interface TokensJson {
  input: number
  output: number
  cache_write: number
  cache_write_1h: number
  cache_read: number
}

export function tokensJson(tokens: Tokens): TokensJson {
  return {
    input: tokens.input,
    output: tokens.output,
    cache_write: tokens.cacheWrite,
    cache_write_1h: tokens.cacheWrite1h,
    cache_read: tokens.cacheRead,
  }
}

export function nodeJson(node: Node): NodeJson {
  return {
    label: node.label,
    kind: node.kind,
    ...(node.kind === 'category' ? { category: node.category ?? null } : {}),
    execution_seconds: { ...node.execution },
    blocked_seconds: node.blocked,
    tokens: tokensJson(node.tokens),
    models: Object.fromEntries(
      Object.entries(node.models).map(([model, m]) => [
        model,
        { ...tokensJson(m.tokens), cost_usd: m.cost, priced: m.priced },
      ]),
    ),
    cost_usd: node.cost,
    cost_exact: node.costExact,
    all_priced: node.allPriced,
    children: node.children.map(nodeJson),
  }
}

export function reportJson(result: Report) {
  return {
    start: isoLocal(result.bounds.start),
    end: isoLocal(result.bounds.end),
    nodes: result.nodes.map(nodeJson),
    limits: result.limits ? [...result.limits] : null,
    history_too_new: result.tooNew,
  }
}
