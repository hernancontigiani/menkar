import type { AgentDescriptor } from '../types'

export const descriptor: AgentDescriptor = {
  id: 'claude',
  command: 'claude',
  label: 'agent.claude',
  glyph: '✳',
  caps: { remote: true, fork: true, trash: true, chat: true, context: true },
}
