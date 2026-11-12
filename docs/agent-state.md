# Agent state — how it is read

What each running agent is doing (working, blocked, idle, done), read without the widgets that
show it. The code says what each step does. This file keeps why it is shaped this way. The dots,
the badge, the quick switcher and Go to agent are still `docs/spec/agent-state.md` until they are
built.

## The shape

- **`src/core/agentstate/`** is pure and runs in tests on plain Node:
  - `detect.ts` holds Claude Code's and Cursor's rules over (agent, title, screen), ported from
    herdr's.
  - `mirror.ts`, the `ScreenMirror`: an `@xterm/headless` terminal fed the same bytes as the pane.
  - `watch.ts` checks each burst of changes once, after a delay.
  - `shown.ts` turns raw states into shown ones (done and seen), and holds the roll-up and the
    blocked counts.
  - `notify.ts` decides what a notification does: sound, toast or desktop notice.
  - `tray.ts` keeps one desktop notification per session. A newer one replaces it, and it is
    closed as soon as its pane is seen or closed, and on quit: the dock shows the count of
    notifications still in the tray, and the human saw it stay at 3 after opening every tab.
- **`src/main/agentstate.ts`** follows every agent pane that b1's `src/main/panes.ts` registers.
  Shell splits are never registered, so they have no state. It sends every window `agentState:changed`
  (every pane's shown state and every project's blocked count) and `agentState:toast`. It shows
  desktop notifications through Electron, and their click calls the pane's `reveal()`.
- **The seam with the window** is `AgentPane`. The window answers what only it knows: whether the
  pane is seen (its tab selected in the focused window), when that may have changed, the tab's
  title, whether its window is focused, and how to reveal it. The foreground check (is the agent
  still running, or is the pane back at the shell) is the terminal's own.

## Why

- **A headless terminal per pane, not the renderer's.** A tab that is not on screen must be
  readable too, and the main process has no DOM. Reading the renderer's xterm would also put the
  rules on the UI path. The screen is read as VTE read it (one terminal height ending at the
  cursor row, wrapped rows joined without a newline), so herdr's line counts (14 for Claude Code,
  10 and 6 for Cursor) mean the same lines they mean on a VTE screen.
- **Rules in core, timers in main.** The rules and the debounce are tested with a fake pane and
  fake timers. Main only connects them to Electron.
- **Line breaks as Python's `splitlines()` counts them**, since that is what the counts were tuned
  on.
- **The sound through `paplay`**, which Ubuntu's PulseAudio and PipeWire both provide, with
  Electron's `shell.beep()` when the theme's file or the player is missing. Electron's main process
  has no audio of its own.
- **The settings are read from `state.json` at each notification.** Notifications are rare, and
  Preferences is not built yet, so nothing else holds them.

## Not built here

The widgets: the dots, the tab strip's state, the dropdown's badge (`faceBadge`), the quick
switcher, Go to agent and the toast itself (b1's renderer shows it from `agentState:toast`).
