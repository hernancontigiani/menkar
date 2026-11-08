// The report's tree and its figures as they are shown: shared by the terminal, main and the
// Usage window's page, so nothing here imports Node.
import type { Bounds } from './periods'
import type { TokenCounts } from './prices'

export interface Tokens extends TokenCounts {}

export const ZERO_TOKENS: Tokens = {
  input: 0,
  output: 0,
  cacheWrite: 0,
  cacheWrite1h: 0,
  cacheRead: 0,
}

export function addTokens(a: Tokens, b: Tokens): Tokens {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheWrite: a.cacheWrite + b.cacheWrite,
    cacheWrite1h: a.cacheWrite1h + b.cacheWrite1h,
    cacheRead: a.cacheRead + b.cacheRead,
  }
}

export function totalTokens(t: Tokens): number {
  return t.input + t.output + t.cacheWrite + t.cacheRead
}

export const CATEGORIES = [
  'plan',
  'design',
  'build',
  'test',
  'deploy',
  'maintain',
  'other',
] as const
export const NO_PROJECT = '(no project)'
export const UNCLASSIFIED = '(unclassified)'

export interface Node {
  readonly label: string
  readonly kind: 'project' | 'category' | 'session'
  readonly execution: Readonly<Record<string, number>>
  readonly blocked: number
  readonly tokens: Tokens
  readonly cost: number
  // every session under it reported its cost through the statusline
  readonly costExact: boolean
  // every model under it was in the price table
  readonly allPriced: boolean
  readonly children: readonly Node[]
  // a category node's: one of CATEGORIES, null for "(unclassified)"
  readonly category?: string | null
}

export interface Report {
  readonly bounds: Bounds
  readonly nodes: readonly Node[]
  readonly limits: readonly [number, number] | null
  readonly tooNew: boolean
}

export function totalExecution(node: Pick<Node, 'execution'>): number {
  let sum = 0
  for (const seconds of Object.values(node.execution)) sum += seconds
  return sum
}

// Rounds half to even, as the figures agent-tablet printed did, so the two apps print the same.
function fixed(value: number, digits: number): string {
  const scale = 10 ** digits
  const scaled = value * scale
  const floor = Math.floor(scaled)
  const diff = scaled - floor
  let rounded: number
  if (Math.abs(diff - 0.5) < 1e-9) rounded = floor % 2 === 0 ? floor : floor + 1
  else rounded = Math.round(scaled)
  return (rounded / scale).toFixed(digits)
}

// Hours with one decimal from an hour up; whole minutes below, so a short session is not 0.0h.
export function formatDuration(seconds: number): string {
  return seconds >= 3600 ? `${fixed(seconds / 3600, 1)}h` : `${fixed(seconds / 60, 0)}m`
}

export function formatTokens(count: number): string {
  return count >= 1_000_000 ? `${fixed(count / 1_000_000, 1)}M` : `${fixed(count / 1000, 0)}k`
}

export function formatCost(node: Pick<Node, 'cost' | 'costExact' | 'allPriced'>): string {
  return `${node.costExact ? '$' : '~$'}${fixed(node.cost, 2)}${node.allPriced ? '' : '+'}`
}

export function formatPercent(value: number): string {
  return fixed(value, 0)
}

// Which period the Usage window asks for.
export type UsageWhich =
  | { readonly kind: 'period'; readonly period: 'today' | '7d' | '30d' }
  | { readonly kind: 'month'; readonly year: number; readonly month: number }
  | { readonly kind: 'all' }

// What the Usage window draws for a period: the Totals, one report per bar (by project, and by
// category while classification is on), and what bounds the month stepper.
export interface UsageView {
  readonly totals: Report
  readonly bars: readonly { readonly project: Report; readonly category: Report | null }[]
  readonly bucket: 'hour' | 'day' | 'month'
  readonly firstMonth: { readonly year: number; readonly month: number } | null
  readonly tooNew: boolean
  readonly categories: boolean
}
