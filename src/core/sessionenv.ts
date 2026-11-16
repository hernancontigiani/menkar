import { AGENT_IDS } from './agents/ids'
import { kitOf } from './agents/registry'
import type { EnvRules } from './agents/types'
import { FLAVOR_ENV } from './flavor'

// Every registered agent's session variables, group by group: a Menkar started from inside any
// agent's session must not hand that session's identity to the agents it starts.
export const SESSION_ENV: EnvRules = AGENT_IDS.reduce<Record<string, readonly string[]>>(
  (all, id) => {
    for (const [group, keys] of Object.entries(kitOf(id).env ?? {}))
      all[group] = [...(all[group] ?? []), ...keys]
    return all
  },
  {},
)

// A Menkar of either flavour started from the other's pane must not pass that flavour on.
const DENIED: ReadonlySet<string> = new Set([...Object.values(SESSION_ENV).flat(), FLAVOR_ENV])

export function withoutSessionEnv(
  env: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  const kept: Record<string, string> = {}
  for (const [key, value] of Object.entries(env))
    if (value !== undefined && !DENIED.has(key)) kept[key] = value
  return kept
}
