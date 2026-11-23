import { shellQuote } from '../../command'
import type { McpMount } from '../types'

export const mcp: McpMount = {
  words: (ctx) => [
    ...(ctx.mcpConfig ? ['--mcp-config', shellQuote(ctx.mcpConfig)] : []),
    ...(ctx.pluginDir ? ['--plugin-dir', shellQuote(ctx.pluginDir)] : []),
  ],
  // `--plugin-dir` gives the session Menkar's skills.
  servesSkills: false,
}
