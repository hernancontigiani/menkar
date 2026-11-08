// Opening a session in the Ghostty terminal: its arguments. No --settings, no Remote Control and no
// tab in the app: the session there is Ghostty's.
export function ghosttyArgs(cwd: string, cli: string, sessionId: string): string[] {
  return [`--working-directory=${cwd}`, '-e', cli, '--resume', sessionId]
}
