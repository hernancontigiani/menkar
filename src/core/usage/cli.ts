import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { now } from '../clock'
import { t } from '../i18n'
import { appDirs } from '../paths'
import { exportCsv, exportJsonl, exportRows } from './export'
import { type Memberships, NO_MEMBERSHIPS, UsageHistory } from './history'
import { defaultPassPaths, type PassPaths, runPass } from './pass'
import {
  allBounds,
  type Bounds,
  type Bucket,
  type Day,
  monthBounds,
  type Period,
  periodBounds,
  rangeBounds,
} from './periods'
import {
  buildReport,
  buildSeries,
  formatCost,
  formatDuration,
  formatPercent,
  formatTokens,
  localMinute,
  NO_PROJECT,
  type Node,
  type Report,
  reportJson,
  totalExecution,
  totalTokens,
  UNCLASSIFIED,
} from './report'
import { importedStatuslineLogPath, statuslineLogPath } from './statusline'
import { isObject } from './transcript'

export interface Output {
  out(text: string): void
  err(text: string): void
}

type Which =
  | { readonly kind: 'period'; readonly period: Period }
  | { readonly kind: 'month'; readonly year: number; readonly month: number }
  | { readonly kind: 'range'; readonly from: Day; readonly to: Day }

export interface Options {
  readonly which: Which
  readonly by: Bucket | null
  readonly json: boolean
}

class UsageError extends Error {}

const PERIODS: readonly Period[] = ['today', '7d', '30d', 'all']
const BUCKETS: readonly Bucket[] = ['hour', 'day', 'month']
const USAGE =
  'menkar usage [--period today|7d|30d|all | --month YYYY-MM | --from YYYY-MM-DD --to YYYY-MM-DD]' +
  ' [--by hour|day|month] [--json]'

function parseDay(text: string): Day | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day)
    return null
  return { year, month, day }
}

function parseMonth(text: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{1,2})$/.exec(text)
  if (!match) return null
  const month = Number(match[2])
  return month >= 1 && month <= 12 ? { year: Number(match[1]), month } : null
}

export function parseArgs(argv: readonly string[]): Options {
  const values = new Map<string, string>()
  let json = false
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? ''
    if (arg === '--json') {
      json = true
      continue
    }
    const [flag, inline] = arg.includes('=')
      ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)]
      : [arg, undefined]
    if (!['--period', '--month', '--from', '--to', '--by'].includes(flag ?? '')) {
      throw new UsageError(t('usage.cli.unknownArgument', { argument: arg }))
    }
    const value = inline ?? argv[++i]
    if (value === undefined) throw new UsageError(t('usage.cli.needsValue', { flag: flag ?? '' }))
    values.set(flag ?? '', value)
  }
  checkPeriodFlags(values)
  const by = values.get('--by') ?? null
  if (by !== null && !(BUCKETS as readonly string[]).includes(by)) {
    throw new UsageError(
      t('usage.cli.badChoice', { flag: '--by', value: by, choices: BUCKETS.join(', ') }),
    )
  }
  return { which: whichOf(values), by: by as Bucket | null, json }
}

// --period, --month or --from/--to, already checked not to be mixed; 7 days when none is given.
function whichOf(values: ReadonlyMap<string, string>): Which {
  let which: Which
  const month = values.get('--month')
  const from = values.get('--from')
  const to = values.get('--to')
  if (month !== undefined) {
    const parsed = parseMonth(month)
    if (parsed === null) throw new UsageError(t('usage.cli.badMonth', { value: month }))
    which = { kind: 'month', ...parsed }
  } else if (from !== undefined && to !== undefined) {
    const a = parseDay(from)
    const b = parseDay(to)
    if (a === null) throw new UsageError(t('usage.cli.badDay', { value: from }))
    if (b === null) throw new UsageError(t('usage.cli.badDay', { value: to }))
    which = { kind: 'range', from: a, to: b }
  } else {
    const period = values.get('--period') ?? '7d'
    if (!(PERIODS as readonly string[]).includes(period)) {
      throw new UsageError(
        t('usage.cli.badChoice', { flag: '--period', value: period, choices: PERIODS.join(', ') }),
      )
    }
    which = { kind: 'period', period: period as Period }
  }
  return which
}

function checkPeriodFlags(values: ReadonlyMap<string, string>): void {
  const chosen = ['--period', '--month', '--from'].filter((f) => values.has(f))
  if (chosen.length > 1) {
    throw new UsageError(
      t('usage.cli.notTogether', { first: chosen[0] ?? '', second: chosen[1] ?? '' }),
    )
  }
  if (values.has('--from') !== values.has('--to')) throw new UsageError(t('usage.cli.fromAndTo'))
}

const EXPORT_USAGE =
  'menkar usage export [--period today|7d|30d|all | --month YYYY-MM | --from YYYY-MM-DD' +
  ' --to YYYY-MM-DD] [--project NAME] [--format jsonl|csv] [--output FILE]'
