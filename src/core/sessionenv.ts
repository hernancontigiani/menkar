// The variables that describe a running Claude Code session, by what they say. Claude Code sets
// them for the processes it starts: a hook, a tool's command, an MCP server. A Menkar started from
// one of those (a terminal inside Claude Code) would hand them to every agent it starts, and an
// agent that inherits them takes itself for that session's child: Claude Code 2.1.322 then writes
// no registry entry for it, so it cannot be messaged or woken. Everything else in the environment is
// the user's configuration and is kept, CLAUDE_CONFIG_DIR, ANTHROPIC_* and Claude Code's own
// settings (CLAUDE_CODE_USE_BEDROCK, CLAUDE_CODE_DISABLE_*) among it.
export const SESSION_ENV = {
  // Who the parent is: the set Claude Code gives every process it starts.
  identity: [
    'CLAUDECODE',
    'CLAUDE_CODE_SESSION_ID',
    'CLAUDE_CODE_CHILD_SESSION',
    'CLAUDE_CODE_SESSION_ATTENDED',
    'CLAUDE_PID',
    'CLAUDE_EFFORT',
    'AI_AGENT',
    // Set with that set when Claude Code's tracing is on: an agent Menkar starts is no part of it.
    'TRACEPARENT',
  ],
  // The parent's inbox: its socket and the token it trusts as coming from its own children.
  inbox: ['CLAUDE_CODE_MESSAGING_SOCKET', 'CLAUDE_CODE_MESSAGING_TOKEN'],
  // What the parent's hooks, commands and plugins are told about it: how it was started, its binary,
  // its project folder, the skills it ran, its Remote Control bridge, its hook and plugin folders.
  context: [
    'CLAUDE_CODE_ENTRYPOINT',
    'CLAUDE_CODE_EXECPATH',
    'CLAUDE_CODE_INVOKED_SKILLS',
    'CLAUDE_CODE_BRIDGE_SESSION_ID',
    'CLAUDE_PROJECT_DIR',
    'CLAUDE_ENV_FILE',
    'CLAUDE_PLUGIN_ROOT',
    'CLAUDE_PLUGIN_DATA',
  ],
  // An IDE's terminal: the port Claude Code there connects to, which is that IDE's, not Menkar's.
  ide: ['CLAUDE_CODE_SSE_PORT'],
} as const

const DENIED: ReadonlySet<string> = new Set(Object.values(SESSION_ENV).flat())

export function withoutSessionEnv(
  env: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  const kept: Record<string, string> = {}
  for (const [key, value] of Object.entries(env))
    if (value !== undefined && !DENIED.has(key)) kept[key] = value
  return kept
}
