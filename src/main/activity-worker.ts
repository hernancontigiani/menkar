import { parentPort } from 'node:worker_threads'
import { UsageHistory } from '../core/usage/history'

// The activity journal's batches into the usage history, on a thread of its own: its SQLite is
// synchronous.
const history = new UsageHistory()
try {
  parentPort?.postMessage(history.importActivityDir())
} finally {
  history.close()
}
