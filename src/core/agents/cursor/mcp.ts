import { join } from 'node:path'
import { shellQuote } from '../../command'
import { PANE_ENV } from '../../context/statusline'
import { AGENT_ENV } from '../../control/files'
import type { LaunchContext, LaunchFile, McpMount } from '../types'
import { descriptor } from './descriptor'
import { pluginFolderName, SERVER_KEY } from './integrations'

// Cursor gives a plugin's stdio server only a few variables of its own environment, so the pane's
// is not inherited: each pane gets a plugin folder of its own, its server's `env` naming the
// caller, and the XDG names the server finds Menkar's state directories by.
const FORWARDED = ['XDG_CACHE_HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME']

// The pane's plugin folder; null when the pane cannot be given Menkar's server.
export function pluginFolder(ctx: LaunchContext): string | null {
  if (!ctx.execPath || !ctx.mcpServer || !ctx.paneFiles || !ctx.env[PANE_ENV]) return null
  return join(ctx.paneFiles, pluginFolderName())
}

// Hooks a plugin's hooks.json lists, by event.
export type PluginHooks = Readonly<Record<string, readonly { command: string; timeout: number }[]>>

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

// The folder's files, written whole at each start: a hook a start does not ask for is not left
// from an earlier one.
export function pluginFiles(ctx: LaunchContext, folder: string, hooks: PluginHooks): LaunchFile[] {
  const pane = ctx.env[PANE_ENV] ?? ''
  const server = {
    command: ctx.execPath,
    args: [ctx.mcpServer],
    env: { ELECTRON_RUN_AS_NODE: '1', [PANE_ENV]: pane, [AGENT_ENV]: descriptor.id },
  }
  // No manifest: Cursor loads a folder holding these two alone, and names its server after the
  // folder's basename.
  return [
    {
      path: join(folder, '.mcp.json'),
      // Read when written: the variables are main's, as the pane's shell gets them.
      text: async () => {
        const forwarded = Object.fromEntries(
          FORWARDED.flatMap((name) => {
            const value = process.env[name]
            return value ? [[name, value]] : []
          }),
        )
        return json({
          mcpServers: { [SERVER_KEY]: { ...server, env: { ...server.env, ...forwarded } } },
        })
      },
    },
    { path: join(folder, 'hooks', 'hooks.json'), text: async () => json({ version: 1, hooks }) },
  ]
}

export const mcp: McpMount = {
  words(ctx) {
    const folder = pluginFolder(ctx)
    return folder ? ['--plugin-dir', shellQuote(folder)] : []
  },
  servesSkills: false,
}
