export const AGENT_IDS = ['claude', 'cursor'] as const

export type AgentId = (typeof AGENT_IDS)[number]

export const DEFAULT_AGENT: AgentId = 'claude'

export const CLASSIFIER_AGENT: AgentId = 'claude'

const KNOWN: ReadonlySet<unknown> = new Set(AGENT_IDS)

export function parseAgentId(value: unknown): AgentId | null {
  return KNOWN.has(value) ? (value as AgentId) : null
}
