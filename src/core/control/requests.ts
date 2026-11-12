import { readdir, readFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { log } from '../log'
import {
  type ControlAnswer,
  type ControlRequest,
  controlPaths,
  TOOL_NAMES,
  writeAtomic,
} from './files'

// Main's side of the request files. Main runs a pass on every change in `requests/` and once a
// second, so a pass may meet a request another pass is still handling: each id is taken once.

export const REQUEST_MAX_AGE_MS = 60_000
const UNREADABLE = 'Menkar could not read this request.'
// Ids taken are remembered this long, well past the oldest request still answered.
const REMEMBER_MS = 5 * REQUEST_MAX_AGE_MS
const ID = /^[A-Za-z0-9-]{1,80}$/

function parseRequest(text: string): ControlRequest | null {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    if (error instanceof SyntaxError) return null
    throw error
  }
  if (typeof value !== 'object' || value === null) return null
  const r = value as Record<string, unknown>
  if (typeof r.id !== 'string' || !ID.test(r.id)) return null
  if (typeof r.pane !== 'string' || r.pane === '') return null
  if (typeof r.tool !== 'string' || !(TOOL_NAMES as readonly string[]).includes(r.tool)) return null
  if (typeof r.at !== 'number') return null
  const args: Record<string, unknown> =
    typeof r.args === 'object' && r.args !== null && !Array.isArray(r.args)
      ? { ...(r.args as Record<string, unknown>) }
      : {}
  return { id: r.id, pane: r.pane, tool: r.tool as ControlRequest['tool'], args, at: r.at }
}

const gone = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT'

export class RequestQueue {
  private readonly taken = new Map<string, number>()

  constructor(
    private readonly handle: (request: ControlRequest) => Promise<ControlAnswer>,
    private readonly now: () => number,
  ) {}

  async pass(): Promise<void> {
    const { requests, responses } = controlPaths()
    let names: string[]
    try {
      names = await readdir(requests)
    } catch (error) {
      if (gone(error)) return
      throw error
    }
    const at = this.now()
    for (const [id, when] of this.taken) if (at - when > REMEMBER_MS) this.taken.delete(id)
    await Promise.all(
      names
        .filter((name) => name.endsWith('.json'))
        .map(async (name) => {
          const id = name.slice(0, -'.json'.length)
          if (this.taken.has(id) || !ID.test(id)) return
          this.taken.set(id, at)
          const path = join(requests, name)
          let text: string
          try {
            text = await readFile(path, 'utf8')
          } catch (error) {
            if (gone(error)) return // taken back by the server, which stopped waiting
            throw error
          }
          await unlink(path).catch((error: unknown) => {
            if (!gone(error)) throw error
          })
          const request = parseRequest(text)
          if (!request || request.id !== id) {
            log.warn('a control request could not be read', { id })
            await writeAtomic(responses, name, { id, ok: false, text: UNREADABLE })
            return
          }
          if (at - request.at > REQUEST_MAX_AGE_MS) {
            log.warn('a control request was too old to answer', { id, tool: request.tool })
            return
          }
          const answer = await this.handle(request)
          await writeAtomic(responses, name, { id, ok: answer.ok, text: answer.text })
        }),
    )
  }
}
