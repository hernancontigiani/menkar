# Plan 16 — closing the spec in `b2`'s areas, and the first release candidate for Ubuntu

> **Status:** written 2026-11-08, ready to execute. Executed by `b2`, beside plan 15 (`b1`).
>
> **Exit, when executed:** `b2`'s area files hold only pointers (plus hand checks moved to
> `plans/00-STATUS.md` §2), removed lines to `docs/history/spec/`; `README.md` "Install" describes the
> release candidate; `docs/packaging.md` gains how a release is cut; the rest → `git log`.

## Goal

Two things that end the first version: every remaining acceptance case of `usage.md`,
`classifier.md`, `context.md`, `preferences.md` and `chat.md` built and tested, checked by hand, or
decided against (as plan 15 does for `b1`'s areas); and Menkar 0.1.0 as a release candidate for
Ubuntu — the `.deb` built, inspected and smoke-tested, with one page of what the human checks by hand
before calling it the first version.

## What it builds

- **B1 — Inventory and closure** of the five area files, as plan 15 describes (built and tested /
  checked by hand / decided against; nothing "built but untested"). Send `set` the inventory first.
- **B2 — The release candidate:** the version set to `0.1.0` in `package.json` (one change, shared
  file); `npm run package`, `package:check`, `package:smoke` green against it; the `.deb`'s size and
  file count in the log; `README.md` "Install" for 0.1.0; and `docs/release-checklist.md` — the human's
  checks gathered from `plans/00-STATUS.md` §2 into one ordered list (install, first start with the
  agent-tablet import, a day of work, Usage, the classifier, Remote Control from the phone, the
  Markdown preview on a real screen, retaking the screenshots that Broadway squeezed), each with what
  "passes" means. Never install the package; that is the human's.

## Do not touch

`b1`'s areas and files (plan 15 is closing them in the same tree): the renderer's main window
modules, `src/main/workspace.ts`, `terminal.ts`, `files.ts`, `panes.ts`, `src/core/projects/`,
`src/core/sessions/`, `src/core/files/`.

## Execution blocks

### B1 — Inventory and closure
- [x] The inventory to `set`; then each case to one of the three states.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B2 — The release candidate
- [x] Version, package, checks, the checklist.
- **Verification:** `npm run ci`; `npm run package:check`; `npm run package:smoke`.

### B3 — Exit
- [x] The exit's files.
- **Verification:** `npm run ci`.

## Execution log

### B1 — Inventory (2026-11-08)

States as in plan 15: **T** tested under the id already (trim, or tag the existing test with its
id); **U** built, untested (to test, seen red); **M** missing (to build); **H** by hand; **D**
decided against.

| Area | T | U | M | H | D |
|---|---|---|---|---|---|
| usage | USG-1–50, 52, 53, 55–69 (trim) | 51 (limits in the footer: a statusline log with 41.4 / 12.6), 54 (latest-wins: the guard pulled into one pure helper shared with CLS-32, Vitest, plus an e2e with the first report delayed) | — | — | — |
| look (routed from b1) | — | LOOK-50 (the chart's segment fills, computed, dark and light), LOOK-51 (the Totals card in Mocha: background, 12 px radius, square rows) | — | — | — |
| classifier | CLS-1's core part (`lock.test.ts`) | CLS-1's UI part (row hidden, no `claude -p` started, no category level in Usage), 30 (0 turns: "Classify", disabled), 31 (history unreadable: the sentence, disabled), 32 (the race: the guard exists, the e2e titled with it does not assert it) | — | — | — |
| context | CTX-1–39 (trim) | — | — | — | — |
| chat | — | CHT-4 (chooser patched: title and `defaultPath`), 13 (the Cursor trusted banner is the one not asserted), 27 (user `**not bold**` shown plain), 28 (follow / not follow at 48 px) | — | — | CHT-7: Electron's chooser returns only local paths (as TRM-16) |
| preferences | PRF-26, 27 (`tests/core/i18n.test.ts`, tag the ids), 28 (`tests/core/jsonstate.test.ts`, tag) | PRF-5, 6, 7, 9, 10 and 11 (`emulateMedia` colorScheme in every window), 12, 13, 18, 20 (relaunch-free: a second launch on the same dirs), 21, 25, 29 (test only; the drag code is b1's), 30; PRF-19 the setting reaching the notifier | — | PRF-19's real desktop notification and sound | — |

Totals: about 30 U, 0 M, 1 H (PRF-19's notification and sound), 1 D (CHT-7), and the T lines to
trim. The area files' **Look** sections carry measurements without ids (series colors, the ring,
chat bubbles, dialogs): asked of `set`.

`set` approved the inventory as sent, with option (a) for the Look sections: assert the cheap
measured values, move the rest to `docs/history/spec/` as built.

### B1 — Closure (2026-11-08)

Each new test was seen red against an injected defect (or an inverted assertion where the code is
`b1`'s), then green:

- `src/core/latest.ts` + `tests/core/latest.test.ts`: `latestOnly()`, the guard shared by the
  Usage window's report (USG-54) and the earlier-turns count (CLS-32).
- `e2e/usage-window.spec.ts`: USG-51 (limits in the footer, as rendered), USG-54 (both arrival
  orders, with main's `usage:view` held back), LOOK-50 (series colors, dark and light, swatches
  and segments), LOOK-51 (the Totals card).
- `e2e/integrations.spec.ts`: CLS-1 (UI part), CLS-30, CLS-31 (the history unreadable and not
  movable aside), CLS-32 (main's `classifier:estimate` held back for day A).
- `e2e/chat.spec.ts`: CHT-4 with PRF-30 (both choosers, remembered and deleted folder), CHT-13
  (the trusted banner), CHT-27, CHT-28 (a slow stream from the stand-in), and "the chat look".
- `e2e/preferences-rows.spec.ts`: PRF-5 (terminal half), 6, 7, 9, 10, 11, 12, 13, 18, 19, 20, 21,
  25, 29. PRF-26, 27, 28 and PRF-19's notifier tagged on existing Vitest tests (one row added:
  `ja-JP` → English).

Defects the closure caught and fixed, in `b2`'s files:

- LOOK-51: `.card` in `windows.css` used `var(--radius)`, 0 in Terminal workspace; cards are 12 px
  in both styles, only rows are square.
- USG-51: the footer's `white-space: pre-line` collapsed the three spaces between the blocked time
  and the limits (agent-tablet keeps them); now `pre-wrap`, asserted on the rendered text.
- The chat look: `chat.css` departed from the spec's table (bubble radius and colors, the chip,
  the permission card's border, padding, shadow and header); now as measured, asserted.

Split and left: PRF-5's file-tab half (`editor.ts` never reads the font) goes to `b1` in plan 15,
by `set`. CHT-7 decided against (Electron's chooser returns local paths only, as TRM-16). PRF-19's
real notification and sound: `plans/00-STATUS.md` §2 row 2.5. The context ring's behaviour and
look stay in `docs/spec/context.md` for `b1`'s ring tests (LOOK-18–20).

Spec trimmed: `usage.md`, `classifier.md`, `preferences.md`, `chat.md` hold pointers only; the
removed lines are in `docs/history/spec/`.

Verification: tsc 0 errors; Vitest 581 passed; code rules, i18n, test integrity, flaky, history
green; Biome red only on `b1`'s in-flight files (`e2e/fixtures.ts`, `e2e/panes.spec.ts`,
`src/renderer/style.css`). The new e2e files green, each run on its own.

### B2 — The release candidate (2026-11-08)

- `package.json` and the two matching fields of `package-lock.json`: `0.1.0`.
- `npm run package`: `release/menkar_0.1.0_amd64.deb`, 102 509 188 bytes, 291 entries (244
  files), installed size 287 321 KiB.
- `npm run package:check`: "release/menkar_0.1.0_amd64.deb — 291 entries, launcher, command and
  sandbox profile in place".
- `npm run package:smoke`: the first run had 115 passed, 1 failed: PRF-24's relaunch test looked
  for `electron` in the relaunched process's command line, and the packaged app runs as `menkar`.
  It now matches the executable under test, and passes on both builds. The second run had 121
  passed, 3 failed, all `b1`'s new terminal cases (TRM-18, TRM-36/40, TRM-52) against a package
  built before their code: the package is rebuilt from the committed tree before the human's
  checks.
- `docs/release-checklist.md`: ten ordered checks, each with what passes. `README.md` "Install"
  names 0.1.0; `plans/00-STATUS.md` §2 row 2.2 points to the checklist; a `CLAUDE.md` docs row.
- The package was not installed.

### B3 — Exit (2026-11-08)

`docs/packaging.md` gains "Cutting a release". The area files hold pointers (B1). The rest is in
`git log` once committed.


### After review — the Usage views fill the window; decision 1.13 (2026-11-08)

- **The views fill the window** (asked by the human through `set`): the window is a column, the
  header at the top and the footer at the bottom; By day's plot takes the height left once its
  legend is laid out, drawn at the measured size and redrawn on resize; Totals' card takes the
  height left and scrolls inside. `src/renderer/usage.{ts,css}`. Test: "the Usage views fill the
  window" in `e2e/usage-window.spec.ts`, at 1400 × 900 then 1000 × 700; red on the old layout
  (the footer 840 px below the window), green now.
- **Decision 1.13 — the By-day axis labels** (the human's, through `set`): 7 days, every bar,
  weekday and day ("Mon 2", "lun 2"); 30 days and Month, the first bar and every Monday, day and
  month ("Nov 2", "2 nov"), a label dropped where it would run into the one before it; hours and
  months as before. Formatted through `Intl.DateTimeFormat` in the app's language.
  `axisLabels()` in `src/core/usage/chart.ts`; Vitest in `tests/core/usage/chart.test.ts` (7 days
  in English and Spanish, 30 days across a month boundary, a month starting on a Monday, the
  collision, hours), red before the function existed.
- Screenshots: `/tmp/menkar-shots/usage-by-day-2.png` (7 days), `usage-by-day-month.png` (Month),
  `usage-by-day-30d.png` (30 days).

### After review — decision 1.14 and the label stride (2026-11-08)

- **Decision 1.14 — the By-day axis** (the human's, through `set`), replacing "the smallest 1, 2 or
  5 × a power of ten at or above the tallest bar; labels at 0, half and top" (that line is in
  `docs/history/spec/usage.md`): the top is the first multiple of a 1, 2, 2.5 or 5 × 10^n step at
  or above the tallest bar, the step the smallest that leaves at most five intervals, a grid line
  and a label on each; time is stepped in hours from one hour up and in minutes below, so a 2.9 h
  bar tops out at 3 h, not 5.6 h; Exec, Tokens and Cost alike. `axisScale()` in
  `src/core/usage/chart.ts`, `Chart.axisStep`; the old `axisTop()` and its test row set are
  replaced (test integrity reports the one `expect(axisTop(…))` line, removed on purpose).
- **Decision 1.13 amended — the label stride**: 30 days and Month label the first bar and then
  every 1, 2, 3, 7 or 14 days, the smallest stride whose labels do not collide at the plot's
  measured width (instead of Mondays only); recomputed on every draw, so on resize; 7 days
  unchanged.
- `docs/usage.md` "The Usage window" now states the fill, the axis and the labels.
- Tests: `tests/core/usage/chart.test.ts`, the axis for each metric (9 cases) and the stride (wide:
  every bar; middling: every second; narrow: a week; the stride always one of the five, from the
  first bar), red before the code; Vitest 590 passed; `e2e/usage-window.spec.ts` 9 passed.
- Screenshots: `/tmp/menkar-shots/usage-by-day-30d-2.png`, `usage-by-day-month-2.png` (1400 × 900),
  `usage-by-day-month-1000x700.png`.

### After review — decision 1.15, Usage's scope (2026-11-08)

- **Decision 1.15** (the human's, through `set`): Usage shows the project of the window it was
  opened from, Totals and By day alike; "All projects" in the header switches to every project and
  back; with no project to scope to, every project and no toggle. One project's By day stacks by
  category with classification on, and is its plain bar otherwise; its Totals keep the tree.
- Wiring, without touching `b1`'s files: `usageOpener()` in `src/main/windows.ts` finds the main
  window a Usage window was opened from; `usage:view` reads its shown project through
  `workspace.windowState()` (an existing getter) and passes it with `allProjects` to `usageView()`
  and the query worker; `ReportOptions.project` filters in `buildReport`. `ipc.ts` and the preload:
  one line each. `usage.allProjects` in English and Spanish.
- Found: every window shows a project (a first start creates "Default"), so from the UI Usage is
  always scoped; a fresh install opens on the empty Default until "All projects" is pressed.
- Tests: Vitest "a report scoped to one project…" in `tests/core/usage/measure.test.ts` (red before
  the filter); e2e in `e2e/usage-window.spec.ts`: the opener's project and the toggle, the category
  stack with classification on, and a caller that is not a Usage window (each red against its own
  injected defect). The earlier Usage cases, written for every project, press "All projects" in
  their helper.
- Screenshots: `/tmp/menkar-shots/usage-project-byday.png`, `usage-project-totals.png`.
