// What an agent in a terminal is doing, from the title it set and the text on its screen: a
// simplified port of herdr's agent-detection rules (https://herdr.dev, Apache-2.0).

export const RAW_STATES = ['working', 'blocked', 'idle'] as const
export type RawState = (typeof RAW_STATES)[number]

// Claude Code's busy title: a Braille spinner, or the half circles it draws since 2.1.228, then a
// space. Its idle title begins with "✳ ".
const CLAUDE_TITLE_WORKING = /^[⠀-⣿◐-◓] /u
const CURSOR_SPINNER = /^\s*[⠀-⣿]+\s+[\p{L}\p{N}_]+ing(?![\p{L}\p{N}_])/mu
const CURSOR_ALLOW = /^\s*(?:\S\s*)?(?:allow|run) .*\(y\)/mu
const BACKGROUND_TASKS = /(?<![\p{L}\p{N}_])[1-9][0-9]*\s+background\s+tasks?(?![\p{L}\p{N}_])/u

// Claude Code's footer pill while background work runs (decision 1.105), as its 2.1.323 program
// writes it: "1 shell", "2 monitors", "↳ 3 background", "◇ 1 cloud session"… Claude Code's own
// housekeeping ("saving memories", "dreaming", "auto-mode scan", "memory import") has no count and
// is left out. The pill starts the footer's line or follows a " · ", after at most one symbol
// that is not the input box's prompt, so a count typed in the box or said in the conversation is
// not read as one.
const CLAUDE_BACKGROUND_PILLS = [
  'shells?',
  'monitors?',
  'artifact comment monitors?',
  'local agents?',
  'teams?',
  'mcp tasks?',
  'background', // "↳ 2 background", "2 background tasks", "2 background dynamic workflows"
  'cloud sessions?',
  'remote dynamic workflows?',
] as const
// The footer's lines: the last non-empty lines of the screen.
const CLAUDE_FOOTER_LINES = 3
const CLAUDE_BACKGROUND = new RegExp(
  `(?:^|·)\\s*(?:[^\\p{L}\\p{N}\\s>❯]\\s*)?[1-9][0-9]*\\s+(?:${CLAUDE_BACKGROUND_PILLS.join('|')})(?![\\p{L}\\p{N}_])`,
  'mu',
)

// The line breaks Python's splitlines() honours: the rules' line counts were tuned counting them.
const LINE_BREAK = new RegExp(
  `\r\n|[\n\r\v\f\x1c-\x1e${String.fromCodePoint(0x85, 0x2028, 0x2029)}]`,
  'u',
)

// The last n lines that hold a non-space character, lowercased.
function bottom(screen: string, n: number): string {
  const lines = screen.split(LINE_BREAK).filter((line) => line.trim() !== '')
  return lines.slice(-n).join('\n').toLowerCase()
}

function claude(title: string, screen: string): RawState {
  const recent = bottom(screen, 14)
  if (recent.includes('select model') && recent.includes('enter to set as default')) {
    return 'idle' // the /model picker, not a question from the agent
  }
  if (
    recent.includes('do you want to proceed?') ||
    recent.includes('waiting for permission') ||
    recent.includes('do you want to allow this connection?') ||
    recent.includes('review your answers') ||
    (recent.includes('esc to cancel') &&
      (recent.includes('enter to confirm') || recent.includes('enter to select'))) ||
    ((recent.includes('do you want to') || recent.includes('would you like to')) &&
      recent.includes('yes'))
  ) {
    return 'blocked'
  }
  if (
    CLAUDE_TITLE_WORKING.test(title) ||
    recent.includes('esc to interrupt') ||
    CLAUDE_BACKGROUND.test(bottom(screen, CLAUDE_FOOTER_LINES))
  ) {
    return 'working'
  }
  return 'idle'
}

function cursor(screen: string): RawState {
  const recent = bottom(screen, 10)
  if (
    (recent.includes('run this command?') &&
      (recent.includes('run (once) (y)') || recent.includes('skip (esc or n)'))) ||
    (recent.includes('write to this file?') && recent.includes('proceed (y)')) ||
    recent.includes('(y) (enter)') ||
    recent.includes('keep (n)') ||
    recent.includes('skip (esc or n)') ||
    CURSOR_ALLOW.test(recent)
  ) {
    return 'blocked'
  }
  if (
    bottom(screen, 6).includes('ctrl+c to stop') ||
    CURSOR_SPINNER.test(recent) ||
    BACKGROUND_TASKS.test(recent)
  ) {
    return 'working'
  }
  return 'idle'
}

// The raw state of an agent's pane. `provider` is the agent's id ('claude', 'cursor'); any other
// agent is always idle. A pane whose agent has exited (the shell owns the terminal's foreground
// again) is idle whatever its screen shows: the caller checks that first.
export function detectState(provider: string, title: string, screen: string): RawState {
  if (provider === 'claude') return claude(title, screen)
  if (provider === 'cursor') return cursor(screen)
  return 'idle'
}
