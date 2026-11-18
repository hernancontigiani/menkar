import type { SessionIdByName } from './record'

export interface NamedSession {
  readonly id: string
  readonly name: string
  readonly mtimeMs: number
}

interface Memberships {
  readonly projects: readonly { readonly id: string; readonly members: readonly string[] }[]
}

// A name is not unique: a renewed session keeps it under a new id, so the newest one is meant.
// A worker whose transcript is not listed yet is not found, and its wait is recorded as `other`.
export function sessionIdByName(
  sessions: readonly NamedSession[],
  projects: Memberships | undefined,
): SessionIdByName {
  return (projectId, name) => {
    const members = new Set(projects?.projects.find((p) => p.id === projectId)?.members)
    let found: NamedSession | undefined
    for (const session of sessions) {
      if (session.name !== name || !members.has(session.id)) continue
      if (found === undefined || session.mtimeMs > found.mtimeMs) found = session
    }
    return found?.id
  }
}
