import { kitOf } from './agents/registry'
import type { LaunchContext, LaunchPlan } from './agents/types'
import type { Agent } from './sessions/lines'

// POSIX quoting: bare when only these characters, else single-quoted with ' written as '"'"'.
export function shellQuote(word: string): string {
  if (word !== '' && /^[A-Za-z0-9@%+=:,./_-]+$/.test(word)) return word
  return `'${word.replaceAll("'", `'"'"'`)}'`
}

export type Start =
  | {
      readonly kind: 'new'
      readonly id?: string
      readonly name?: string
      // Claude Code's `--model`, as the agent names it; a later resume keeps Claude Code's own.
      readonly model?: string
    }
  | { readonly kind: 'resume'; readonly id: string }
  | { readonly kind: 'fork'; readonly source: string; readonly id: string }

// What main can offer a start, as `buildCommand` takes it: the Launcher's context without the
// pane's environment.
export type CommandOptions = Omit<LaunchContext, 'env'>

// Menkar's MCP server for Claude Code: Electron's own binary runs the script as plain Node, as it
// runs the statusline. Claude Code adds the pane's environment, MENKAR_PANE with it.
export function mcpConfig(execPath: string, script: string): string {
  return JSON.stringify({
    mcpServers: {
      menkar: {
        type: 'stdio',
        command: execPath,
        args: [script],
        env: { ELECTRON_RUN_AS_NODE: '1' },
      },
    },
  })
}

// The agent's command line, as typed into the user's shell, followed by ` && exit` so the tab
// closes when the agent ends cleanly.
export function commandLine(plan: LaunchPlan): string {
  return `${plan.words.join(' ')} && exit\n`
}

export function buildCommand(agent: Agent, start: Start, options: CommandOptions): string {
  return commandLine(kitOf(agent).launch.plan(start, { ...options, env: {} }))
}
