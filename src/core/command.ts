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
    }
  | { readonly kind: 'resume'; readonly id: string }
  | { readonly kind: 'fork'; readonly source: string; readonly id: string }

export interface CommandOptions {
  // The executable's absolute path, found on the PATH.
  readonly cli: string
  // The app's settings file for Claude Code (`--settings`), when the integration provides one.
  readonly settings?: string
  readonly remoteControl?: string
  // Folders the agent may read and write besides its own (`--add-dir`, Claude Code only).
  readonly addDirs?: readonly string[]
  // A file holding the session's first prompt, read by the shell (Claude Code only).
  readonly promptFile?: string
  // Menkar's MCP server as `--mcp-config` JSON (Claude Code only).
  readonly mcpConfig?: string
}

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

// The agent's command line, as typed into the user's shell: options, identity, then the app's
// session flags last, followed by ` && exit` so the tab closes when the agent ends cleanly.
export function buildCommand(agent: Agent, start: Start, options: CommandOptions): string {
  const args: string[] = [options.cli]
  const claude = agent === 'claude'
  switch (start.kind) {
    case 'new':
      if (claude) {
        if (start.id) args.push('--session-id', start.id)
        if (start.name) args.push('-n', start.name)
        if (options.remoteControl) args.push(`--remote-control=${options.remoteControl}`)
      }
      break
    case 'resume':
      args.push('--resume', start.id)
      if (claude && options.remoteControl) args.push(`--remote-control=${options.remoteControl}`)
      break
    case 'fork':
      args.push('--resume', start.source, '--fork-session', '--session-id', start.id)
      break
  }
  const words = args.map(shellQuote)
  // Before --add-dir, which takes every word up to the next option: after it the prompt would be
  // read as one more folder. Double quotes keep it one argument whatever it holds.
  if (claude && options.promptFile)
    words.push(`"$(cat '${options.promptFile.replaceAll("'", `'"'"'`)}')"`)
  if (claude) for (const dir of options.addDirs ?? []) words.push('--add-dir', shellQuote(dir))
  if (claude && options.mcpConfig) words.push('--mcp-config', shellQuote(options.mcpConfig))
  if (claude && options.settings) words.push('--settings', shellQuote(options.settings))
  return `${words.join(' ')} && exit\n`
}
