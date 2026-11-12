import { parentPort, workerData } from 'node:worker_threads'
import {
  classifyEarlier,
  classifyPass,
  claudeCall,
  estimate,
  findClaude,
} from '../core/classifier/run'
import { cachePath, UsageCache } from '../core/usage/cache'
import { historyPath, UsageHistory } from '../core/usage/history'

// One classification job on a thread of its own: its SQLite reads and its calls to `claude` are
// synchronous. `flags` is shared with main: [stop requested, sent, total].
interface Job {
  readonly kind: 'hourly' | 'earlier' | 'estimate'
  readonly since: number
  readonly now: number
  readonly flags: Int32Array
}

const job = workerData as Job
const history = new UsageHistory(historyPath())
const cache = new UsageCache(cachePath())
try {
  if (job.kind === 'estimate') {
    parentPort?.postMessage(estimate(history, cache, job.since, job.now))
  } else {
    const cli = findClaude()
    const call = cli === null ? null : claudeCall(cli)
    parentPort?.postMessage(
      job.kind === 'hourly'
        ? classifyPass(history, cache, job.since, job.now, call)
        : classifyEarlier(
            history,
            cache,
            job.since,
            job.now,
            call,
            (sent, total) => {
              Atomics.store(job.flags, 1, sent)
              Atomics.store(job.flags, 2, total)
            },
            () => Atomics.load(job.flags, 0) === 1,
          ),
    )
  }
} finally {
  history.close()
  cache.close()
}
