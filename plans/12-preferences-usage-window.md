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
- [ ] Name the entry points to `set` first; the General page, themes, languages, Restart now.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B2 — Integrations and About
- [ ] The statusline integration, the classification switch and the earlier-turns dialog; About.
- **Verification:** `npm run ci`; `npm run ui-check`; invariance on `~/.claude/settings.json` outside
      the integration's own keys.

### B3 — The Usage window
- [ ] Periods, months, All, Totals and By day, the chart, the categories while classification is on.
- **Verification:** `npm run ci`; `npm run ui-check`; screenshots beside the spec's, compared.

### B4 — Exit
- [ ] The exit's files.
- **Verification:** `npm run ci`.

## Execution log

(Written by the session that executes it.)
