import type { AgentDescriptor } from '../descriptors'

export const descriptor: AgentDescriptor = {
  id: 'cursor',
  command: 'cursor-agent',
  label: 'agent.cursor',
  glyph: '➤',
  caps: { remote: false, fork: false, trash: true, chat: true, context: false },
  namedAtStart: false,
  // Cursor's headless mode cannot pause a tool for approval: two explicit levels instead of cards.
  chat: [
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
  ],
  versions: { validated: null, floor: null },
}
