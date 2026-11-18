import type { ActivityView } from '../core/usage/nodes'
import type { SectionBody, SectionContext } from './usage'

// Your time: a day by the hour, or a week as a strip per day.
export function timeBody(_view: ActivityView, _ctx: SectionContext): SectionBody {
  return { nodes: [] }
}
