# Plan 12 — Preferences, Integrations, About, and the Usage window

> **Status:** written 2026-11-08, ready to execute. Executed by `b2`, beside plan 11 (`b1`).
>
> **Exit, when executed:** `docs/preferences.md` (new) and `docs/usage.md` gain what was built; the
> built parts of `docs/spec/preferences.md`, `context.md`, `classifier.md`, `usage.md` and `look.md`
> (the Usage window's section) trimmed to pointers, removed lines to `docs/history/spec/`; `README.md`
> updated; the rest → `git log`.

## Goal

The two windows that show what plans 06, 09 and 10 built: **Preferences** — the General page (every
setting with its default, applied live or after "Restart now", which asks and saves as quitting does,
decision 1.10), themes and languages (English and Spanish, 1.11), the **Integrations** page (the
global statusline's install and removal with consent and backups; the classification switch with its
status line, and "Classify earlier turns…" with its estimate, progress and Stop), and **About**
(the star logo of 1.12, the human's copyright and one credit line, 1.10); and the **Usage window**
(periods, months, All, Totals and By day, the chart stacked by project or by category, Exec / Tokens /
Cost) reading `src/core/usage/` only.

## What it builds, from the spec

Read whole first: `docs/spec/README.md` (with its overriding decisions), `preferences.md`, what
remains of `context.md` (the ring's widget is `b1`'s; the Integrations page is yours), `classifier.md`
(the switch, the earlier-turns dialog, its Look), `usage.md` (the Usage window, USG-44 to USG-54, its
Look) and `look.md`'s "Usage window". Every acceptance case of those parts becomes a test (Vitest for
logic, e2e under `xvfb-run`), named after its id, before the code, seen red. The look reuses `b1`'s CSS
variables and theme module read-only; the Usage chart follows the spec's colors (categories fixed by
their place).

## Seams with plan 11 (`b1`)

Build Preferences and Usage as their own renderer modules (and a window or a dialog each, as the spec
says), opened through entry points you name to `set` early; `b1`'s ⚙ menu calls them. Settings are
written through `sessions.updateState()` (the one `state.json` writer). Changing a setting that
affects open windows (theme, style, font) reaches them through an IPC event you declare in your block;
`b1`'s renderer applies it with its existing look functions — agree the event's shape through `set`.

## Do not touch

`src/renderer/app.ts`, `look.ts`, `terminals.ts`, `src/main/workspace.ts`, `src/main/terminal.ts`,
`src/main/panes.ts`, `src/core/projects/`, `src/core/sessions/` (`b1`); for those, ask `set`.

## Execution blocks

### B1 — Entry points and Preferences' General page
- [x] Name the entry points to `set` first; the General page, themes, languages, Restart now.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B2 — Integrations and About
- [x] The statusline integration, the classification switch and the earlier-turns dialog; About.
- **Verification:** `npm run ci`; `npm run ui-check`; invariance on `~/.claude/settings.json` outside
      the integration's own keys.

### B3 — The Usage window
- [x] Periods, months, All, Totals and By day, the chart, the categories while classification is on.
- **Verification:** `npm run ci`; `npm run ui-check`; screenshots beside the spec's, compared.

### B4 — Exit
- [x] The exit's files.
- **Verification:** `npm run ci`.

## Execution log

Executed by `b2`, 2026-11-08.

**B1 — entry points and General.** The entry points were named to `set` first and approved:
`src/main/windows.ts` (`openPreferences(parent, page?)`, `openAbout(parent)`, `openUsage(parent)`),
one child window each with its own page (`src/renderer/{preferences,about,usage}.html`, renderer
inputs in `electron.vite.config.ts`). `src/main/preferences.ts` (`settings:get`, `settings:set`,
`app:restart` on the workspace's `quitApp()`, which b1 added on request), `src/core/preferences.ts`,
`language`, `notify_idle` and `notify_sound` in `src/core/settings.ts`, the language setting read at
start in `src/main/index.ts`, `src/renderer/preferences.ts` and `windows.css`. Strings in my block of
both catalogs. Tests: `tests/core/settings.test.ts` (PRF-3) and `e2e/preferences.spec.ts` (PRF-1 to
PRF-4, PRF-8, PRF-14 to PRF-17, PRF-22 to PRF-24, Restart with nothing running and with a session
running).

**B2 — Integrations and About.** `src/renderer/integrations.ts` (the status line switch, the
classification switch, the earlier-turns dialog), `src/renderer/about.ts`, the
`integrations:statusline` / `:set-statusline` and `app:open-link` IPC. Tests:
`e2e/integrations.spec.ts` (install and remove with the byte backup and the user's keys kept; a
refused change leaving the file's hash unchanged; the switch, the dialog's count and estimate, and a
run with the stand-in `claude`; About, with its link opened only on a click).

**B3 — the Usage window.** `src/core/usage/{chart,stepper,nodes}.ts` (the Node-free parts the page
uses; `nodes.ts` took the report's types and formats out of `report.ts` and the token sums out of
`history.ts`, both re-exporting them), `src/main/usage-query-worker.ts` (a fifth main entry),
`usageView` and `currentMemberships` in `src/main/usage.ts`, `src/renderer/usage.ts` and `usage.css`.
Tests: `tests/core/usage/{chart,stepper}.test.ts` and `e2e/usage-window.spec.ts` (USG-44 to USG-47,
USG-50, USG-52, USG-53, USG-39's hint). Screenshots compared with the spec's: same layout. Two
differences were fixed: the list's 12 px corners, and 50 px rows. Mine are light because xvfb's
desktop is light.

**B4 — exit.** `docs/preferences.md` (new), the Usage window in `docs/usage.md`, the row in
`CLAUDE.md`, "Preferences and usage" in `README.md`; `docs/spec/{preferences,usage,classifier,
context,look}.md` trimmed, removed lines verbatim in `docs/history/spec/`.

Also for b1 (through `set`): `sessionTokens(sessionId)` in `src/main/usage.ts` for the session
details' Tokens row, from `UsageHistory.sessionTokens` (tested in `tests/core/usage/measure.test.ts`).

Deviations and what the plan did not anticipate:
- **The usage passes ran with no memberships** (`NO_MEMBERSHIPS`, from before projects existed), so
  every turn would have gone to "(no project)". They now get `currentMemberships()`.
- **The Font row** is the installed monospace families (`fc-list`) plus a size. Electron has no
  system font chooser. **The earlier-turns dialog** uses the system's date picker, not an
  always-open month calendar.
- **`chart.ts` was not Node-free** as first written (it imported `report.ts`), so the pure parts
  moved to `nodes.ts`.
- **A relaunch registered before the quit cannot be seen from a test.** Under Playwright such a
  relaunch did not happen at all, so the test that Cancel never relaunches holds, but it could not
  be seen red against that mistake. The nothing-running test is red without the relaunch.
- **Mutations**: run on the core tests (chart, stepper, settings, sessionTokens), all caught. For
  the e2e tests, on the restart, the refused integration and the earlier-turns row.
- **Left in the spec**: the PRF cases whose effect shows in b1's windows (font and theme in
  terminals, scheme flips, folder path in Add session, notifications, reopening), PRF-21 and
  PRF-25 to PRF-30; USG-51 (the limits footer) and USG-54 (a late report dropped, built but not
  tested); CLS-1, CLS-30, CLS-31 and CLS-32.
