import type { EnvPatterns, EnvRules } from '../types'

// The variables a running Codex sets for the commands, hooks and plugins it starts (codex-cli
// 0.169.0). A Menkar started from Codex's shell tool would hand them to every agent it starts, and
// a Codex that inherits them takes itself for that thread's tool. Its configuration (CODEX_HOME,
// CODEX_SQLITE_HOME, OPENAI_API_KEY, CODEX_API_KEY, CODEX_CA_CERTIFICATE) is the user's and is kept,
// and so is the display tuning its shell tool forces (NO_COLOR, LANG, PAGER; TERM=dumb too, though a
// command in a pty was seen keeping the pty's TERM): it cannot be told from the user's own.
export const env = {
  // The parent thread, its root session, its tool call and its permission profile.
  identity: [
    'CODEX_THREAD_ID',
    'CODEX_SESSION_ID',
    'CODEX_TOOL_CALL_ID',
    'CODEX_PERMISSION_PROFILE',
  ],
  // Markers the parent stamps on every command, over any inherited value: its own version, and
  // the line-ending opt-in for an older standalone apply_patch.
  runtime: ['CODEX_VERSION', 'CODEX_APPLY_PATCH_PRESERVE_LINE_ENDINGS'],
  // How the parent runs its commands: under an agent, in its sandbox.
  sandbox: ['CODEX_CI', 'CODEX_SANDBOX', 'CODEX_SANDBOX_NETWORK_DISABLED'],
  // The parent's network proxy, which is Codex's, not the user's.
  proxy: [
    'CODEX_NETWORK_PROXY_ACTIVE',
    'CODEX_NETWORK_PROXY_ATTRIBUTION',
    'CODEX_NETWORK_PROXY_CREDENTIAL_BROKER_ACTIVE',
    'CODEX_NETWORK_ALLOW_LOCAL_BINDING',
  ],
} as const satisfies EnvRules

export const envPatterns: EnvPatterns = {
  prefixes: ['CODEX_NETWORK_PROXY_SNAPSHOT_BROKERED_'],
  // A plugin hook's folders; un-namespaced, so only when the variables came from a Codex thread.
  gated: { marker: 'CODEX_THREAD_ID', names: ['PLUGIN_ROOT', 'PLUGIN_DATA'] },
}
