import { readdir, readFile, readlink } from 'node:fs/promises'
import { heldThread } from '../../../core/agents/codex/binding'
import type { EarlyBind } from '../types'

// Codex creates a new thread's rollout when the session starts and keeps it open, so the file its
// process holds names the thread before any turn ends, and ties it to this pane's own process: two
// sessions in one folder cannot be confused. Linux only; elsewhere /proc does not exist and the pane
// binds on its first turn's end.

const MAX_DEPTH = 4

async function children(pid: number): Promise<number[]> {
  let tasks: string[]
  try {
    tasks = await readdir(`/proc/${pid}/task`)
  } catch {
    return [] // gone, or no /proc
  }
  const found: number[] = []
  for (const task of tasks) {
    const text = await readFile(`/proc/${pid}/task/${task}/children`, 'utf8').catch(() => '')
    for (const child of text.trim().split(/\s+/)) if (/^\d+$/.test(child)) found.push(Number(child))
  }
  return found
}

async function openFiles(pid: number): Promise<string[]> {
  let fds: string[]
  try {
    fds = await readdir(`/proc/${pid}/fd`)
  } catch {
    return [] // gone, or not ours to read
  }
  const links = await Promise.all(
    fds.map((fd) => readlink(`/proc/${pid}/fd/${fd}`).catch(() => '')),
  )
  return links.filter(Boolean)
}

// The open files of every process under the pane's shell, a few levels deep: Codex's launcher
// runs the binary that holds the rollout.
export async function descendantsFiles(shellPid: number): Promise<string[]> {
  const links: string[] = []
  let level = [shellPid]
  for (let depth = 0; depth < MAX_DEPTH && level.length > 0; depth += 1) {
    const next: number[] = []
    for (const pid of level) next.push(...(await children(pid)))
    for (const pid of next) links.push(...(await openFiles(pid)))
    level = next
  }
  return links
}

export const bind: EarlyBind = {
  find: async (shellPid) => heldThread(await descendantsFiles(shellPid)),
}
