// The ways to start a chat with an agent, from its descriptor. No Node import: the renderer builds
// its menus from these.
import { type ChatVariant, DESCRIPTORS, type VariantKey } from '../agents/descriptors'
import { AGENT_IDS, type AgentId } from '../agents/ids'

export type { ChatVariant, VariantKey }
export type ChatAgent = AgentId

export const VARIANTS: readonly ChatVariant[] = AGENT_IDS.flatMap((id) => DESCRIPTORS[id].chat)

// An agent offers its variants only while its CLI is installed.
export function variantsFor(installed: ReadonlySet<ChatAgent>, agent?: ChatAgent): ChatVariant[] {
  return VARIANTS.filter(
    (v) => installed.has(v.agent) && (agent === undefined || v.agent === agent),
  )
}

export function variantOf(agent: ChatAgent, key: VariantKey): ChatVariant | undefined {
  return VARIANTS.find((v) => v.agent === agent && v.key === key)
}
