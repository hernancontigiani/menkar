// The ways to start a chat with an agent. No Node import: the renderer builds its menus from these.

export type ChatAgent = 'claude' | 'cursor'
export type VariantKey = 'default' | 'ask' | 'trusted'

export interface ChatVariant {
  readonly agent: ChatAgent
  readonly key: VariantKey
  // one long-lived process fed over stdin, or one process per turn resuming the session
  readonly transport: 'stdin-stream' | 'spawn-resume'
  readonly writeable: boolean
  // each tool use is approved one by one
  readonly gated: boolean
  // the mode label for menus; null when it is the agent's only variant
  readonly mode: 'askReadOnly' | 'trustedAutoRun' | null
}

export const VARIANTS: readonly ChatVariant[] = [
  {
    agent: 'claude',
    key: 'default',
    transport: 'stdin-stream',
    writeable: true,
    gated: true,
    mode: null,
  },
  // Cursor's headless mode cannot pause a tool for approval: two explicit levels instead of cards.
  {
    agent: 'cursor',
    key: 'ask',
    transport: 'spawn-resume',
    writeable: false,
    gated: false,
    mode: 'askReadOnly',
  },
  {
    agent: 'cursor',
    key: 'trusted',
    transport: 'spawn-resume',
    writeable: true,
    gated: false,
    mode: 'trustedAutoRun',
  },
]

export const AGENT_NAMES: Readonly<Record<ChatAgent, string>> = {
  claude: 'Claude Code',
  cursor: 'Cursor',
}
export const AGENT_CLIS: Readonly<Record<ChatAgent, string>> = {
  claude: 'claude',
  cursor: 'cursor-agent',
}

// An agent offers its variants only while its CLI is installed.
export function variantsFor(installed: ReadonlySet<ChatAgent>, agent?: ChatAgent): ChatVariant[] {
  return VARIANTS.filter(
    (v) => installed.has(v.agent) && (agent === undefined || v.agent === agent),
  )
}

export function variantOf(agent: ChatAgent, key: VariantKey): ChatVariant | undefined {
  return VARIANTS.find((v) => v.agent === agent && v.key === key)
}
