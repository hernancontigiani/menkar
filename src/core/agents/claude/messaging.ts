import type { Messaging } from '../types'

// Claude Code's own messaging reaches only other Claude Code sessions on this machine.
export const messaging: Messaging = {
  tool: 'SendMessage',
  reaches: (other) => other === 'claude',
}