const FORMATS = ['jsonl', 'csv'] as const

export interface ExportArgs {
  readonly which: Which
  readonly project: string | null
  readonly format: (typeof FORMATS)[number]
  readonly output: string | null
}

export function parseExportArgs(argv: readonly string[]): ExportArgs | 'help' {
  const values = new Map<string, string>()
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? ''
    if (arg === '--help' || arg === '-h') return 'help'
    const [flag, inline] = arg.includes('=')
      ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)]
      : [arg, undefined]
    const known = ['--period', '--month', '--from', '--to', '--project', '--format', '--output']
    if (!known.includes(flag ?? '')) {
      throw new UsageError(t('usage.cli.unknownArgument', { argument: arg }))
    }
    const value = inline ?? argv[++i]
    if (value === undefined) throw new UsageError(t('usage.cli.needsValue', { flag: flag ?? '' }))
    values.set(flag ?? '', value)
  }
  checkPeriodFlags(values)
  const format = values.get('--format') ?? 'jsonl'
  if (!(FORMATS as readonly string[]).includes(format)) {
    throw new UsageError(
      t('usage.cli.badChoice', { flag: '--format', value: format, choices: FORMATS.join(', ') }),
    )
  }
  return {
    which: whichOf(values),
    project: values.get('--project') ?? null,
    format: format as ExportArgs['format'],
    output: values.get('--output') ?? null,
  }
}

function readJsonFile(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null // missing or not JSON: read as nothing, never repaired from here
  }
}

// Each session's project and each project's name, from Menkar's projects.json, read only.
export function readMemberships(configDir: string): Memberships {
  const data = readJsonFile(join(configDir, 'projects.json'))
  if (!isObject(data) || !Array.isArray(data.projects)) return NO_MEMBERSHIPS
  const sessions = new Map<string, { id: string; name: string }>()
  const projectNames = new Map<string, string>()
  for (const project of data.projects) {
    if (!isObject(project) || typeof project.id !== 'string' || typeof project.name !== 'string')
      continue
    projectNames.set(project.id, project.name)
    for (const member of Array.isArray(project.members) ? project.members : []) {
      if (typeof member === 'string') sessions.set(member, { id: project.id, name: project.name })
    }
  }
  return { sessions, projectNames }
}

// Whether "Classify turns" is on, from state.json, read only.
export function readClassifying(configDir: string): boolean {
  const data = readJsonFile(join(configDir, 'state.json'))
  const settings = isObject(data) ? data.settings : null
  return (
    isObject(settings) && settings.classify_since !== undefined && settings.classify_since !== null
  )
}

function boundsOf(which: Which, history: UsageHistory, nowSeconds: number): Bounds {
  switch (which.kind) {
    case 'month':
      return monthBounds(which.year, which.month)
    case 'range':
      return rangeBounds(which.from, which.to)
    case 'period':
      return which.period === 'all'
        ? allBounds(history.firstOpened(), nowSeconds)
        : periodBounds(which.period, nowSeconds)
  }
}

const COLUMN = 44

function label(node: Node): string {
  if (node.kind === 'project' && node.label === NO_PROJECT) return t('usage.noProject')
  if (node.kind === 'category' && node.label === UNCLASSIFIED) return t('usage.unclassified')
  return node.label
}

export function printText(result: Report, output: Output): void {
  if (result.tooNew) {
    output.out(t('usage.tooNew'))
    return
  }
  const row = (name: string, cells: string[]) =>
    `${name.padEnd(COLUMN)} ${cells[0]?.padStart(7)} ${cells[1]?.padStart(8)} ${cells[2]?.padStart(8)} ${cells[3]?.padStart(9)}`
  output.out(
    row('', [
      t('usage.cli.exec'),
      t('usage.cli.blocked'),
      t('usage.cli.tokens'),
      t('usage.cli.cost'),
    ]),
  )
  const line = (node: Node, depth: number) => {
    const name = `${'  '.repeat(depth)}${label(node)}`.slice(0, COLUMN)
    output.out(
      row(name, [
        formatDuration(totalExecution(node)),
        formatDuration(node.blocked),
        formatTokens(totalTokens(node.tokens)),
        formatCost(node),
      ]),
    )
    for (const child of node.children) line(child, depth + 1)
  }
  for (const node of result.nodes) line(node, 0)
  if (result.limits) {
    output.out('')
    output.out(
      t('usage.cli.subscription', {
        five: formatPercent(result.limits[0]),
        seven: formatPercent(result.limits[1]),
      }),
    )
  }
  output.out(t('usage.cli.legend'))
}

export interface CliDeps {
  readonly passPaths?: PassPaths
  readonly configDir?: string
  readonly statuslineLogs?: readonly string[]
}

