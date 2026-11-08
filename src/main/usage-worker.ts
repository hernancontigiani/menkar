import { parentPort, workerData } from 'node:worker_threads'
import type { Memberships } from '../core/usage/history'
import { runPass } from '../core/usage/pass'

// One usage pass on a thread of its own: its SQLite and file reads are synchronous.
runPass(workerData as Memberships)
parentPort?.postMessage('done')
