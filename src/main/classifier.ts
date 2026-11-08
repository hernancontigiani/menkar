import { join } from 'node:path'
import { Worker } from 'node:worker_threads'
import { ipcMain } from 'electron'
import { ClassifierLock } from '../core/classifier/lock'
import type { Estimate, RunResult } from '../core/classifier/run'
import { classifyLast, classifySince, withLastRun, withSwitch } from '../core/classifier/settings'
import { estimateLines, progressText, statusText } from '../core/classifier/text'
import { now } from '../core/clock'
import { t } from '../core/i18n'
import { log } from '../core/log'
import { midnight } from '../core/usage/periods'
import type { ClassifierStatus, InvokeChannel, InvokeChannels } from '../shared/ipc'
import { sessions } from './sessions'

const lock = new ClassifierLock()
// [stop requested, sent, total] of the earlier-turns run, shared with its worker.
let flags: Int32Array | null = null

function inWorker<T>(
  kind: 'hourly' | 'earlier' | 'estimate',
  since: number,
  shared: Int32Array,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(join(import.meta.dirname, 'classifier-worker.js'), {
      workerData: { kind, since, now: now() / 1000, flags: shared },
    })
    let answer: { value: T } | null = null
    worker.once('message', (value: T) => {
      answer = { value }
    })
    worker.once('error', reject)
    worker.once('exit', (code) => {
      if (answer) resolve(answer.value)
      else reject(new Error(`classifier worker exited with code ${code}`))
    })
  })
}

const freshFlags = () => new Int32Array(new SharedArrayBuffer(3 * Int32Array.BYTES_PER_ELEMENT))

async function record(result: RunResult): Promise<void> {
  await sessions.updateState((state) => ({ ...state, rest: withLastRun(state.rest, result) }))
}

const failed = (): RunResult => ({ at: now() / 1000, classified: 0, failed: true })

// After each usage pass, while the switch is on: the turns typed since it was turned on.
export async function classifyAfterUsagePass(): Promise<void> {
  const since = classifySince((await sessions.currentState()).rest)
  if (since === null) return
  const result = await lock.hourly(() =>
    inWorker<RunResult>('hourly', since, freshFlags()).catch((error: unknown) => {
      log.warn('classification pass failed', { error })
      return failed()
    }),
  )
  if (result !== null) await record(result)
}

async function status(): Promise<ClassifierStatus> {
  const rest = (await sessions.currentState()).rest
  const nowSeconds = now() / 1000
  const progress =
    flags !== null && lock.classifyingEarlier
      ? progressText(Atomics.load(flags, 1), Atomics.load(flags, 2))
      : null
  return {
    on: classifySince(rest) !== null,
    status: statusText(classifyLast(rest), nowSeconds),
    progress,
  }
}

function sinceDay(day: string): number {
  const [year, month, date] = day.split('-').map(Number)
  return midnight({ year: year ?? 1970, month: month ?? 1, day: date ?? 1 })
}

async function estimateFor(
  day: string,
): Promise<InvokeChannels['classifier:estimate']['response']> {
  try {
    const found = await inWorker<Estimate>('estimate', sinceDay(day), freshFlags())
    return { turns: found.turns, lines: estimateLines(found) }
  } catch (error) {
    log.warn('classification estimate failed', { error })
    return { turns: 0, lines: [t('classifier.historyUnreadable')] }
  }
}

// Earlier turns from a day on, in the background: it waits for an hourly pass in flight, then
// re-reads what is still unclassified.
function classifyEarlierFrom(day: string): void {
  const shared = freshFlags()
  void lock
    .earlier(async () => {
      flags = shared
      try {
        return await inWorker<RunResult>('earlier', sinceDay(day), shared)
      } catch (error) {
        log.warn('classifying earlier turns failed', { error })
        return failed()
      }
    })
    .then(record)
    .finally(() => {
      if (flags === shared) flags = null
    })
}

function handle<C extends InvokeChannel>(
  channel: C,
  handler: (request: InvokeChannels[C]['request']) => Promise<InvokeChannels[C]['response']>,
): void {
  ipcMain.handle(channel, (_event, request: InvokeChannels[C]['request']) => handler(request))
}

// What the Integrations page and the earlier-turns dialog will ask.
export function registerClassifierIpc(): void {
  handle('classifier:status', () => status())
  handle('classifier:set', async ({ on }) => {
    await sessions.updateState((state) => ({
      ...state,
      rest: withSwitch(state.rest, on, now() / 1000),
    }))
    return status()
  })
  handle('classifier:estimate', ({ day }) => estimateFor(day))
  handle('classifier:classify-earlier', async ({ day }) => {
    classifyEarlierFrom(day)
    return undefined
  })
  handle('classifier:stop', async () => {
    if (flags !== null) Atomics.store(flags, 0, 1)
    return undefined
  })
}