// `menkar usage`: a pass, then the report for the period, as text or JSON. The exit code.
// The text written whole: a temporary file beside it, then a rename, so a reader never sees half.
function writeWhole(path: string, text: string): void {
  const temporary = `${path}.${process.pid}.tmp`
  writeFileSync(temporary, text)
  renameSync(temporary, path)
}

function runExport(argv: readonly string[], output: Output, deps: CliDeps): number {
  let args: ExportArgs | 'help'
  try {
    args = parseExportArgs(argv)
  } catch (error) {
    if (!(error instanceof UsageError)) throw error
    output.err(`${t('usage.cli.usage')} ${EXPORT_USAGE}`)
    output.err(t('usage.cli.error', { message: error.message }))
    return 2
  }
  if (args === 'help') {
    output.out(`${t('usage.cli.usage')} ${EXPORT_USAGE}`)
    output.out(t('usage.cli.exportHelp'))
    return 0
  }
  const configDir = deps.configDir ?? appDirs().config
  const passPaths = deps.passPaths ?? defaultPassPaths()
  const memberships = readMemberships(configDir)
  try {
    runPass(memberships, passPaths)
  } catch {
    output.err(t('usage.cli.passFailed'))
  }
  let history: UsageHistory
  try {
    history = new UsageHistory(passPaths.history)
  } catch {
    output.err(t('usage.cli.cannotOpen'))
    return 1
  }
  try {
    let project: string | undefined
    if (args.project !== null) {
      const labels = history.projectLabels(memberships.projectNames)
      for (const [id, name] of memberships.projectNames) if (!labels.has(id)) labels.set(id, name)
      project = [...labels].find(([, name]) => name === args.project)?.[0]
      if (project === undefined) {
        const known = [...new Set(labels.values())].sort((a, b) => a.localeCompare(b))
        output.err(`${t('usage.cli.usage')} ${EXPORT_USAGE}`)
        output.err(
          t('usage.cli.error', {
            message: t('usage.cli.unknownProject', {
              name: args.project,
              known: known.map((name) => `'${name}'`).join(', '),
            }),
          }),
        )
        return 2
      }
    }
    const rows = exportRows(history, boundsOf(args.which, history, now() / 1000), {
      projectNames: memberships.projectNames,
      statuslineLogs: deps.statuslineLogs ?? [importedStatuslineLogPath(), statuslineLogPath()],
      ...(project === undefined ? {} : { project }),
    })
    const text = args.format === 'csv' ? exportCsv(rows) : exportJsonl(rows)
    if (args.output === null) {
      if (text !== '') output.out(text.replace(/\n$/, ''))
      return 0
    }
    try {
      writeWhole(args.output, text)
    } catch {
      output.err(t('usage.cli.cannotWrite', { path: args.output }))
      return 1
    }
    return 0
  } finally {
    history.close()
  }
}

export function runUsageCli(argv: readonly string[], output: Output, deps: CliDeps = {}): number {
  if (argv[0] === 'export') return runExport(argv.slice(1), output, deps)
  let options: Options
  try {
    options = parseArgs(argv)
  } catch (error) {
    if (!(error instanceof UsageError)) throw error
    output.err(`${t('usage.cli.usage')} ${USAGE}`)
    output.err(t('usage.cli.error', { message: error.message }))
    return 2
  }
  const configDir = deps.configDir ?? appDirs().config
  const passPaths = deps.passPaths ?? defaultPassPaths()
  const logs = deps.statuslineLogs ?? [importedStatuslineLogPath(), statuslineLogPath()]
  const memberships = readMemberships(configDir)
  // The text report stays project → session; categories come only in JSON.
  const categories = options.json && readClassifying(configDir)
  try {
    runPass(memberships, passPaths)
  } catch {
    output.err(t('usage.cli.passFailed'))
  }
  let history: UsageHistory
  try {
    history = new UsageHistory(passPaths.history)
  } catch {
    output.err(t('usage.cli.cannotOpen'))
    return 1
  }
  try {
    const bounds = boundsOf(options.which, history, now() / 1000)
    const reportOptions = {
      projectNames: memberships.projectNames,
      categories,
      statuslineLogs: logs,
    }
    if (options.by === null) {
      const result = buildReport(history, bounds, reportOptions)
      if (options.json) output.out(JSON.stringify(reportJson(result), null, 2))
      else printText(result, output)
      return 0
    }
    const results = buildSeries(history, bounds, options.by, reportOptions)
    if (options.json) {
      output.out(JSON.stringify(results.map(reportJson), null, 2))
      return 0
    }
    for (const result of results) {
      if (result.nodes.length === 0 && !result.tooNew) continue
      output.out('')
      output.out(`== ${localMinute(result.bounds.start)} – ${localMinute(result.bounds.end)}`)
      printText(result, output)
    }
    return 0
  } finally {
    history.close()
  }
}
