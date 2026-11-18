import type { TaskFlowView } from '../core/usage/nodes'
import type { SectionBody, SectionContext } from './usage'

// Task times: the time tasks spent in each state, and whom they waited on.
export function tasksBody(_view: TaskFlowView, _ctx: SectionContext): SectionBody {
  return { nodes: [] }
}
