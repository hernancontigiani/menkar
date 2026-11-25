import type { AgentDescriptor } from '../descriptors'

// The `_meta` key OpenCode's server names the calling session under in a tool call.
export const SESSION_META = 'ai.opencode/sessionID'

export const descriptor: AgentDescriptor = {
  id: 'opencode',
  command: 'opencode',
  label: 'agent.opencode',
  glyph: '▣',
  caps: {
    remote: false,
    fork: false,
    trash: false,
    chat: false,
    context: true,
    tools: true,
    orchestrates: true,
  },
  firstPrompt: true,
  namedAtStart: false,
  chat: [],
  teamLimits: null,
  callerMeta: SESSION_META,
  versionWord: 1,
  versions: { validated: '2.3.0', floor: null },
}
