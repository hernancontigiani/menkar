import type { AgentDescriptor } from '../types'

export const descriptor: AgentDescriptor = {
  id: 'cursor',
  command: 'cursor-agent',
  label: 'agent.cursor',
  glyph: '➤',
  caps: { remote: false, fork: false, trash: true, chat: true, context: false },
}
