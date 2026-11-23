import { AGENT_ENV } from '../../control/files'
import type { McpMount } from '../types'
import { descriptor } from './descriptor'

// Menkar's MCP is not named on the command line: main adds it to a folder of its own OpenCode
// server when the first session there enters a project in the orchestration mode, since OpenCode
// sends every tool's schema in every request. One connection serves every session of the folder,
// so the pane's environment cannot name the caller: each call's `_meta` does.
// A skills folder in its server's configuration would list Menkar's skills to every session there,
// those outside the orchestration mode too: its sessions read their skills' text from Menkar's MCP.
export const mcp: McpMount = { words: () => [], servesSkills: true }

export const MCP_NAME = 'menkar'

// The server's entry, as the per-folder route takes it. Without `codemode: false` the tools are
// reached only through OpenCode's own execute tool, by names the model would have to know.
export function mcpEntry(execPath: string, script: string) {
  return {
    type: 'local',
    command: [execPath, script],
    environment: { ELECTRON_RUN_AS_NODE: '1', [AGENT_ENV]: descriptor.id },
    codemode: false,
  } as const
}
