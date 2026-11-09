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
- [x] The table of remaining cases and their state, in the log; send it to `set` before closing them.
- **Verification:** `set` has the table.

### B2 — Close look, terminal, projects, agent-state
- [x] Each case to one of the three states.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B3 — Close sessions, files, remote-control
- [x] Each case to one of the three states.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B4 — Exit
- [x] The spec files trimmed; §2 gets the hand checks, one line each.
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

`set` approved the table as classed (2026-11-08); LOOK-50 and 51 go to `b2`'s plan 16.

Added by `set` (2026-11-08): the file-tab half of PRF-5. The editor takes the font setting's
family and size; `b2` tests the terminal half.

### B2 — Look (2026-11-08)

Tested by id in `e2e/look.spec.ts` (computed styles and pixels captured from the window through
`capturePage`) and `tests/core/ring.test.ts` (the ring, now a pure function in `src/core/ring.ts`):
LOOK-1, 4, 7–20, 24–28, 30–36, 40–49, 52. Seen red: the run with one injected defect per case
failed 24 of 30; the other six were red against the defects below before their fixes.

Fixed in the code where the behaviour differed from the spec:
- The divider could not be grabbed (the content painted over it) nor dragged (pointer capture
  lost the moves), and any render in the middle of a drag snapped the sidebar back.
- The header's title was centered over the space left by the buttons, not over the content.
- Classic drew a ring on working and done dots; PREFIX sat after `+` instead of at the strip's
  right end; the frame label stood 11 px from the frame's left.
- Add session's empty Existing page shows the star (1.12), like the window's empty states.

PRF-5, the file tabs: the font's family and size reach the editor through two CSS variables set
with the terminals' font, so an open tab follows at once and a new one starts in it
(`e2e/files.spec.ts`, seen red on the editor's own 11 pt).

### B2 — Terminal (2026-11-08)

Tested by id in `e2e/terminal.spec.ts`: TRM-10–14, 17, 18, 21–25, 27, 29, 30, 33, 36, 40, 47, 48,
50, 52; TRM-55 with LOOK-36. TRM-19 and 20 in `tests/core/sessions/join.test.ts`: the join
lookup moved into `src/core/sessions/join.ts`. Seen red: one run with a defect per case failed
14 of 15; TRM-33 went red with both its guards removed (the renderer's and main's). The stand-in
`claude` now reads its input raw, records it as hex and exits on `EXIT0` or `EXIT1`.

Fixed: a pane's output could show twice, or lose a chunk, because the attach buffer and the live
chunks travel separately and arrive in either order. Every chunk now carries where it ends in the
pane's output, and the window joins the two by that (`src/core/output.ts`, Vitest and an e2e that
failed 2 of 2 runs before the fix). The command echoed twice (before the prompt and after it)
matches agent-tablet, which writes it the same way; kept (`set`, 2026-11-08).

Added by `set` (2026-11-08), the human's asks: the star before the header's title, the settings
button as a gear, the tab's ring after its name, and the group shown as a line under the tab
instead of a dot, the selected tab marked by its background and bold name in both styles.
Built and tested in `e2e/look.spec.ts` as LOOK-53 (the star before the title, the gear) and
LOOK-54 (dot, name, ring, ×), with LOOK-24/28 (the group line) and LOOK-25 (Classic's selected
tab without a line) rewritten to the new look; each seen red before the change.

### B2 — Projects (2026-11-08)

Tested by id in `e2e/projects.spec.ts`: PRJ-1, 2, 12, 15–26, 28–44, 47, 48, 54, 56, 57; PRJ-46
with TRM-50. Seen red: one run with a defect per case (core layout and model, the join lookup,
the renderer) failed every one; PRJ-19 first passed against its defect because it never checked
the click had selected the second tab, and was tightened.

Fixed:
- The delete dialog counted running sessions from this window's last state, so one running in
  another window was missed (PRJ-17): it asks main for the state first.
- Open beside left the focus where it was (PRJ-28): main returns the pane, which takes the focus.
- Renaming a file tab did nothing (PRJ-42): its label is used, for as long as the tab lives.

Decided against: PRJ-1's "no file exists until the first change". The first start's import
writes both of Menkar's files at once, even when nothing was imported, so that the next start is
not a first start (`docs/projects.md`); the case's visible part is tested.

### B2 — Agent state (2026-11-08)

Tested by id in `e2e/agent-panes.spec.ts`: AST-18 (with the agent pane's own question as the
control that does block; the stand-in prints one on `ASK`) and AST-28 through `panes:reveal` (the
notification's own click stays the human's check). Seen red: shell panes registered as agent
panes, and a reveal that does not switch the window's project.

### B3 — Sessions (2026-11-08)

Tested by id in `e2e/sessions-cases.spec.ts`: SES-2, 13, 16, 17, 18, 30, 35, 39–43, 45, 46, 47,
50, 55, 57, 60–63, 70; SES-33 and 34 with PRJ-34 and 35; SES-30 also in `tests/core/tilde.test.ts`.
SES-44 stays in core (`joinTarget`, named in `tests/core/projects/model.test.ts`): through the UI
the start project's deletion closes the new session's tab, so it never joins (asked `set`). Seen
red: one run with a defect per case failed all 19.

Fixed:
- Paths under home were shortened to `~` by guessing home from a session folder that starts
  with `/home/`: wrong on macOS and with any other home. The window state carries the home
  folder, and `src/core/tilde.ts` shortens by its prefix.
- After a right click on a history row the focus fell to the body, and Esc no longer closed Add
  session: it listens on the document now (a menu or a dialog over it takes Esc first).

`set` (2026-11-08): SES-44's path through the UI is unreachable by design (deleting a project closes its tabs); the spec says so in B4, pointing at the core test.

### B3 — Files (2026-11-08)

Tested by id in `e2e/files-cases.spec.ts`: FIL-7, 9, 11, 14, 16–19, 21, 22, 26–29, 33, 35–39
(FIL-30 was tested already). Seen red: one run with a defect per case failed all 16; the preview's
scroll fix also alone.

Built: FIL-39. A transcript that is gone or unreadable between the chooser and the read is
refused, and the window says "Could not open transcript" with Menkar's sentence.

Fixed:
- Open session file named the replay tab after the file's id, not the transcript's title, and
  its chooser was titled "Open session file…" and did not start in `~/.claude` (FIL-36).
- The preview lost its scroll when it re-rendered while its tab was not shown: the scroll is
  kept as the user leaves it and put back when the frame shows (FIL-26).

### B3 — Remote Control (2026-11-08)

Tested by id in `e2e/remote.spec.ts`: RC-3, 4, 11, 12, 14, 17, 18, 19, 21, 25, 26 (the trash
replaced by a removal: the desktop's trash is the human's check). Seen red: one run with a defect
per case failed all; RC-18/19 first passed against its defect because the toast had timed out
before the check, and now checks right after each toggle. Nothing to fix in the code.

### B4 — Exit (2026-11-08)

`docs/spec/look.md`, `terminal.md`, `sessions.md`, `files.md`, `remote-control.md`, `projects.md`
and `agent-state.md` hold only pointers to the built docs and code. Each Acceptance section names
its test files, the cases checked by hand and those decided against; the removed lines went
verbatim to `docs/history/spec/`. LOOK-50 and 51, built and tested by `b2`'s plan 16, point at `e2e/usage-window.spec.ts`. The hand
checks are `plans/00-STATUS.md` §2.6–2.12, one line each.

The test-integrity check flags one `expect(` line: TRM-18's, which asked for the folder's full
path and now asks for `web~/work` after the `~` fix; `set` read it and accepted it (2026-11-08).
