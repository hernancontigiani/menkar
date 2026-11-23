import { join } from 'node:path'
import { Worker } from 'node:worker_threads'
import { log } from '../../log'
import { programsFolder } from '../../paths'
import { type Answer, answer, type Request } from './store'

// Where the catalog's reads of OpenCode's database run.
export interface DbReads {
  ask<R extends Request>(request: R): Promise<Answer<R>>
  // Ends what runs the reads; the next ask starts it again.
  close(): void
  readonly running: boolean
}

interface Waiting {
  resolve(value: unknown): void
  reject(error: Error): void
}

// One long-lived worker thread, started at the first read. It never keeps the app from quitting.
export function workerReads(file: string): DbReads {
  let worker: Worker | null = null
  let next = 0
  const waiting = new Map<number, Waiting>()

  const fail = (error: Error) => {
    for (const w of waiting.values()) w.reject(error)
    waiting.clear()
  }

  const start = (): Worker => {
    const started = new Worker(file)
    started.unref()
    started.on('message', (reply: { id: number; value?: unknown; error?: string }) => {
      const w = waiting.get(reply.id)
      waiting.delete(reply.id)
      if (reply.error !== undefined) w?.reject(new Error(reply.error))
      else w?.resolve(reply.value)
    })
    started.on('error', (error) => {
      log.warn("OpenCode's database reader stopped", { error })
      if (worker === started) worker = null
      fail(error)
    })
    started.on('exit', (code) => {
      if (worker === started) worker = null
      fail(new Error(`the reader exited with code ${code}`))
    })
    return started
  }

  return {
    ask<R extends Request>(request: R): Promise<Answer<R>> {
      worker ??= start()
      const id = next++
      const promise = new Promise<Answer<R>>((resolve, reject) => {
        waiting.set(id, { resolve: (value) => resolve(value as Answer<R>), reject })
      })
      worker.postMessage({ id, request })
      return promise
    },
    close(): void {
      const ending = worker
      worker = null
      if (ending) void ending.terminate()
    },
    get running(): boolean {
      return worker !== null
    },
  }
}

// The reads on the calling thread: for a test, which has no built worker file to start.
export function inProcessReads(): DbReads {
  return {
    ask: async (request) => answer(request),
    close: () => {},
    running: false,
  }
}

let reads: DbReads | null = null

// The worker's file is built beside main's entry, not beside this module's chunk.
export function dbReads(): DbReads {
  reads ??= workerReads(join(programsFolder(), 'opencode-db.js'))
  return reads
}

// Ends the reads' thread, if any was made.
export function closeReads(): void {
  reads?.close()
}

export function useReads(chosen: DbReads): void {
  reads?.close()
  reads = chosen
}
