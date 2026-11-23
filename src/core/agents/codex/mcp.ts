import { shellQuote } from '../../command'
import { PANE_ENV } from '../../context/statusline'
import { AGENT_ENV } from '../../control/files'
import type { McpMount } from '../types'
import { tomlString } from './config'

// Codex gives a stdio server only a few variables of its own environment, so the pane's is not
// inherited: the caller is named in `env`, and the server finds Menkar's state directories through
// the XDG names Codex forwards from the pane's environment when they are set.
const FORWARDED = ['XDG_CACHE_HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME']

export const DIRECT_KEY = 'features.code_mode.direct_only_tool_namespaces'

const set = (key: string, value: string) => ['-c', shellQuote(`mcp_servers.menkar.${key}=${value}`)]

export const mcp: McpMount = {
  words(ctx) {
    const pane = ctx.env[PANE_ENV]
    if (!ctx.execPath || !ctx.mcpServer || !pane) return []
    const env = { ELECTRON_RUN_AS_NODE: '1', [PANE_ENV]: pane, [AGENT_ENV]: 'codex' }
    const table = Object.entries(env)
      .map(([name, value]) => `${name}=${tomlString(value)}`)
      .join(', ')
    return [
      ...set('command', tomlString(ctx.execPath)),
      ...set('args', `[${tomlString(ctx.mcpServer)}]`),
      ...set('env', `{${table}}`),
      ...set('env_vars', `[${FORWARDED.map(tomlString).join(',')}]`),
      // Menkar's tools run with no approval card, as Claude's permission entry for them does.
      ...set('default_tools_approval_mode', tomlString('approve')),
      // Code-mode models otherwise reach the tools only through the exec tool, by a name the model
      // must know; listed directly, each comes with its schema in the first request. Without the
      // `features.` prefix Codex ignores the key.
      '-c',
      shellQuote(`${DIRECT_KEY}=[${tomlString('mcp__menkar')}]`),
    ]
  },
  // Its team block names each skill's SKILL.md, which the session reads.
  servesSkills: false,
}
