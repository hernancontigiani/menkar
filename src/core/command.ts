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
      readonly model?: string
      readonly mode?: string
      readonly addDir?: string
    }
  | { readonly kind: 'resume'; readonly id: string }
  | { readonly kind: 'fork'; readonly source: string; readonly id: string }
  | { readonly kind: 'continue' }

export interface CommandOptions {
  // The executable's absolute path, found on the PATH.
  readonly cli: string
  // The app's settings file for Claude Code (`--settings`), when the integration provides one.
  readonly settings?: string
  readonly remoteControl?: string
}

// The agent's command line, as typed into the user's shell: options, identity, then the app's
// session flags last, followed by ` && exit` so the tab closes when the agent ends cleanly.
export function buildCommand(agent: Agent, start: Start, options: CommandOptions): string {
  const args: string[] = [options.cli]
  const claude = agent === 'claude'
  switch (start.kind) {
    case 'new':
      if (start.model) args.push('--model', start.model)
      if (start.mode) args.push(claude ? '--permission-mode' : '--mode', start.mode)
      if (claude) {
        if (start.addDir) args.push('--add-dir', start.addDir)
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
    case 'continue':
      args.push('--continue')
      break
  }
  if (claude && options.settings) args.push('--settings', options.settings)
  return `${args.map(shellQuote).join(' ')} && exit\n`
}
