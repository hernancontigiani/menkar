# Terminal: starting sessions, the embedded terminal, panes, close and stop

A tab of an agent session is an embedded terminal running the user's shell, into which the app types
the agent's command. This file specifies how each kind of start builds that command (new, resume,
fork; `--settings`, `-n`, `--session-id`, `&& exit`), how a
started session finds its transcript, the terminal itself (scrollback, find, `Shift+Enter`,
copy/paste), the `Ctrl+B` prefix and its help, split panes, and how a tab, a pane and a window are
closed — the graceful `/exit` and its fallback. Index rows: **F15, F16, F17, F18, F19, F20** (split
panes; the tab model they live in is `projects.md`), keys **K15–K27, K38, K39**, menu items
**M15, M20, M35**. Remote Control's flag is built here but specified in `remote-control.md`
(F49, M17, M21). Agent-state detection from the terminal is `agent-state.md`; the terminal's font,
colors and the TUI/Classic style are `preferences.md` and `look.md`; a question card overlaid on the
terminal is not built (decision 1.7, `chat.md`).

## Behaviour

### How a tab starts (F15)

- Built and tested: `docs/window.md` describes how; `src/main/terminal.ts`, `src/main/workspace.ts`, `src/core/command.ts` and `src/renderer/keys.ts` hold it.

### The kinds of start (F16)

- Built and tested: `docs/window.md` describes how; `src/main/terminal.ts`, `src/main/workspace.ts`, `src/core/command.ts` and `src/renderer/keys.ts` hold it.

### A new session finds its transcript

- Built and tested: `docs/window.md` describes how; `src/main/terminal.ts`, `src/main/workspace.ts`, `src/core/command.ts` and `src/renderer/keys.ts` hold it.

### The embedded terminal (F15, F18)

- Built and tested: `docs/window.md` describes how; `src/main/terminal.ts`, `src/main/workspace.ts`, `src/core/command.ts` and `src/renderer/keys.ts` hold it.

### The `Ctrl+B` prefix (F19, K19–K39)

- Built and tested: `docs/window.md` describes how; `src/main/terminal.ts`, `src/main/workspace.ts`, `src/core/command.ts` and `src/renderer/keys.ts` hold it.

### Split panes (F20)

- Built and tested: `docs/window.md` describes how; `src/main/terminal.ts`, `src/main/workspace.ts`, `src/core/command.ts` and `src/renderer/keys.ts` hold it.

### Closing a tab: graceful exit (F17)

- Built and tested: `docs/window.md` describes how; `src/main/terminal.ts`, `src/main/workspace.ts`, `src/core/command.ts` and `src/renderer/keys.ts` hold it.

### Closing a window and quitting (F25, F27 — the terminal side)

- Built and tested: `docs/window.md` describes how; `src/main/terminal.ts`, `src/main/workspace.ts`, `src/core/command.ts` and `src/renderer/keys.ts` hold it.

## Data contracts

### Command lines

- Built and tested: `docs/window.md` describes how; `src/main/terminal.ts`, `src/main/workspace.ts`, `src/core/command.ts` and `src/renderer/keys.ts` hold it.

### The CLI's checked behaviour (Claude Code 2.1.319, 2026-11-06)

- Built and tested: `docs/window.md` describes how; `src/main/terminal.ts`, `src/main/workspace.ts`, `src/core/command.ts` and `src/renderer/keys.ts` hold it.

### Bytes sent to a terminal

- Built and tested: `docs/window.md` describes how; `src/main/terminal.ts`, `src/main/workspace.ts`, `src/core/command.ts` and `src/renderer/keys.ts` hold it.

### Transcript locations (for a new session's resolution)

- Built and tested: `docs/window.md` describes how; `src/main/terminal.ts`, `src/main/workspace.ts`, `src/core/command.ts` and `src/renderer/keys.ts` hold it.

### Settings read (from `state.json` → `settings`, `preferences.md`)

- Built and tested: `docs/window.md` describes how; `src/main/terminal.ts`, `src/main/workspace.ts`, `src/core/command.ts` and `src/renderer/keys.ts` hold it.

### Environment

- Built and tested: `docs/window.md` describes how; `src/main/terminal.ts`, `src/main/workspace.ts`, `src/core/command.ts` and `src/renderer/keys.ts` hold it.

### Timers

- Built and tested: `docs/window.md` describes how; `src/main/terminal.ts`, `src/main/workspace.ts`, `src/core/command.ts` and `src/renderer/keys.ts` hold it.

## Acceptance cases

Every case is built and tested; `e2e/terminal.spec.ts`, `e2e/panes.spec.ts`,
`tests/core/command.test.ts` and `tests/core/sessions/join.test.ts` carry the ids.

Decided against: ~~TRM-39~~, ~~TRM-41~~–~~TRM-46~~, ~~TRM-51~~ (decision 1.9: closing hangs up and
types nothing into the agent); ~~TRM-16~~ (Electron's chooser returns local paths only).

Checked by hand (`plans/00-STATUS.md` §2): TRM-15 (cancelling the native folder chooser).

## Look

- Built and tested: `docs/window.md` describes how; `src/main/terminal.ts`, `src/main/workspace.ts`, `src/core/command.ts` and `src/renderer/keys.ts` hold it.
