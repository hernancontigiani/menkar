import { stat } from 'node:fs/promises'
import { now } from '../core/clock'
import { log } from '../core/log'
import { Inbox, sequence } from '../core/orchestration/inbox'
import type { PromptInbox } from './agents/types'

// Each orchestration-mode project's inbox, kept in memory, and the file its orchestrator's prompt
// hook reads: written for the pane the orchestrator runs in now, rewritten when that pane or its
// session id changes (a renew, a clear, a resume, the mark moving), removed when the pane exits.
// What reached the model is read back from the orchestrator's transcript, never from the hook.

// Where a project's orchestrator runs now.
export interface OrchestratorPane {
  readonly pane: string
  readonly sessionId: string
  // Null while the session's transcript is not known yet.
  readonly transcript: string | null
  // Null for an agent whose orchestrator cannot be given an inbox.
  readonly kit: PromptInbox | null
}

interface Target {
  readonly pane: string
  readonly sessionId: string
  readonly kit: PromptInbox
}

interface Reading {
  readonly sessionId: string
  file: string | null
  offset: number
  inode: number | null
}

interface ProjectInbox {
  readonly inbox: Inbox
  // The pane whose file was last written, and what it held.
  shown: (Target & { readonly held: string }) | null
  reading: Reading | null
  queue: Promise<void>
  pending: boolean
}

// Every project in the orchestration mode, with its orchestrator's pane, or null when it has none
// running. A project left out is not in the mode: its inbox goes.
export type Locate = () => ReadonlyMap<string, OrchestratorPane | null>

const sameTarget = (a: Target | null, b: Target | null): boolean =>
  a?.pane === b?.pane && a?.sessionId === b?.sessionId

const errno = (error: unknown): string | undefined => (error as NodeJS.ErrnoException).code

export class Inboxes {
  // One counter for the whole run, never reset: a record the transcript showed earlier in the run
  // never confirms a later entry.
  private readonly nextSeq = sequence()
  private readonly byProject = new Map<string, ProjectInbox>()
  private readonly locate: Locate

  constructor(locate: Locate) {
    this.locate = locate
  }

  // Cheap: compares where each orchestrator runs with the file last written, and only then reads
  // or writes anything.
  sync(): void {
    const where = this.locate()
    for (const [id, orchestrator] of where) {
      const entry = this.entryOf(id)
      if (!sameTarget(entry.shown, targetOf(orchestrator))) this.kick(id)
    }
    for (const id of this.byProject.keys()) if (!where.has(id)) this.kick(id)
  }

  add(projectId: string, key: string, text: string): void {
    if (!this.locate().has(projectId)) return
    this.entryOf(projectId).inbox.add(key, text)
    this.kick(projectId)
  }

  // The orchestrator's pane started or ended a turn: a prompt may have given it its inbox.
  paneTurned(paneId: string): void {
    for (const [id, entry] of this.byProject) if (entry.shown?.pane === paneId) this.kick(id)
  }

  paneExited(paneId: string): void {
    for (const [id, entry] of this.byProject) {
      const shown = entry.shown
      if (shown?.pane !== paneId) continue
      this.serial(id, entry, async () => {
        if (entry.shown?.pane !== paneId) return
        entry.shown = null
        await shown.kit.forget(paneId)
      })
    }
  }

  // The inbox as the transcript leaves it, to answer the inbox tool; what `use` takes is gone from
  // the file too.
  async read<T>(projectId: string, use: (inbox: Inbox | undefined) => T): Promise<T> {
    const entry = this.locate().has(projectId) ? this.entryOf(projectId) : undefined
    if (!entry) return use(undefined)
    let result: T | undefined
    let used = false
    await this.serial(projectId, entry, async () => {
      await this.refresh(projectId, entry, () => {
        result = use(entry.inbox)
        used = true
      })
    })
    return used ? (result as T) : use(entry.inbox)
  }

  private entryOf(id: string): ProjectInbox {
    let entry = this.byProject.get(id)
    if (!entry) {
      entry = {
        inbox: new Inbox(this.nextSeq, now),
        shown: null,
        reading: null,
        queue: Promise.resolve(),
        pending: false,
      }
      this.byProject.set(id, entry)
    }
    return entry
  }

  private kick(id: string): void {
    const entry = this.byProject.get(id)
    if (!entry || entry.pending) return
    entry.pending = true
    void this.serial(id, entry, async () => {
      entry.pending = false
      await this.refresh(id, entry)
    })
  }

  private serial(id: string, entry: ProjectInbox, step: () => Promise<void>): Promise<void> {
    entry.queue = entry.queue.then(step).catch((error: unknown) => {
      log.warn('an orchestrator’s inbox could not be written or confirmed', { project: id, error })
    })
    return entry.queue
  }

  // Confirms what the transcript shows was given, then writes the file where the orchestrator runs
  // now, removing the one of a pane it left.
  private async refresh(id: string, entry: ProjectInbox, between?: () => void): Promise<void> {
    const where = this.locate()
    if (!where.has(id)) {
      const shown = entry.shown
      entry.shown = null
      this.byProject.delete(id)
      if (shown) await shown.kit.forget(shown.pane)
      return
    }
    const orchestrator = where.get(id) ?? null
    const target = targetOf(orchestrator)
    const shown = entry.shown
    if (shown && shown.pane !== target?.pane) {
      entry.shown = null
      await shown.kit.forget(shown.pane)
    }
    if (!target || !orchestrator) {
      entry.reading = null
      between?.()
      return
    }
    if (entry.reading?.sessionId !== target.sessionId)
      entry.reading = await startReading(target.sessionId, orchestrator.transcript)
    await confirm(entry.inbox, entry.reading, orchestrator.transcript, target.kit)
    between?.()
    const list = entry.inbox.entries
    const held = JSON.stringify([target.sessionId, entry.inbox.dropped, list.map((x) => x.seq)])
    if (entry.shown?.pane === target.pane && entry.shown.held === held) return
    await target.kit.publish(target.pane, target.sessionId, entry.inbox.dropped, list)
    entry.shown = { ...target, held }
  }
}

function targetOf(orchestrator: OrchestratorPane | null): Target | null {
  if (!orchestrator?.kit) return null
  return { pane: orchestrator.pane, sessionId: orchestrator.sessionId, kit: orchestrator.kit }
}

// A session first seen is read from its transcript's end, so a record of an earlier run never
// confirms an entry of this one; a transcript not written yet (just after a clear) from its start.
async function startReading(sessionId: string, file: string | null): Promise<Reading> {
  if (!file) return { sessionId, file: null, offset: 0, inode: null }
  try {
    const { size, ino } = await stat(file)
    return { sessionId, file, offset: size, inode: ino }
  } catch (error) {
    if (errno(error) !== 'ENOENT') throw error
    return { sessionId, file, offset: 0, inode: null }
  }
}

async function confirm(
  inbox: Inbox,
  reading: Reading,
  transcript: string | null,
  kit: PromptInbox,
): Promise<void> {
  if (!reading.file) {
    if (!transcript) return
    reading.file = transcript
    reading.offset = 0
  }
  const found = await stat(reading.file).catch((error: unknown) => {
    if (errno(error) === 'ENOENT') return null
    throw error
  })
  if (!found) return
  const { size, ino } = found
  // Another file under the name, or one cut short: read it again from its start.
  if ((reading.inode !== null && ino !== reading.inode) || size < reading.offset) reading.offset = 0
  reading.inode = ino
  const { through, offset } = await kit.delivered(reading.file, reading.offset)
  reading.offset = offset
  if (through > 0) inbox.deliveredThrough(through)
}
