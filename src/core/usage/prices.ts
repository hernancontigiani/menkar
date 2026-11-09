// List prices in USD per million tokens, copied from SOURCE on COPIED. An estimate, not a bill: a
// subscription is not billed per token, and the app makes no network connections, so a price
// change means a new row here with the UTC day it took effect, keeping the old one; each token is
// priced at the row in force on its own day.

export const SOURCE = 'https://platform.claude.com/docs/en/about-claude/pricing'
export const COPIED = '2026-11-06'

export interface Price {
  readonly input: number
  readonly cacheWrite5m: number
  readonly cacheWrite1h: number
  readonly cacheRead: number
  readonly output: number
}

// Rows copied without a known start apply to every earlier day too.
const SINCE = '2000-01-01'

const p = (
  input: number,
  cacheWrite5m: number,
  cacheWrite1h: number,
  cacheRead: number,
  output: number,
) => [{ since: SINCE, price: { input, cacheWrite5m, cacheWrite1h, cacheRead, output } }] as const

type Rows = readonly { readonly since: string; readonly price: Price }[]

export const TABLE: Readonly<Record<string, Rows>> = {
  'claude-fable-5-1': p(10, 12.5, 20, 0.25, 50),
  'claude-mythos-5-1': p(10, 12.5, 20, 0.25, 50),
  'claude-fable-5': p(10, 12.5, 20, 1, 50),
  'claude-mythos-5': p(10, 12.5, 20, 1, 50),
  'claude-opus-5-5': p(4, 5, 8, 0.2, 20),
  'claude-opus-5': p(5, 6.25, 10, 0.5, 25),
  'claude-opus-4-8': p(5, 6.25, 10, 0.5, 25),
  'claude-opus-4-7': p(5, 6.25, 10, 0.5, 25),
  'claude-opus-4-6': p(5, 6.25, 10, 0.5, 25),
  'claude-opus-4-5': p(5, 6.25, 10, 0.5, 25),
  'claude-opus-4-1': p(15, 18.75, 30, 1.5, 75),
  'claude-opus-4': p(15, 18.75, 30, 1.5, 75),
  'claude-sonnet-5-5': p(2, 2.5, 4, 0.1, 10),
  'claude-sonnet-5': p(2, 2.5, 4, 0.2, 10),
  'claude-sonnet-4-6': p(3, 3.75, 6, 0.3, 15),
  'claude-sonnet-4-5': p(3, 3.75, 6, 0.3, 15),
  'claude-sonnet-4': p(3, 3.75, 6, 0.3, 15),
  'claude-haiku-5-5': p(0.1, 0.125, 0.2, 0.01, 0.5),
  'claude-haiku-4-5': p(1, 1.25, 2, 0.1, 5),
}

// Haiku 5.5 is priced by prompt size: over this many prompt tokens (input + cache reads + cache
// writes) it pays the long-prompt row.
export const HAIKU_5_5_LONG_PROMPT = 100_000
const HAIKU_5_5_LONG: Price = {
  input: 0.5,
  cacheWrite5m: 0.625,
  cacheWrite1h: 1,
  cacheRead: 0.05,
  output: 2.5,
}

// The 1M-token context window is priced at the standard rate, so `[1m]` prices as its base model;
// a dated id prices as its family.
export function normalizeModel(model: string): string {
  const base = model.endsWith('[1m]') ? model.slice(0, -4) : model
  return base.replace(/-\d{8}$/, '')
}

// "Opus 4.5" for claude-opus-4-5 (dated or [1m] alike) when the table knows the model; any other id
// as stored.
export function modelName(model: string): string {
  const id = normalizeModel(model)
  const known = /^claude-([a-z]+)-(\d+)(?:-(\d+))?$/.exec(id)
  if (!(id in TABLE) || !known) return model
  const [, family = '', major, minor] = known
  return `${family.charAt(0).toUpperCase()}${family.slice(1)} ${major}${minor ? `.${minor}` : ''}`
}

function utcDay(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 10)
}

export function priceFor(model: string, atSeconds: number): Price | null {
  const rows = TABLE[normalizeModel(model)]
  if (!rows || rows.length === 0) return null
  const day = utcDay(atSeconds)
  let found = rows[0]?.price ?? null
  for (const row of rows) if (row.since <= day) found = row.price
  return found
}

export interface TokenCounts {
  readonly input: number
  readonly output: number
  readonly cacheWrite: number
  readonly cacheWrite1h: number
  readonly cacheRead: number
}

// USD for these tokens of one model at one time, or null for a model the table does not know.
export function cost(model: string, atSeconds: number, tokens: TokenCounts): number | null {
  let price = priceFor(model, atSeconds)
  if (price === null) return null
  const prompt = tokens.input + tokens.cacheWrite + tokens.cacheRead
  if (normalizeModel(model) === 'claude-haiku-5-5' && prompt > HAIKU_5_5_LONG_PROMPT) {
    price = HAIKU_5_5_LONG
  }
  const write5m = Math.max(0, tokens.cacheWrite - tokens.cacheWrite1h)
  return (
    (tokens.input * price.input +
      tokens.output * price.output +
      write5m * price.cacheWrite5m +
      tokens.cacheWrite1h * price.cacheWrite1h +
      tokens.cacheRead * price.cacheRead) /
    1_000_000
  )
}
