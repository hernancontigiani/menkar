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
