import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { controlPaths, writeTextAtomic } from '../control/files'
import { log } from '../log'
import type { TeamText } from './posts'

// What a session of an agent that records its block held when it last ran: a resume starts from
// it. One file per session, written whole; a session held nothing is recorded as such.

const SAFE_ID = /^[\w-]+$/

const fileName = (sessionId: string) => `${sessionId}.json`

function parse(text: string): TeamText | null {
  const value: unknown = JSON.parse(text)
  if (value === null) return null
  if (
    typeof value === 'object' &&
    'facts' in value &&
    'block' in value &&
    typeof value.facts === 'string' &&
    typeof value.block === 'string'
  )
    return { facts: value.facts, block: value.block }
  throw new Error('not a recorded team block')
}

// Null when nothing was recorded, or what was cannot be read: the session is then taken to hold no
// block, and is told the whole of it.
export async function readRecorded(sessionId: string): Promise<TeamText | null> {
  if (!SAFE_ID.test(sessionId)) return null
  const path = join(controlPaths().teamHeld, fileName(sessionId))
  try {
    return parse(await readFile(path, 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      log.warn('a recorded team block could not be read; taken as none', { path, error })
    return null
  }
}

export async function writeRecorded(sessionId: string, held: TeamText | null): Promise<void> {
  if (!SAFE_ID.test(sessionId)) return
  const text = JSON.stringify(held === null ? null : { facts: held.facts, block: held.block })
  await writeTextAtomic(controlPaths().teamHeld, fileName(sessionId), text)
}

export async function forgetRecorded(sessionId: string): Promise<void> {
  if (!SAFE_ID.test(sessionId)) return
  await rm(join(controlPaths().teamHeld, fileName(sessionId)), { force: true })
}
