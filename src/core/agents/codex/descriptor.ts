import type { AgentDescriptor } from '../descriptors'

export const descriptor: AgentDescriptor = {
  id: 'codex',
  command: 'codex',
  label: 'agent.codex',
  glyph: '⬡',
  caps: { remote: false, fork: false, trash: false, chat: false, context: true },
  namedAtStart: false,
  chat: [],
  versions: { validated: null, floor: null },
}
