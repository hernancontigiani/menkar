import { randomUUID } from 'node:crypto'
import type { SessionIds } from '../types'
import { compareVersions } from '../versions'
import { NEW_ID_FLOOR } from './descriptor'

// From its floor on, Cursor starts a new chat under the id it is given (a hidden flag, measured
// there): a new chat's sessionStart hook delivers the team block, which a resumed one never runs.
// Below it, or when the version could not be read, Cursor picks the id and the pane learns it late.
export function takesNewId(installed: string | null | undefined): boolean {
  if (!installed) return false
  const order = compareVersions(installed, NEW_ID_FLOOR)
  return order !== null && order >= 0
}

export const ids: SessionIds = {
  newId: (installed) => (takesNewId(installed) ? randomUUID() : null),
  // The option is hidden from its help: a release may drop it, and Cursor then stops at once.
  refused: /unknown option '--new-session-id'/,
}
