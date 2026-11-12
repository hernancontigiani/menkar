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
  - Whether a session notifies at all is asked first, outside this folder: `notifiesFor`
    (`src/core/orchestration/notifies.ts`) — a session muted by hand never does, and in the
    orchestration mode a session under the orchestrator does not unless it is "with you"
    (decisions 1.99, 1.104; `docs/orchestration.md`). With the mode off, an unmuted session
    notifies exactly as before. A topic's notice uses the same plan and the same tray, keyed by its
    project and number (`notifyTopic`).
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

## Background work is working (decision 1.105, 2026-11-12)

- A Claude Code session whose agent still runs a background task (a shell, a monitor, a subagent,
  a team, an MCP task, a workflow, a cloud session) is **working**, not idle, in any mode. The human
  saw a session green while it waited on its own background `npm run ui-check` and thought it had
  stalled.
- **Read from the footer's pill**, like every other rule: `CLAUDE_BACKGROUND_PILLS` in `detect.ts`,
  in the last 3 non-empty lines. The pill starts the footer's line or follows a ` · `, so a count
  in the conversation or typed in the box does not count. Its texts were read in Claude Code
  2.1.323's program (`1 shell`, `2 monitors`, `↳ 3 background`, `◇ 1 cloud session`…): what it
  counts is the `/tasks` list, tasks running or pending and not in the foreground. Not yet checked
  against a capture of a real screen; the patterns are in one list to correct.
- **Claude Code's housekeeping is not work**: `saving memories`, `dreaming`, `auto-mode scan`,
  `memory import` carry no count and stay idle.
- **Why not the Stop hook's `background_tasks`.** Claude Code's Stop and SubagentStop hooks do
  carry the tasks in flight, but only at a turn's end: a task that ends, or is stopped from
  `/tasks`, with no turn after it, would leave the session working. The pill comes and goes with
  the task. `TaskCreated` and `TaskCompleted` are the task list's (TaskCreate), not background work.
- Done follows: a session that ends its turn with a shell running stays working while unseen, and
  is done once the pill is gone.

## Not built here

The widgets: the dots, the tab strip's state, the dropdown's badge (`faceBadge`), the quick
switcher, Go to agent and the toast itself (b1's renderer shows it from `agentState:toast`).
