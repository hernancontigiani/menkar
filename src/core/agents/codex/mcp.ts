import { shellQuote } from '../../command'
import { PANE_ENV } from '../../context/statusline'
import { AGENT_ENV } from '../../control/files'
import type { McpMount } from '../types'
import { tomlString } from './config'

// Codex gives a stdio server only a few variables of its own environment, so the pane's is not
// inherited: the caller is named in `env`, and the server finds Menkar's state directories through
// the XDG names Codex forwards from the pane's environment when they are set.
const FORWARDED = ['XDG_CACHE_HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME']

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
    ]
  },
}
