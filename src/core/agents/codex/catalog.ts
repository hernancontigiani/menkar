import { join } from 'node:path'
import type { SessionCatalog } from '../types'
import { codexHome } from './config'

// Interim until P1a.3 reads the rollouts: Codex's sessions are not listed yet.
export const catalog: SessionCatalog = {
  root: () => join(codexHome(), 'sessions'),
  find: async () => [],
  reader: () => ({ read: async () => null, retain: () => {} }),
  watchTargets: async () => [],
  lastReply: null,
  details: async () => ({
    user: 0,
    assistant: 0,
    toolCalls: 0,
    models: [],
    created: null,
    lastActivity: null,
    cwd: null,
    mcpUsed: [],
    recent: [],
  }),
  exportMarkdown: async () => '',
  location: () => null,
  trash: null,
  transcript: null,
  turnEnd: null,
}
