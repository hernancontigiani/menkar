import { type Projects, projectOf } from '../projects/model'
import { keptOrchestration } from '../projects/orchestration'
import { setParent } from '../projects/parents'

// adopt_session (decision 1.102): only the orchestrator, only in the mode. The answers go to the
// agent that called, in English.
export function adopt(
  state: Projects,
  caller: string,
  target: string,
): { readonly refusal: string } | { readonly projects: Projects } {
  const project = projectOf(state, caller)
  const o = project ? keptOrchestration(project.orchestration, project.members) : undefined
  if (!o?.on) return { refusal: 'The orchestration mode is off in this project.' }
  if (o.orchestrator !== caller) return { refusal: 'Only the orchestrator can adopt a session.' }
  if (target === caller) return { refusal: 'The orchestrator cannot adopt itself.' }
  return { projects: setParent(state, target, caller) }
}
