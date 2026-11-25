import type { AgentDescriptor } from '../descriptors'

// The version `--new-session-id` was measured on: below it a new chat's id is learnt late, and the
// session is given no team block.
export const NEW_ID_FLOOR = '2026.11.13'

export const descriptor: AgentDescriptor = {
  id: 'cursor',
  command: 'cursor-agent',
  label: 'agent.cursor',
  glyph: '➤',
  caps: {
    remote: false,
    fork: false,
    trash: true,
    chat: true,
    context: false,
    tools: true,
    orchestrates: false,
  },
  firstPrompt: true,
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
  // An idle wake is a restart, and each tool asks unless allowed: the card says so.
  teamLimits: { orchestrator: null, worker: 'agent.cursorWorks' },
  callerMeta: null,
  versionWord: 0,
  versions: { validated: '2026.11.13-eacade1', floor: NEW_ID_FLOOR },
}
