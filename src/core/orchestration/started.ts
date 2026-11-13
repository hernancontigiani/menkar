import type { Projects } from '../projects/model'
import { setRole } from '../projects/orchestration'
import { clearParent, setParent } from '../projects/parents'

export interface Placement {
  // No parent: a consultant in the mode, never woken for and never read only (decision 1.111).
  readonly loose: boolean
  // The label it is born with; '' for none.
  readonly role: string
}

// start_session's loose and role, in English for the agent that called.
export function readPlacement(
  args: Readonly<Record<string, unknown>>,
): Placement | { readonly refusal: string } {
  if (args.loose !== undefined && typeof args.loose !== 'boolean')
    return { refusal: 'loose must be true or false.' }
  if (args.role !== undefined && typeof args.role !== 'string')
    return { refusal: 'The role must be text.' }
  return { loose: args.loose === true, role: typeof args.role === 'string' ? args.role.trim() : '' }
}

// Where a session start_session started sits: under its caller unless loose, with its label.
export function placeStarted(
  state: Projects,
  projectId: string,
  id: string,
  caller: string,
  placement: Placement,
): Projects {
  const placed = placement.loose ? clearParent(state, id) : setParent(state, id, caller)
  return placement.role ? setRole(placed, projectId, id, placement.role) : placed
}
