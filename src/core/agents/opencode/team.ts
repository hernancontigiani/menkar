import type { TeamDelivery } from '../types'

// OpenCode keeps the block as the session's instruction entry on its server, put before its first
// prompt and replaced whenever it changes, so every start holds the current block. Menkar's skills
// are not in a folder its server lists, which every session there would see: a session reads a
// skill's text through Menkar's MCP, by name. A turn a queued message opens has every tool and
// skill listed in its first request, so nothing needs loading before it is seen.
export const team: TeamDelivery = {
  skill: (name) => `\`${name}\``,
  own: (name) => `\`menkar:${name}\``,
  byName: "with the menkar server's `load_skill` tool, by name",
  part: 'opencode.md',
  heldAtStart: (start, block) => (start.kind === 'fork' ? null : block),
  records: false,
  // The preparer puts it, before the TUI starts.
  atStart: () => [],
  floor: null,
  orchestratorPrompt: 'orch.firstPromptByTool',
}
