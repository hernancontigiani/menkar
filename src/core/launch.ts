// How `menkar` started from a command line behaves: the app gives the terminal back at once, as
// VS Code's `code` does, while the commands that print stay attached to it.

// Added by the process that leaves the terminal to the copy it starts, so that copy runs the app.
export const DETACHED = '--menkar-detached'
const FOREGROUND = new Set(['--foreground', '-f'])
// They print and end, so the terminal is where their output belongs.
const PRINTING = new Set(['--help', '-h', '--version', '-v'])

// The options before the command: Chromium's switches, the detached marker, the foreground flag.
function leadingOptions(argv: readonly string[]): string[] {
  const options: string[] = []
  for (const arg of argv.slice(1)) {
    if (!arg.startsWith('--') && !FOREGROUND.has(arg)) break
    options.push(arg)
  }
  return options
}

// The command's own arguments: after the executable, the options placed before the command, and
// (unpackaged) the app's folder.
export function cliArguments(argv: readonly string[], packaged: boolean): string[] {
  const rest = argv.slice(1 + leadingOptions(argv).length)
  return packaged ? rest : rest.slice(1)
}

export interface LaunchContext {
  readonly argv: readonly string[]
  readonly packaged: boolean
  readonly stdoutIsTTY: boolean
  readonly env: Readonly<Record<string, string | undefined>>
  readonly platform: string
}

// Whether this process should start the app as a copy of itself in a session of its own and end.
// Only from a terminal: the launcher and the tests (Playwright reads the app's pipes) are left as
// they are. On Windows a process cannot leave its console this way.
export function shouldDetach(context: LaunchContext): boolean {
  const { env } = context
  if (context.platform === 'win32' || !context.stdoutIsTTY) return false
  // Node mode (the statusline helper), the UI checks, and the dev server, which keeps the app it
  // started.
  if (
    env.ELECTRON_RUN_AS_NODE ||
    env.MENKAR_E2E_XVFB ||
    env.MENKAR_E2E_EXECUTABLE ||
    env.ELECTRON_RENDERER_URL
  )
    return false
  const options = leadingOptions(context.argv)
  if (options.some((o) => o === DETACHED || FOREGROUND.has(o) || PRINTING.has(o))) return false
  const command = cliArguments(context.argv, context.packaged)
  if (command[0] === 'usage') return false
  if (command[0] === 'open' && command.length === 1) return false
  return true
}
