import { parentPort } from 'node:worker_threads'
import { answer, type Request } from './store'

// OpenCode's database read on a thread of its own: node:sqlite and the copy are synchronous.
parentPort?.on('message', ({ id, request }: { id: number; request: Request }) => {
  try {
    parentPort?.postMessage({ id, value: answer(request) })
  } catch (error) {
    parentPort?.postMessage({ id, error: error instanceof Error ? error.message : String(error) })
  }
})
