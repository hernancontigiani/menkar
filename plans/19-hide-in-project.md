# Plan 19: hide a session from its project's list

> **Status:** written 2026-11-09, ready to execute after the current batch. Executed by `b1`.
>
> **Exit, when executed:**
> - `docs/projects.md` gains "Hidden in a project": the rule, where it is stored, and how a
>   session is shown again.
> - Decision 1.25 stays in `plans/00-STATUS.md` §1.
> - The rest goes to `git log`.

## Goal

A project's sidebar list collects sessions the user is done with but does not want to delete or
move out. Removing one from the project would also take its usage out of the project. Today the
only hide is the history's, in Add session's Existing page (global, `state.json` `hidden`). That
hide does not touch the sidebar.

## Decided (the human, 2026-11-09; decision 1.25)

- A sidebar row's menu offers **"Hide"** (es "Ocultar"), and a hidden row's menu offers **"Show"**
  (es "Mostrar").
  - The word is just Hide: the menu is the project's, so "from the project" is implied.
  - It is a different item from the history's "Hide session", which stays as it is.
- **Hidden means:** the row leaves the project's sidebar list and **the session stays a member**.
  Usage keeps counting it under the project (membership is unchanged, decision 1.15 scope
  included), and the project does not lose it or re-claim it.
- **Stored per project.** In `projects.json`, on the project: a list of hidden member ids,
  validated like `members` and pruned of ids that are no longer members.
  - It is not the global `hidden` list. Hiding in one project never affects another project or
    the history.
  - The agent-tablet import brings none; its file has no such field.
- **Only a stopped session can be hidden.** A session runs if and only if it has a tab, and a tab
  is never without its row. So the item is disabled while the session runs, with a tooltip:
  "Close its tab first" (es "Cerrá su pestaña primero").
  - If a hidden session is started, from Add session or a link, it becomes shown again: running
    implies shown.
- **Showing it again:**
  - **Add session → Existing:** picking a session that is a hidden member of this project shows
    it again instead of adding it twice.
  - **The list's foot:** when the project has hidden sessions, a dim **"N hidden"** link sits
    under the list (es "N ocultas"). Clicking it toggles "show hidden". Hidden rows then appear
    dimmed, in their group, with "Show" in their menu. The toggle is per window and not
    persisted.
  - **The quick switcher** (Ctrl+Shift+K) also lists hidden members, dimmed; choosing one opens
    it, which shows it again (running ⇒ shown). Typing a name must not hide a session from the
    user. (The sidebar has no search field of its own.)

## What it builds

- **Core** (`src/core/projects/`):
  - the field on the project model;
  - validation and pruning;
  - `hide` / `show` operations that refuse a running session;
  - the rule that starting a session shows it.
  - Unit tests for each.
- **Main:** the actions through the existing projects IPC (a targeted edit in shared types).
- **Renderer:**
  - the row menu items, with the disabled state and its tooltip;
  - the "N hidden" foot and the toggle;
  - dimmed hidden rows;
  - the quick switcher listing hidden members, dimmed;
  - Add session Existing re-showing a hidden member.
- **Strings** in en and es.

## Do not touch

- The history's global hide (`state.json` `hidden`, Add session's "Hide session" and "Show
  hidden sessions").
- Usage's queries: membership is unchanged, so nothing there should need editing. If something
  does, stop and tell `set`.

## Verification

- **Vitest:**
  - hide and show;
  - refusal while running;
  - pruning a non-member;
  - start ⇒ shown;
  - the file round-trip, including a malformed field.
- **e2e:**
  - hide a stopped row and it leaves the list, with the "1 hidden" foot;
  - the toggle shows it dimmed, and "Show" restores it;
  - the item is disabled on a running row;
  - picking it in Add session → Existing shows it;
  - the quick switcher finds it, and opening it shows it;
  - Usage still counts it under the project (a fixture with history).
- Each test is seen red first.
- `npm run ci`; `npm run ui-check` from a clean `out/`.
- Screenshot `/tmp/menkar-shots/hidden-foot.png`.

## Execution blocks

### B1: build
- [x] Core, main, renderer, strings, tests.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B2: exit
- [x] `docs/projects.md`, the plan's log.
- **Verification:** `npm run ci`.

## Execution log

### B1 — Build (2026-11-09)

- Core: `Project.hidden` (optional, so files without it are unchanged), `hideMember` refusing a
  session with a tab (`projects.hideRunning`), `showMember`, and `leave()` pruning the list when a
  member is removed or moves. `store.ts` reads it leniently and writes it only when not empty.
- Main: `hideSession` / `showSession` actions; `startPane` shows a session again (running implies
  shown); `pickSession` shows a hidden member again. `ProjectInfo.hidden` reaches the windows.
- Renderer: hidden rows out of the list, a "N hidden" foot toggling them back dimmed (per window),
  Hide / Show in the row menu with Hide off and titled while the session has a tab, the quick
  switcher listing hidden members dimmed. `MenuItem` gains `title`.
- Strings in en and es: `row.hideInProject`, `row.showInProject`, `sidebar.hiddenCount`,
  `projects.hideRunning` (`row.hide` was taken by the history's "Hide session").
- The search the plan first named is the quick switcher: the sidebar has none (`set`, 2026-11-09).
- Tests: `tests/core/projects/hidden.test.ts` (5, each seen red on its own defect);
  `e2e/projects.spec.ts` PRJ-60–64, each seen red on its own defect. PRJ-64 first passed against
  hidden-means-removed, because usage takes membership at its pass; it now starts with the session
  hidden and was red against a scope that filters hidden members out.
- Screenshot: `/tmp/menkar-shots/hidden-foot.png`.

### B2 — Exit (2026-11-09)

`docs/projects.md` gains "Hidden in a project".
