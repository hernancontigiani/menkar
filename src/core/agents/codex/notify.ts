// Codex's `notify` program for the sessions Menkar starts: Codex runs it at each turn's end with one
// JSON argument. It tells Menkar which thread the pane's turn ran under, then runs the user's own
// `notify`, which Menkar's `-c notify` replaced for the session, with the same argument.
//
// Electron's binary runs it as plain Node, inside Codex's process tree, whether or not Menkar is
// running. Whatever goes wrong with Menkar's record, the user's own program still runs.
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { controlPaths } from '../../control/files'
import { writeTurnEnd } from '../shared/turn-end'
import { findRollout } from './binding'
import { codexHome } from './config'

export interface NotifyArgs {
  readonly pane: string | null
  readonly chainFile: string | null
  // Codex's JSON argument, passed on as it came.
  readonly payload: string | null
}

// `--pane <pane> --chain-file <file>`, then the argument Codex appends.
export function parseArgs(argv: readonly string[]): NotifyArgs {
  const flags = new Map<string, string>()
  const words: string[] = []
  for (let i = 0; i < argv.length; i += 1) {
    const word = argv[i] ?? ''
    if ((word === '--pane' || word === '--chain-file') && i + 1 < argv.length) {
      flags.set(word, argv[i + 1] ?? '')
      i += 1
    } else words.push(word)
  }
  return {
    pane: flags.get('--pane') ?? null,
    chainFile: flags.get('--chain-file') ?? null,
    payload: words.at(-1) ?? null,
  }
}

const isThreadId = (id: unknown): id is string =>
  typeof id === 'string' && /^[0-9a-fA-F-]{8,64}$/.test(id)

export function threadOf(payload: string): string | null {
  try {
    const value: unknown = JSON.parse(payload)
    if (typeof value !== 'object' || value === null) return null
    const id = (value as Record<string, unknown>)['thread-id']
    return isThreadId(id) ? id : null
  } catch {
    return null // not Codex's argument
  }
}

function chained(file: string): string[] {
  try {
    const value: unknown = JSON.parse(readFileSync(file, 'utf8'))
    return Array.isArray(value) && value.length > 0 && value.every((w) => typeof w === 'string')
      ? value
      : []
  } catch {
    return [] // no file, or not one Menkar wrote: nothing to chain
  }
}

export async function runNotify(
  argv: readonly string[],
  where: { sessions: string; turnEnds: string } = {
    sessions: join(codexHome(), 'sessions'),
    turnEnds: controlPaths().turnEnds,
  },
): Promise<void> {
  const args = parseArgs(argv)
  try {
    const id = args.payload === null ? null : threadOf(args.payload)
    if (args.pane && id && (await findRollout(where.sessions, id)) !== null)
      writeTurnEnd(where.turnEnds, args.pane, id)
  } catch {
    // A full disk or a read-only cache costs Menkar a record, never the user's program.
  }
  const program = args.chainFile ? chained(args.chainFile) : []
  const [command, ...rest] = program
  if (command === undefined || args.payload === null) return
  // Not waited for, as Codex does not wait for the user's program when it runs it itself.
  const child = spawn(command, [...rest, args.payload], { stdio: 'ignore', detached: true })
  child.on('error', () => {}) // a program the user's config names but that is not there
  child.unref()
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void runNotify(process.argv.slice(2))
