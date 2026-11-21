import type { AgentDescriptor } from '../descriptors'

export const descriptor: AgentDescriptor = {
  id: 'codex',
  command: 'codex',
  label: 'agent.codex',
  glyph: '⬡',
  caps: { remote: false, fork: false, trash: false, chat: false, context: true, tools: true },
  firstPrompt: true,
  namedAtStart: false,
  chat: [],
  teamLimits: null,
  versionWord: 1,
  versions: { validated: null, floor: null },
}
