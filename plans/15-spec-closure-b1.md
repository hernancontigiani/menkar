# Plan 15 — closing the spec in `b1`'s areas

> **Status:** written 2026-11-08, ready to execute. Executed by `b1`, beside plan 14 (`b2`).
>
> **Exit, when executed:** each area file named below holds only pointers to the built docs, plus,
> where some case cannot be automated, a short "Checked by hand" list that moves to
> `plans/00-STATUS.md` §2 as the human's checks; the removed lines go verbatim to `docs/history/spec/`.

## Goal

Every acceptance case that is still written in `docs/spec/look.md`, `terminal.md`, `sessions.md`,
`files.md`, `remote-control.md`, `projects.md` and `agent-state.md` ends in one of three states:
**built and tested** (Vitest or e2e, named after its id, seen red), **checked by hand** (it needs a
real display, the desktop's trash service, the phone, a second monitor — named in §2), or **decided
against** (a recorded decision says why; the case is struck with the decision's number). Nothing is
left as "built but untested".

## What it builds

Start with an inventory in the log: for each remaining case id, its state today (built-untested,
missing, hand-only) — the logs of plans 08, 11 and 13 (in git) list most of them, e.g. FIL-7, 9, 11,
16–19, 21, 22, 26–30, 33–39; RC-3, 4, 11, 12, 14, 17–21, 25–27; the look cases that need a computed
style or a screenshot comparison. Then close them, area by area. A case whose behaviour turns out
to differ from the spec is fixed in the code, not in the spec, unless the spec contradicts a
recorded decision (then say so to `set`).

## Do not touch

`src/core/chat/`, `src/main/chat.ts`, `src/renderer/chat.*`, `src/renderer/mcp.*`, and `b2`'s areas
(usage, classifier, context, agent-state core, preferences, the Usage window). `b2` is finishing plan
14 in the same tree.

## Execution blocks

### B1 — Inventory
- [ ] The table of remaining cases and their state, in the log; send it to `set` before closing them.
- **Verification:** `set` has the table.

### B2 — Close look, terminal, projects, agent-state
- [ ] Each case to one of the three states.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B3 — Close sessions, files, remote-control
- [ ] Each case to one of the three states.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B4 — Exit
- [ ] The spec files trimmed; §2 gets the hand checks, one line each.
- **Verification:** `npm run ci`.

## Execution log

### B1 — Inventory (2026-11-08)

The states:
- **T**: tested already under the id (Vitest or e2e); the spec line only needs trimming.
- **U**: built, untested; to test.
- **M**: missing; to build and test.
- **H**: needs a real desktop service; to check by hand.
- **D**: decided against, struck with the decision.
- **b2**: in `b2`'s area.

Native file choosers become testable by patching `dialog.showOpenDialog` / `showSaveDialog` from
the e2e through `electronApp.evaluate`.

| Area | T (trim) | U (test) | M (build) | H (by hand) | D / b2 |
|---|---|---|---|---|---|
| look | 21, 38, 41, 44 | 1, 4, 7–15, 16, 17 (dot classes, computed), 18–20 (the ring: a pure function + Vitest), 24–28, 30–36, 40 (emulated `prefers-color-scheme`), 42, 43, 45–49, 52 | — | 5 (an unfocused window keeps its bars), 22 and 29 (need real blocked or working agents) | 50, 51 (the Usage window: b2) |
| terminal | 56 | 10–14, 17, 18 (chooser patched), 19, 21–25, 27, 29, 30, 33, 36, 40, 47, 48, 50, 52, 55 (font set live through b2's settings path); 20 (the give-up after 120 tries: the join matcher pulled into a pure function with Vitest) | — | 15 (cancel in the native chooser) | 39, 41–46, 51: decision 1.9 (hang up, nothing typed); the behaviour the cases now hold is asserted as built. 16: a non-local folder cannot come out of Electron's chooser |
| sessions | 41 | 2 (UI), 13 (the join part), 16–18, 30, 33, 34, 35, 39, 40 (`new_session_dir`), 42, 43, 45, 46, 47, 50, 55 (save dialog patched), 57, 60–63, 70; 44 (`joinTarget`: T in core, plus an e2e) | — | 64, 66, 68 (the desktop's trash, `shell.trashItem`) | — |
| files | — | 7, 9, 11, 14, 16, 17, 18, 19 (a save refused by the system: the file made read-only after opening), 21, 22, 26–30, 33, 35, 36, 37, 38 | 39 ("Could not open transcript" when the file goes between choosing and reading) | 34 (`menkar open` as the first instance under Playwright: `cliArguments` cannot see past Playwright's loader flags) | — |
| remote-control | 20, 27 | 3, 4, 11, 12, 14, 17, 18, 19, 21, 25, 26 | — | — | — |
| projects | — | 1, 2, 12, 15–26, 28–44, 46, 47, 48, 54, 56, 57 | — | — | — |
| agent-state | — | 18 (a shell pane gets no mirror, so no state), 28 (reveal through `panes:reveal`; the desktop notification's own click is H) | — | the notification click of 28; 38 (needs real working or blocked agents) | — |

Totals: about 160 U, 1 M, 9 H (LOOK-5, 22, 29; TRM-15; SES-64, 66, 68; FIL-34; AST-38 and the
notification click of AST-28), 7 cases decided against by 1.9 (TRM-39, 41–46, 51) and TRM-16 by
what Electron's chooser can return, and LOOK-50 and 51 for b2.
