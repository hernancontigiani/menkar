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
