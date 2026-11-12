import type { Project } from '../projects/model'

// Only the orchestrator orchestrates (decision 1.84): with the mode on and one marked, another
// session's start_session is refused with this sentence, written for the agent that called. null
// when it may start one.
export function mayStart(
  project: Project,
  callerId: string,
  nameOf: (id: string) => string,
): string | null {
  const o = project.orchestration
  if (!o?.on || !o.orchestrator || o.orchestrator === callerId) return null
  return `Only this project's orchestrator, ${nameOf(o.orchestrator)}, starts sessions. Ask it to delegate the work.`
}
