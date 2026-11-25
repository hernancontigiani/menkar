// What Menkar's agents inherit from Menkar's own environment: everything the user configured, and
// nothing that describes a Claude Code session Menkar happened to be started from. A claude that
// inherits CLAUDE_CODE_CHILD_SESSION, for one, writes no registry entry, so Menkar cannot wake it.
import { expect, test } from 'vitest'
import { SESSION_ENV, withoutSessionEnv } from '../../src/core/sessionenv'

test('the variables a running session gives its children are dropped', () => {
  // As Claude Code 2.1.322 sets them for a hook, a tool's command or an MCP server it starts.
  const fromASession = {
    CLAUDECODE: '1',
    CLAUDE_CODE_SESSION_ID: '5c1e7a2b-0f3d-4e6a-8b9c-1d2e3f4a5b6c',
    CLAUDE_CODE_CHILD_SESSION: '1',
    CLAUDE_CODE_SESSION_ATTENDED: '1',
    CLAUDE_PID: '4242',
    CLAUDE_EFFORT: 'high',
    AI_AGENT: 'claude-code',
    TRACEPARENT: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
    CLAUDE_CODE_MESSAGING_SOCKET: '/run/user/1000/cc-socks/4242.sock',
    CLAUDE_CODE_MESSAGING_TOKEN: '0123456789abcdef0123456789abcdef',
    CLAUDE_CODE_ENTRYPOINT: 'cli',
    CLAUDE_CODE_EXECPATH: '/home/ana/.local/bin/claude',
    CLAUDE_CODE_INVOKED_SKILLS: 'review',
    CLAUDE_CODE_BRIDGE_SESSION_ID: 'session_01',
    CLAUDE_PROJECT_DIR: '/home/ana/work',
    CLAUDE_ENV_FILE: '/home/ana/.claude/session-env/x/hook-1.sh',
    CLAUDE_PLUGIN_ROOT: '/home/ana/.claude/plugins/p',
    CLAUDE_PLUGIN_DATA: '/home/ana/.claude/plugins/data/p',
    CLAUDE_CODE_SSE_PORT: '12345',
    // As codex-cli 0.169.0 sets them for a command its shell tool runs.
    CODEX_THREAD_ID: '019a3f1e-7c2d-7b40-9e11-2f4a6b8c0d1e',
    CODEX_TOOL_CALL_ID: 'call_01',
    CODEX_PERMISSION_PROFILE: 'workspace-write',
    CODEX_SESSION_ID: '019a3f1e-7c2d-7b40-9e11-2f4a6b8c0d1e',
    CODEX_VERSION: '0.169.0',
    CODEX_APPLY_PATCH_PRESERVE_LINE_ENDINGS: '1',
    CODEX_CI: '1',
    CODEX_SANDBOX: 'seatbelt',
    CODEX_SANDBOX_NETWORK_DISABLED: '1',
    CODEX_NETWORK_PROXY_ACTIVE: '1',
    CODEX_NETWORK_PROXY_ATTRIBUTION: 'attr',
    CODEX_NETWORK_PROXY_CREDENTIAL_BROKER_ACTIVE: '1',
    CODEX_NETWORK_ALLOW_LOCAL_BINDING: '1',
    // As opencode v2.3.0 sets them for its shell tool, its terminals and an MCP server.
    OPENCODE_SESSION_ID: 'ses_e017abf0effe8Vhlt6MfRFP0OJ',
    OPENCODE_PASSWORD: 'a-password',
    OPENCODE: '1',
    OPENCODE_TERMINAL: '1',
    BUN_BE_BUN: '1',
  }
  expect(Object.keys(fromASession).sort()).toEqual(Object.values(SESSION_ENV).flat().sort())
  expect(withoutSessionEnv({ ...fromASession, PATH: '/usr/bin' })).toEqual({ PATH: '/usr/bin' })
})

test("the user's own configuration stays, Claude Code's settings among it", () => {
  const configured = {
    HOME: '/home/ana',
    PATH: '/usr/bin',
    CLAUDE_CONFIG_DIR: '/home/ana/.claude-work',
    ANTHROPIC_API_KEY: 'sk-ant-x',
    ANTHROPIC_BASE_URL: 'https://gateway.example',
    CLAUDE_CODE_USE_BEDROCK: '1',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CODE_MAX_OUTPUT_TOKENS: '8000',
    DISABLE_AUTOUPDATER: '1',
  }
  expect(withoutSessionEnv(configured)).toEqual(configured)
  expect(withoutSessionEnv({ GONE: undefined, KEPT: '' })).toEqual({ KEPT: '' })
})

test("a variable known by its prefix is dropped: Codex's proxy snapshot", () => {
  expect(
    withoutSessionEnv({
      CODEX_NETWORK_PROXY_SNAPSHOT_BROKERED_HTTPS: 'x',
      CODEX_NETWORK_PROXY_SNAPSHOT_BROKERED_: 'y',
      CODEX_NETWORK_PROXY_SNAPSHOT: 'kept: not the prefix',
      PATH: '/usr/bin',
    }),
  ).toEqual({ CODEX_NETWORK_PROXY_SNAPSHOT: 'kept: not the prefix', PATH: '/usr/bin' })
})

test("a plugin's folders are dropped only when a Codex thread handed them on", () => {
  const plugin = { PLUGIN_ROOT: '/home/ana/.codex/plugins/p', PLUGIN_DATA: '/home/ana/.codex/d' }
  expect(withoutSessionEnv({ ...plugin, PATH: '/usr/bin' })).toEqual({
    ...plugin,
    PATH: '/usr/bin',
  })
  expect(withoutSessionEnv({ ...plugin, CODEX_THREAD_ID: 't', PATH: '/usr/bin' })).toEqual({
    PATH: '/usr/bin',
  })
})

test("Codex's configuration and the display tuning its shell forces are kept", () => {
  const configured = {
    CODEX_HOME: '/home/ana/.codex-work',
    CODEX_SQLITE_HOME: '/home/ana/.codex-db',
    OPENAI_API_KEY: 'sk-x',
    CODEX_API_KEY: 'k',
    CODEX_CA_CERTIFICATE: '/etc/ssl/ca.pem',
    NO_COLOR: '1',
    TERM: 'dumb',
    PAGER: 'cat',
  }
  expect(withoutSessionEnv(configured)).toEqual(configured)
})

test("AGENT is dropped only when it came from OpenCode's shell tool", () => {
  expect(withoutSessionEnv({ AGENT: 'mine', PATH: '/usr/bin' })).toEqual({
    AGENT: 'mine',
    PATH: '/usr/bin',
  })
  expect(withoutSessionEnv({ AGENT: '1', OPENCODE: '1', PATH: '/usr/bin' })).toEqual({
    PATH: '/usr/bin',
  })
})
