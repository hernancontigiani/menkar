import { spawnSync } from 'node:child_process'
import { accessSync, constants, mkdirSync, statSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { log } from '../log'
import { appDirs } from '../paths'
import type { UsageCache } from '../usage/cache'
import type { UsageHistory } from '../usage/history'
import { batchInput, command, environment, parseReply, type TurnText } from './input'
import {
  BATCH,
  CALLS_PER_PASS,
  COST_PER_TURN,
  EARLIER_ORIGINS,
  HOURLY_ORIGINS,
  SECONDS_PER_CALL,
  STDERR_KEPT,
  TIMEOUT_MS,
} from './prompt'
import { callsFor, earlierTurns, readTurn, readyTurns } from './turns'

// What a run did, kept as the setting `classify_last` and shown under the switch.
export interface RunResult {
  readonly at: number
  readonly classified: number
  readonly failed: boolean
}

// An empty folder of the app's own, so `claude -p` runs nowhere near a project.
export function classifierFolder(): string {
  return join(appDirs().data, 'classifier')
}

export function findClaude(path = process.env.PATH ?? ''): string | null {
  for (const dir of path.split(delimiter)) {
    if (!dir) continue
    const candidate = join(dir, 'claude')
    try {
      if (statSync(candidate).isFile()) {
        accessSync(candidate, constants.X_OK)
        return candidate
      }
    } catch {
      // not in this folder
    }
  }
  return null
}

// One call to Haiku: its stdout, or null when `claude` could not run, failed or took too long. A
// null charges no turn a try: the run stops and is recorded as failed.
export type Call = (input: string) => string | null

export function claudeCall(cli: string): Call {
  return (input) => {
    const folder = classifierFolder()
    mkdirSync(folder, { recursive: true })
    const done = spawnSync(cli, [...command()], {
      input,
      cwd: folder,
      env: environment(process.env),
      encoding: 'utf8',
      timeout: TIMEOUT_MS,
      maxBuffer: 16 * 1024 * 1024,
    })
    if (done.error) {
      log.warn('classifier: claude did not run', { error: done.error })
      return null
    }
    if (done.status !== 0) {
      log.warn('classifier: claude failed', {
        status: done.status,
        signal: done.signal,
        stderr: (done.stderr ?? '').slice(-STDERR_KEPT),
      })
      return null
    }
    return done.stdout
  }
}

// One batch: the categories it answered are written, a try is counted for each turn it did not
// answer. Null when the call could not run.
function send(
  history: UsageHistory,
  call: Call,
  batch: readonly [string, TurnText][],
): number | null {
  const stdout = call(batchInput(batch.map(([, text]) => text)))
  if (stdout === null) return null
  const answers = parseReply(stdout, batch.length)
  history.setCategories(
    new Map([...answers].map(([i, category]) => [batch[i]?.[0] ?? '', category])),
  )
  history.countTry(batch.filter((_, i) => !answers.has(i)).map(([uuid]) => uuid))
  return answers.size
}

// The hourly pass: up to ten batches of the oldest ready turns the human typed since the switch
// was turned on. A turn whose text cannot be read counts a try and is left out.
export function classifyPass(
  history: UsageHistory,
  cache: UsageCache,
  since: number,
  nowSeconds: number,
  call: Call | null,
): RunResult {
  if (call === null) return { at: nowSeconds, classified: 0, failed: true }
  let classified = 0
  const waiting = readyTurns(history, since, nowSeconds, HOURLY_ORIGINS)
  for (let n = 0; n < CALLS_PER_PASS; n += 1) {
    const chunk = waiting.slice(n * BATCH, (n + 1) * BATCH)
    if (chunk.length === 0) break
    const texts = chunk.map((uuid) => [uuid, readTurn(cache, uuid)] as const)
    history.countTry(texts.filter(([, text]) => text === null).map(([uuid]) => uuid))
    const sent = texts.filter((entry): entry is [string, TurnText] => entry[1] !== null)
    if (sent.length === 0) continue
    const answered = send(history, call, sent)
    if (answered === null) return { at: nowSeconds, classified, failed: true }
    classified += answered
  }
  return { at: nowSeconds, classified, failed: false }
}

export interface Estimate {
  // with a transcript: they will be sent
  readonly turns: number
  readonly calls: number
  // their transcript is gone: left unclassified
  readonly unavailable: number
  readonly dollars: number
  readonly seconds: number
}

// What classifying the turns since a moment would send, before anything is sent.
export function estimate(
  history: UsageHistory,
  cache: UsageCache,
  since: number,
  nowSeconds: number,
): Estimate {
  const { found, missing } = earlierTurns(history, cache, since, nowSeconds, EARLIER_ORIGINS)
  const calls = callsFor(found.length)
  return {
    turns: found.length,
    calls,
    unavailable: missing,
    dollars: found.length * COST_PER_TURN,
    seconds: calls * SECONDS_PER_CALL,
  }
}

// Every earlier turn since a moment, with no cap per pass. `stopped` is asked before each call, so
// a stop ends the run after the call in flight; a turn whose text can no longer be read is skipped
// with no try counted.
export function classifyEarlier(
  history: UsageHistory,
  cache: UsageCache,
  since: number,
  nowSeconds: number,
  call: Call | null,
  progress: (sent: number, total: number) => void = () => {},
  stopped: () => boolean = () => false,
): RunResult {
  if (call === null) return { at: nowSeconds, classified: 0, failed: true }
  const { found } = earlierTurns(history, cache, since, nowSeconds, EARLIER_ORIGINS)
  let classified = 0
  progress(0, found.length)
  for (let start = 0; start < found.length; start += BATCH) {
    if (stopped()) break
    const batch = found
      .slice(start, start + BATCH)
      .map((uuid) => [uuid, readTurn(cache, uuid)] as const)
      .filter((entry): entry is [string, TurnText] => entry[1] !== null)
    const answered = batch.length > 0 ? send(history, call, batch) : 0
    if (answered === null) return { at: nowSeconds, classified, failed: true }
    classified += answered
    progress(Math.min(start + BATCH, found.length), found.length)
  }
  return { at: nowSeconds, classified, failed: false }
}
