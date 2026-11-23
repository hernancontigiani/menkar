import type { EnvPatterns, EnvRules } from '../types'

// The variables a running OpenCode (v2.3.0) sets for the commands its shell tool, its terminals and
// its MCP servers run. A Menkar started from one of those would hand them to every agent it starts.
// Its configuration (OPENCODE_CONFIG, OPENCODE_CONFIG_DIR, OPENCODE_CONFIG_CONTENT, OPENCODE_DB,
// OPENCODE_FLAGS, OPENCODE_DISABLE_*, the providers' keys) is the user's and is kept; AI_AGENT,
// which its shell tool also sets, is already Claude's.
export const env = {
  // The parent session, and its server's credential, which a plain `opencode serve` hands on.
  identity: ['OPENCODE_SESSION_ID', 'OPENCODE_PASSWORD'],
  // Where the command runs: under OpenCode's shell tool, or in one of its terminals.
  markers: ['OPENCODE', 'OPENCODE_TERMINAL'],
  // Set for an MCP server whose command is `opencode`: an `opencode` that inherits it runs as Bun.
  runtime: ['BUN_BE_BUN'],
} as const satisfies EnvRules

export const envPatterns: EnvPatterns = {
  prefixes: [],
  // Un-namespaced: only when it came from OpenCode's shell tool, which sets OPENCODE beside it.
  gated: { marker: 'OPENCODE', names: ['AGENT'] },
}
