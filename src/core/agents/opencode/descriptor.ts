import type { AgentDescriptor } from '../descriptors'

export const descriptor: AgentDescriptor = {
  id: 'opencode',
  command: 'opencode',
  label: 'agent.opencode',
  glyph: '▣',
  caps: { remote: false, fork: false, trash: false, chat: false, context: false, tools: false },
  firstPrompt: false,
  namedAtStart: false,
  chat: [],
  teamLimits: null,
  versionWord: 1,
  versions: { validated: null, floor: null },
}
