# Plan 18: the phone icon shows Remote Control as it is now

> **Status:** written 2026-11-09, ready to execute. Executed by `b2`.
>
> **Exit, when executed:**
> - `docs/remote-control.md` gains "What the icon shows": the source, how it is read, and the
>   fallback.
> - Decision 1.18 stays in `plans/00-STATUS.md` §1.
> - The rest goes to `git log`.

## Goal

Today the phone icon shows only Menkar's own per-session setting, "start this session with
Remote Control". A user who turns Remote Control on inside a session with `/remote-control` sees
no icon. The human hit this with `set`. After this plan the icon shows whether the session's
bridge is connected now, whichever way it was turned on. The menu switch keeps its meaning.

## Decided (the human, 2026-11-09; decision 1.18)

- **Two things, kept apart:**
  - **The icon** shows the live state: a Remote Control bridge is connected for that session's
    running process.
  - **The switch** in the row and tab menus, and New's switch, set what Menkar does when it
    starts the session (`--remote-control`). This is unchanged from today.
- **The source** is Claude Code's per-process registry, `~/.claude/sessions/<pid>.json`. Its
  `bridgeSessionId` is a string while a bridge is connected. It is null or absent otherwise.
- **The evidence.** b2 read the CLI's code and the live files. The human confirmed it by hand on
  2026-11-09:
  - `/remote-control` → connect set the field;
  - disconnect set it to `null`, with `updatedAt` moving;
  - a session with no Remote Control has no value.
- **Read only.** Menkar never writes there. The rule in `CLAUDE.md` holds: the agents' data is
  read, never rewritten.
- **The format is undocumented**, so the reading is best-effort. If the file is missing or
  unreadable, the shape is unexpected, or the pid or `procStart` doesn't match, the icon falls
  back to today's rule: Menkar's own list. It never shows "off" because a read failed. A
  malformed file is logged once per pid, not on every poll.

## What it builds

### B1: the reader (core plus main)

- **Core: `src/core/remote/live.ts`**, pure.
  - `bridgeState(json: unknown, expect: { pid; sessionId? }): 'on' | 'off' | 'unknown'`.
  - It returns `on` for a non-empty string, `off` for null or absent when the rest of the shape
    is right, and `unknown` otherwise.
  - The pid must match. The sessionId must match when the pane knows it. A new session learns its
    sessionId only once its transcript appears, so until then the pid alone decides.
  - `procStart` is checked when present, so a reused pid is not mistaken for the session.
- **Main.**
  - The panes Menkar spawned know their claude process.
  - **Finding the claude pid.** Menkar spawns a shell, and the shell runs `claude`. The claude
    pid is found as the pty's child whose command is the agent. Linux: `/proc/<shellpid>/task/*/children`,
    then `/proc/<pid>/cmdline`. That logic is pure, in core, with a fake `/proc` in tests.
  - **Watching the files.** Watch `~/.claude/sessions/` (`fs.watch` on the folder), debounced at
    250 ms, and re-read the files of the panes that run an agent. The watch is backed by a 5 s
    poll, because `fs.watch` can miss events.
  - **No new process, no network.**
- **IPC.** The live state joins the agent-state push the window already gets. That is one
  targeted field in the shared types (`remoteLive: 'on' | 'off' | 'unknown'` per pane), not a new
  channel.

### B2: the icon

- **Row and tab.** The phone icon shows when `remoteLive === 'on'`, or when it is `'unknown'` and
  the session is in Menkar's list. That is today's behaviour as the fallback.
- **Tooltip.** It says what is true:
  - "Remote Control connected";
  - "Remote Control on at start (state unknown)" for the fallback.
  - en and es.
- **Sessions with no running process** (no tab) show no live icon. The setting stays visible in
  the menu switch, as today.
- **Nothing is typed into the agent.** The icon is display only. The existing toast ("type /rc")
  stays as it is.

### B3: exit

- `docs/remote-control.md` "What the icon shows":
  - the two meanings, and the source with a sample of its shape;
  - the fallback;
  - why the transcript and `~/.claude.json` were rejected: the transcript never records "off",
    and `replBridgePlaceholders` is swept on a cap and keyed by bridge.
- One `NOT_BUILT_YET` line: macOS and Windows find the claude pid differently, triggered by
  those ports.
- Add a hand-check row to STATUS §2: `/rc` connect and disconnect in a tab, and the icon follows
  within a second or two.

## Do not touch

- `~/.claude` and `~/.claude.json`: read only.
- The menu switch's behaviour, New's switch and the toast.
- `b1`'s terminal code, beyond the one call that exposes a pane's pty pid if it's not already
  exposed. Coordinate that with `b1`.

## Verification

- **Vitest:**
  - `bridgeState` over on, null, absent, a wrong pid, a wrong sessionId, a pid reused with
    another `procStart`, and garbage JSON;
  - the claude-pid finder on a fake `/proc`.
- **e2e:** the stand-in claude writes a fake registry file under a fixture `CLAUDE_CONFIG_DIR`
  (or whatever the path resolver uses), with `bridgeSessionId` set, then null, then removed.
  - The icon appears, disappears, and falls back to the list.
  - Each case seen red first.
- `npm run ci`, and `npm run ui-check` from a clean `out/`.
- A screenshot of a row and a tab with the live icon → `/tmp/menkar-shots/rc-live.png`.

## Execution blocks

### B1: the reader
- [ ] Core `bridgeState` and the pid finder, with their tests; the main watcher; one IPC field.
- **Verification:** `npm run ci`.

### B2: the icon
- [ ] Row, tab and tooltips; e2e.
- **Verification:** `npm run ci`; `npm run ui-check` from a clean `out/`.

### B3: exit
- [ ] The exit's files.
- **Verification:** `npm run ci`.

## Execution log
