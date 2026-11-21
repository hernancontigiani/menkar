import { parentPort, workerData } from 'node:worker_threads'
import type { Memberships } from '../core/usage/history'
import { runStreamingPass } from '../core/usage/pass'

// One usage pass on a thread of its own: its SQLite and file reads are synchronous, and what can
// only be read as a stream is read before them. A failure ends the thread with its error.
void runStreamingPass(workerData as Memberships).then(() => parentPort?.postMessage('done'))
