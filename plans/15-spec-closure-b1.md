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

(Written by the session that executes it.)
