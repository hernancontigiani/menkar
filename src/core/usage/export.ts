import type { UsageHistory } from './history'
import { addTokens, type Tokens, ZERO_TOKENS } from './nodes'
import type { Bounds } from './periods'
import { cost } from './prices'
import { isoLocal, tokensJson } from './report'
import { statuslineIncrements } from './statusline'

// `menkar usage export`: one row per turn, for an LLM session or a spreadsheet to analyse. The
// rows are a data format with a version: `schema` changes only when a field changes meaning or is
// removed, never when one is added. No prompt or answer text and no path ever goes in a row.
export const EXPORT_SCHEMA = 1

export const EXPORT_KEYS = [
  'schema',
  'turn',
  'session_id',
  'session_name',
  'project',
  'category',
  'origin',
  'opened',
  'opened_epoch',
  'execution_seconds',
  'blocked_seconds',
  'models',
  'cost_usd',
  'cost_exact',
] as const

type ModelJson = ReturnType<typeof tokensJson> & { cost_usd: number; priced: boolean }

export interface ExportRow {
  readonly schema: number
  readonly turn: string
  readonly session_id: string
  readonly session_name: string | null
  readonly project: string | null
  readonly category: string | null
  readonly origin: string
  readonly opened: string
  readonly opened_epoch: number
  readonly execution_seconds: Readonly<Record<string, number>>
  readonly blocked_seconds: number
  readonly models: Readonly<Record<string, ModelJson>>
  readonly cost_usd: number
  readonly cost_exact: boolean
}

export interface ExportOptions {
  // each project's current name
  readonly projectNames?: ReadonlyMap<string, string>
  // the name the app shows for each session, when it has one
  readonly names?: ReadonlyMap<string, string>
  // only this project's turns (a project id)
  readonly project?: string
  // the statusline's logs, oldest first
  readonly statuslineLogs: readonly string[]
}

// The turns opened in [start, end), whole. A session the statusline reported a cost for in the
// range is exact turn by turn: each increment goes to the turn in effect when it was reported, as
// categories do, so a turn with none costs 0 and the rows add up to the report's cost. Any other
// turn costs its tokens at list price.
export function exportRows(
  history: UsageHistory,
  bounds: Bounds,
  options: ExportOptions,
): ExportRow[] {
  const labels = history.projectLabels(options.projectNames ?? new Map())
  const exact = new Map<string, number>()
  const exactSessions = new Set<string>()
  for (const inc of statuslineIncrements(options.statuslineLogs, bounds.start, bounds.end)) {
    const turn = history.turnAt(inc.sessionId, inc.at)
    if (turn === null) continue
    exactSessions.add(inc.sessionId)
    exact.set(turn, (exact.get(turn) ?? 0) + inc.dollars)
  }
  const rows: ExportRow[] = []
  for (const turn of history.turnsOpened(bounds.start, bounds.end)) {
    if (options.project !== undefined && turn.projectId !== options.project) continue
    const byModel = new Map<string, { tokens: Tokens; cost: number; priced: boolean }>()
    for (const { model, hour, tokens } of turn.tokens) {
      const had = byModel.get(model) ?? { tokens: ZERO_TOKENS, cost: 0, priced: true }
      const priced = cost(model, hour, tokens)
      byModel.set(model, {
        tokens: addTokens(had.tokens, tokens),
        cost: had.cost + (priced ?? 0),
        priced: had.priced && priced !== null,
      })
    }
    const models: Record<string, ModelJson> = {}
    for (const [model, m] of [...byModel].sort(([a], [b]) => (a < b ? -1 : 1))) {
      models[model] = { ...tokensJson(m.tokens), cost_usd: m.cost, priced: m.priced }
    }
    const isExact = exactSessions.has(turn.sessionId)
    const estimate = [...byModel.values()].reduce((c, m) => c + m.cost, 0)
    rows.push({
      schema: EXPORT_SCHEMA,
      turn: turn.uuid,
      session_id: turn.sessionId,
      session_name: options.names?.get(turn.sessionId) || history.name(turn.sessionId) || null,
      project: turn.projectId === null ? null : (labels.get(turn.projectId) ?? turn.projectId),
      category: turn.category,
      origin: turn.origin,
      opened: isoLocal(turn.opened),
      opened_epoch: turn.opened,
      execution_seconds: turn.seconds > 0 ? { [turn.origin]: turn.seconds } : {},
      blocked_seconds: turn.blocked,
      models,
      cost_usd: isExact ? (exact.get(turn.uuid) ?? 0) : estimate,
      cost_exact: isExact,
    })
  }
  return rows
}

export function exportJsonl(rows: readonly ExportRow[]): string {
  return rows.map((row) => `${JSON.stringify(row)}\n`).join('')
}

export const CSV_COLUMNS = [
  'schema',
  'turn',
  'session_id',
  'session_name',
  'project',
  'category',
  'origin',
  'opened',
  'opened_epoch',
  'execution_seconds',
  'blocked_seconds',
  'input',
  'output',
  'cache_write',
  'cache_write_1h',
  'cache_read',
  'models',
  'cost_usd',
  'cost_exact',
] as const

function csvField(value: string | number | boolean | null): string {
  if (value === null) return ''
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

// One row per turn with the same scalar fields; the tokens are the turn's totals and `models` its
// model ids joined by ";". By-model figures are in the JSONL rows only.
export function exportCsv(rows: readonly ExportRow[]): string {
  const lines = [CSV_COLUMNS.join(',')]
  for (const row of rows) {
    const models = Object.values(row.models)
    const total = (key: 'input' | 'output' | 'cache_write' | 'cache_write_1h' | 'cache_read') =>
      models.reduce((n, m) => n + m[key], 0)
    const fields: (string | number | boolean | null)[] = [
      row.schema,
      row.turn,
      row.session_id,
      row.session_name,
      row.project,
      row.category,
      row.origin,
      row.opened,
      row.opened_epoch,
      Object.values(row.execution_seconds).reduce((n, s) => n + s, 0),
      row.blocked_seconds,
      total('input'),
      total('output'),
      total('cache_write'),
      total('cache_write_1h'),
      total('cache_read'),
      Object.keys(row.models).join(';'),
      row.cost_usd,
      row.cost_exact,
    ]
    lines.push(fields.map(csvField).join(','))
  }
  return `${lines.join('\n')}\n`
}
