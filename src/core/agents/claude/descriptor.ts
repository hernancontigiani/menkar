import type { AgentDescriptor } from '../descriptors'

export const descriptor: AgentDescriptor = {
  id: 'claude',
  command: 'claude',
  label: 'agent.claude',
  glyph: '✳',
  caps: { remote: true, fork: true, trash: true, chat: true, context: true, tools: true },
  firstPrompt: true,
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
  teamLimits: null,
  callerMeta: null,
  versionWord: 0,
  versions: { validated: '2.1.332', floor: '2.1.267' },
}
