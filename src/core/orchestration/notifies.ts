import type { Project } from '../projects/model'
import { keptOrchestration } from '../projects/orchestration'
import { keptParents } from '../projects/parents'

// Whether a session's done or blocked raises a notice (decisions 1.99, 1.104). In the mode, a
// session under the orchestrator reaches the human through it, so its own alerts would be noise;
// marked "with you", the human is working with it directly. Loose sessions have nobody else to
// wake anyone, so they notify as before.
export function notifiesFor(
  session: string,
  project: Project | undefined,
  muted: readonly string[],
): boolean {
  if (muted.includes(session)) return false
  if (!project) return true
  const o = keptOrchestration(project.orchestration, project.members)
  if (!o?.on || !o.orchestrator) return true
  if (o.withYou?.includes(session)) return true
  return keptParents(project)[session] !== o.orchestrator
}
