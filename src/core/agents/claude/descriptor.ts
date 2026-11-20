import type { AgentDescriptor } from '../descriptors'

export const descriptor: AgentDescriptor = {
  id: 'claude',
  command: 'claude',
  label: 'agent.claude',
  glyph: '✳',
  caps: { remote: true, fork: true, trash: true, chat: true, context: true },
  namedAtStart: true,
  chat: [
    {
      agent: 'claude',
      key: 'default',
      transport: 'stdin-stream',
      writeable: true,
      gated: true,
      mode: null,
    },
  ],
  versions: { validated: '2.1.329', floor: '2.1.267' },
}
