# Plan 25: a fast first paint, a measured start, and each project's tabs

> **Status:** stub, written 2026-11-09 with the human. Needs `/design-plan` into blocks before it
> runs; for `b2` after plan 24 (or whoever is free).
>
> **Exit, when executed:** `docs/window.md` (the first paint, the start timings) and
> `docs/projects.md` (when a project's tabs start); decisions in `plans/00-STATUS.md` §1; the
> rest → `git log`.

## 1. The start (the human, 2026-11-09)

After a cold boot the window takes 5–10 s to appear, and nothing shows meanwhile: the main window
is created hidden and shown on `ready-to-show` (`src/main/workspace.ts`).

- **Measure first.** One log line per start phase with its duration, in `menkar.log` at the
  default level: process start → app ready → projects/state read → session scan of `~/.claude` →
  import and the usage pass's start → window created → first paint → tabs restored. The human runs
  a cold start and the log names the slow phase; the plan's log records the numbers.
- **Show something at once.** The window appears as soon as the app is ready, with the logo star
  turning in the centre, and the content replaces it when ready. The spinner respects reduced
  motion (a still star) and never shows for a start that is already fast (e.g. only after ~300 ms).
- **Measured by `set`, 2026-11-09** (the packaged build from 8e4c76f under xvfb, throwaway
  config/cache/data dirs, warm disk, nothing to import, no tabs to reopen; Playwright timing to the
  first window): **with the human's real HOME, 6.4–6.6 s to the first window; with an empty HOME,
  0.54 s.** So the wait is work on the home's data before `openFirstWindowIfNone()` — `~/.claude/projects`
  is 2.0 GB here — not Electron itself. Suspects in `src/main/index.ts` order: something in
  `startProjects`, the sessions scan's synchronous part, `startUsagePasses`, `startAgentState`,
  `startContextReadings` or `startWorkspace` blocking the main thread or awaited before the window.
  A cold boot adds disk reads on top. The script: a Playwright `_electron.launch` of
  `release/linux-unpacked/menkar` with XDG_* pointed at a temp dir.
- **Then fix what the numbers point at** — nothing is optimised before it is measured.

## 2. Each project's tabs (the human, 2026-11-09)

The design (`docs/projects.md`, the layout) keeps the tabs of every project a window holds, and
switching projects keeps the other project's sessions running in the background — the human wants
exactly that. The human saw only the last project's tabs reopen after a restart; it may have been a
misreading, so:

- **First, a test that settles it:** tabs in A, switch to B and open tabs, restart, switch back to
  A → A's tabs are there. If it fails, it is a bug to fix here.
- **Then, a lighter start:** on start, only the shown project's tabs start their sessions; the
  other projects' saved tabs are remembered and start when the window switches to that project the
  first time. Once started they keep running in the background when the window switches away, as
  today.

## 3. Part 2 designed (`b1`, 2026-11-10, read in the tree; not built yet)

### What exists

- `reopen()` in `src/core/projects/layout.ts` already keeps every project's saved tabs for each
  window. `startWorkspace` in `src/main/workspace.ts` then starts **every** session tab of
  **every** project at boot: `for (const tab of w.tabs) … await startPane(tab.id, resumeSpec(id))`,
  before `changed()`.
- A tab's live panes are `tabPanes` (tab id → pane ids). `tabView`, `closeTab`, the drawer and the
  agent states all read it, and a tab with no entry is drawn with no panes. A session's pane is
  found by `paneOfSession`.
- `switchProject`, `revealTab` (Go to agent), `openWindowOn` and `newWindowWithProject` change
  which project a window shows; each one ends in `changed()`.

### The design

- **Deferred tab:** a session tab in the layout with no `tabPanes` entry. At boot, only the tabs
  of each window's **shown** project are started. Every other project's session tabs stay in the
  layout, saved and listed, with no process.
- **One place starts them:** `startShownTabs()`, called from `changed()`. For each window, it
  starts every deferred session tab of the shown project (`startPane` per session, as boot does
  today). A `starting` set guards against re-entry while a start is awaited. Every way a project
  becomes shown (switch, Go to agent, a new window, a moved session) goes through `changed()`, so
  no action has its own start.
- **Once started, they stay running** when the window shows another project, as today. Nothing
  is ever stopped by a switch.
- **Closing a deferred tab** only removes it: `closeTab` already skips missing panes.
  `closeAllTabs` and `closeOtherTabs` do the same.
- **A deferred session opened from elsewhere** (the row's Open, the quick switcher):
  `openSession` reveals its existing tab. That switches the project, and `startShownTabs` starts
  it. Open beside of a deferred session: `paneOfSession` is undefined, so it already starts a fresh
  pane in the target. The deferred source tab then loses that session in the layout, as a moved
  session does.
- **What a deferred session shows:** not running (no dot, no ring) in its project's list, which is
  only visible once that project is shown, and by then it is starting. Go to agent lists only
  started tabs, so a deferred tab is reached by switching to its project.
- **The rule this touches:** "a session runs if and only if it has a tab" becomes "…has a tab, once
  its project has been shown in that window since the app started". This is the human's call from
  the stub. It is recorded in `docs/projects.md` and as a decision in STATUS §1 (number from
  `set`).

### Rejected

- **Starting every project in the background after the first paint:** it still costs the same
  processes, and the human asked for on-demand starts.
- **Stopping a project's sessions when switching away:** it would kill running work, which the
  stub excludes.
- **A placeholder "not started" pane in the tab body:** nobody sees a deferred tab before it
  starts, so a placeholder would have no reader.

### Tests, written first

- **PRJ-66 (settles the human's report, runs before any code):** a saved layout where one window
  holds tabs in A (login) and B (api), current B. On start, B's tab shows. After switching to A,
  A's tab is there with its session's pane. After a restart, switching back to A again shows A's
  tab. If this fails on today's build, it is the bug, and the plan's log says so.
- **PRJ-67 (lazy start):** the same fixture. After start, the stand-in's `claude-args.txt` holds
  only B's `--resume`. After switching to A, it holds A's too. Switching back to B leaves A's pid
  alive (`/proc/<pid>`). Quitting before ever showing A keeps A's tab in `projects.json`.
- **PRJ-68:** with A's tab still deferred, "Close all tabs" (which closes every tab of every project
  in the window) removes it too. Nothing of A is left in `projects.json`, there is no process to
  hang up, and no error is logged.
- **The existing PRJ, TRM and AST suites stay green unchanged.**

### Blocks

1. PRJ-66 on the current build, red or green; the log records which. Then PRJ-67 and PRJ-68,
   red.
2. `startShownTabs` and the boot change in `workspace.ts`. Verify: PRJ-66, PRJ-67, PRJ-68, the
   projects, terminal and switcher specs, then `npm run ci`.
3. Docs: `docs/projects.md` (when a project's tabs start) and the rule's new wording. The decision
   goes to `set`. Verify: `npm run ci` (nothing-lost) and a full ui-check, coordinated with `b2`'s
   plan 22 harness.

## 4. Part 1 executed (`b1`, 2026-11-10)

- **Measured** with `set`'s script (electron on a clean build in a `/tmp` copy, throwaway XDG
  dirs, xvfb, warm disk, the human's real HOME, `~/.claude/projects` 2.0 GB in 74 transcripts).
  The new `start timings` line, before:
  `app_ready=52 state_read=6 log_opened=1 projects_read_and_import=6 services_started=4
  session_list=5924 agents_found=1 windows_created=19 first_window_shown=75
  sinceProcessStart=6137`. First window 6.2–6.4 s.
- **Cause:** `startWorkspace` awaited `sessions.list()`, the first full scan. Every other phase
  took under 80 ms.
- **Fix 1, the window first:**
  - The service loads `state.json` apart from the scan, and announces no list before the first
    scan ends.
  - The workspace starts from the state alone. The filter that drops a saved tab whose sessions
    are gone runs once after the scan, and the deferred tab start of part 2 waits for that scan.
  - After: `first_window_shown` at a `sinceProcessStart` of 416–469 ms; Playwright's first
    window at 501–595 ms.
- **The scan itself:**
  - 74 transcripts were read whole in 4 MiB slices to find the name lines. A bench over the same
    files: raw reads 0.67 s, a byte search for the marker 1.0 s, decoding and splitting into
    lines 6.6 s.
  - It is not subagent files: only top-level `<uuid>.jsonl` files are scanned.
  - It is not the head or the tail: 256 KiB and 64 KiB per file.
  - Sequential, but disk and CPU bound, so concurrency was not tried.
- **Fix 2:** `nameLines()` searches each slice's bytes for `-title"` and decodes only the lines
  holding it. A vitest shows it gives the same names as decoding the whole slice; it was seen red
  against a `nameLines` that returns nothing. After: `first sessions scan sessions=74` at a
  `sinceProcessStart` of 2320–2559 ms (it was about 6.1 s).
- **What remains**, about 1.9 s: the raw read (0.67 s), the byte search, and JSON-parsing the
  23 885 lines holding the marker (most are tool output that quotes it). Cheaper still would be
  testing the line's `type` before a full parse, or reading files concurrently. Not done: both are
  proposals.
- **The loading state:** the turning star in the content and a small one with "Loading sessions…"
  in the list, after 300 ms, still with reduced motion.
- **The default log level is `notice`** (between info and warning, as in syslog), so the timings
  line is written by default.

