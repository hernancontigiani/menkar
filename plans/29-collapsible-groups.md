# Plan 29: collapsible groups with an optional leader (1.50)

> **Status:** written 2026-11-11 by `set`, from decision 1.50 and the human's answers of the same
> day (recorded as 1.54). Ready to execute.
>
> **Design:** `plans/ideas/groups-and-orchestration.md`, Idea 1, with the human's four answers.
>
> **Exit, when executed:**
> - `docs/projects.md`: the two new group keys (`collapsed`, `leader`), how the model keeps the
>   leader first and drops it when it leaves, and how the sidebar draws a collapsed group, with what
>   was rejected (below, "Rejected").
> - `docs/NOT_BUILT_YET.md`: "who leads a group, read by something other than the sidebar", with
>   its trigger (below).
> - `plans/00-STATUS.md`: this plan's row leaves §3 and its closing note goes to
>   `docs/history/plans/00-STATUS.md`; 1.50 and 1.54 point to `docs/projects.md`.
> - `plans/ideas/groups-and-orchestration.md`: Idea 1 leaves it (it is built); Idea 2 stays.
> - The rest → `git log`.
>
> Replaces nothing. Amends the line "a group keeps only its three keys" in `docs/projects.md`
> (that line goes verbatim to `docs/history/projects.md` in the same change).

## Goal

A group in a project's session list can be collapsed into one row, to save vertical space; a group
can mark one of its members as its leader. A project that uses neither loses nothing.

## What already exists (verified 2026-11-11)

- **The list** is drawn by `renderList` in `src/renderer/app.ts:391–420`: for each group with at
  least one listed member, a `div.group-heading.dim` (dot in the group's color + name, line 395)
  then its rows in `group.members` order; then "No group" (heading only when groups exist) and its
  rows; then the "N hidden" foot. **The heading has no interaction today**: no click, no menu.
- **A row** (`row()`, `app.ts:444`): state dot (`stateDot(sessionState(id))`), name, folder, the
  context ring only while running (`ring(readingOf(id))`, decision 1.21), the `⋯` menu (`rowMenu`,
  `app.ts:526`). Click selects its tab, double-click opens it. Rows are not highlighted when their
  tab is selected — nothing marks the selected session in the list today.
- **States:** `DotState = ShownState | 'stopped'` (`app.ts:66`); `sessionState` (`app.ts:68`);
  `rollup()` (`src/core/agentstate/shown.ts:43`), most urgent first: `blocked > working > done >
  idle`, already used by tabs (`tabStateOf`, `tabDot`, `app.ts:615–640`). `tabRing` picks the
  fullest reading (`app.ts:642`).
- **The model** (`src/core/projects/model.ts`): `Group { name, color, members }` (line 8);
  `setGroup` (line 157), `newGroup` (line 177), `moveMember` (line 198, a drop never changes a
  group), `removeMember` and every group change drop a group left empty (`dropEmpty`, line 80).
  A group is identified by its name inside its project (`setGroup` matches by name).
- **The file** (`src/core/projects/store.ts`): read strictly, version 1; groups parsed at lines
  52–66; written at line 108 with exactly `name, color, members` — **unknown group keys are
  dropped today**, unlike a project's.
- **Main** sends `groups` to the renderer as the model has them (`src/main/workspace.ts:321–326`);
  actions in `src/shared/workspace.ts:70` (`setGroup`, `moveSession`, …), handled in
  `src/main/workspace.ts:1242–1255`. Projects are saved at once on change (`workspace.ts:414`).
- **Row dragging** (`dragToReorder`, `docs/projects.md:28–40`) works per section
  (`data-section`, the group's name).

## The design

### Decided (1.50 and the human, 2026-11-11 → 1.54)

1. **Collapse by clicking the group's heading.** The heading becomes a button with a chevron
   (`▾` expanded, `▸` collapsed) before the group's dot. A click anywhere on the heading, or Enter
   / Space when it has focus, toggles. **No jump** from the collapsed row: to reach a member,
   expand, or use Go to agent (`Ctrl+B g`).
2. **Saved, in `projects.json`**, on the group: `collapsed: true`, written only when true. Shared
   by every window (it is the group's data, not the window's).
3. **The collapsed heading is the group's one row**:
   `▸ ● API · 3 ★ b1            ●  ◑`
   - name in the group's color, ` · ` and the **count**: the number of member rows the group would
     show expanded (listed members: hidden ones only while the "N hidden" toggle shows them);
   - `★ <leader's name>` when the group has a leader;
   - the **state dot**: `rollup()` over the dot states of its **running** members; `stopped` when
     none runs (the human's rule, with blocked winning so a collapsed group never hides what
     needs the human);
   - the **ring**: the fullest reading among its running members; none when none runs (1.21);
   - **marked** (the class `contains-selected`, the accent's left bar) when the window's selected
     tab holds a member, since its row is not visible.
   Expanded, the heading looks as today plus the chevron: no count, no dot, no ring.
4. **The leader is set from the row's menu.** A member of a group gets "Make group leader"; the
   leader gets "Not the group's leader" instead. A session in "No group" gets neither. One leader
   per group at most: making another member leader replaces it.
5. **The leader is shown with `★`** after its name, and **goes first** in its group: setting it
   moves it to the front of `members`. Collapsed, the leader is hidden with the rest.
6. **Never expands by itself.** A member becoming blocked, its tab being selected, Go to agent, a
   notification click: the group stays as it is. The collapsed row's dot and mark say it.

### Decided by `set` within those (technical, 2026-11-11)

7. **The leader is the group's `leader: <session id>`**, written only when set. On read it is kept
   only if it is one of the group's (repaired) members, else dropped — repaired, not unreadable,
   like a member that is not the project's. A `collapsed` that is not `true` reads as expanded.
8. **The leader stays first**: `moveMember` dragging the leader changes nothing; dropping another
   member before the leader lands it right after the leader.
9. **The leader leaves with its membership**: `setGroup` to another group or to none,
   `removeMember`, joining another project — the group it left has no leader. A group dropped for
   being empty takes its keys with it.
10. **Joining a collapsed group keeps it collapsed**; the count grows. The human made one choice
    for "does it expand by itself" (no); this is the same rule.
11. **"No group" never collapses** and has no leader: it has no name to show.
12. **The group state is computed in core**: `groupState(states)` in
    `src/core/agentstate/shown.ts`, `ShownState | null` (null = stopped), over the states of the
    running members. The renderer maps null to `stopped`. One definition, testable on Node.
13. **An older Menkar** reading a file written by this one drops `collapsed` and `leader` on its
    next save (its writer keeps three keys). Acceptable: the groups and members are intact; no
    version bump.

### Rejected, and why

- **Double-click on the collapsed row jumps to the member most in need** — the human chose no jump
  (2026-11-11); Go to agent already does it across windows.
- **Collapsed per window, not saved** (as "N hidden") — the human chose saved.
- **The leader's row stays visible while collapsed** — that makes "one row" two; the human chose
  the leader hidden with the rest, its name on the collapsed row.
- **Expanding on blocked** — moves the list under the pointer; the red dot already says it.
- **A tooltip naming which member gives the state and the ring** (the idea's proposal) — not asked
  for; left out rather than guessed.
- **A schema version 2** — the new keys are optional and an older reader survives them.
- **A leader in "No group"** — a leader leads a group.

## Tests that hold the decisions (written before the code, in the block that names them)

| Decision | Test | Case → expected |
|---|---|---|
| 3, 12 group state | `tests/core/agentstate/shown.test.ts` | `[]` → null; `[idle]` → idle; `[idle, done]` → done; `[done, working]` → working; `[working, blocked, idle]` → blocked |
| 2, 7, 13 file | `tests/core/projects/store.test.ts` | a group with `collapsed: true, leader: "b"` (b a member) round-trips with both; `collapsed: false` and `collapsed: "yes"` read as expanded and are not written; `leader: "zz"` (not a member) is dropped, the file still readable; a group with neither is written with exactly `name, color, members` |
| 4, 5 set leader | `tests/core/projects/model.test.ts` | members `[a, b, c]`, `setLeader(c)` → leader c, members `[c, a, b]`; then `setLeader(a)` → leader a, `[a, c, b]`; `clearLeader(a)` → no leader, order kept |
| 8 leader stays first | same | leader a in `[a, b, c]`: `moveMember(a, c, after)` → unchanged; `moveMember(c, a, before)` → `[a, c, b]` |
| 9 leaves with membership | same | leader b: `setGroup(b, null)`, `setGroup(b, other)`, `removeMember(b)`, moving b to another project — each leaves the group without `leader` |
| 10 join collapsed | same | `collapsed` group, `setGroup(x, it)` → still collapsed, x a member |
| 1, 2, 3 collapse in the window | `e2e/groups.spec.ts` (new) | a project with group "API" of 3 and 1 loose session: click the heading → one `.group-heading.collapsed` containing "API · 3", none of its 3 rows in the list, the loose row still there; restart the app → still collapsed; click → the 3 rows back |
| 3 dot and ring | same | collapsed, one member blocked (the fake agent the agent-state specs use) → the collapsed row's dot is `blocked`; no member running → `stopped`, no ring; two running with readings 40 % and 87 % → the ring shows 87 % |
| 3 mark | same | collapsed, select a member's tab → the heading has `contains-selected`; select a loose session's tab → it has not |
| 4, 5 leader in the window | same | menu "Make group leader" on the third member → it is first with `★`; collapsed → "★ <its name>" on the row; "Not the group's leader" → no `★`, order kept |
| 6 never expands | same | collapsed, a member turns blocked, then its tab is selected → still collapsed |
| 11 no group | same | the "No group" heading is not a button and has no chevron |

## Out of scope

- Anything that reads the leader outside the sidebar (the orchestrator, a CLI, a board): no
  consumer yet → `docs/NOT_BUILT_YET.md`, trigger "a session or a tool needs to know who leads a
  group" (Idea 2's board is the likely one).
- Renaming or recoloring a group; dragging groups; collapsing "No group".
- A collapsed state in Add session, the switcher, Go to agent or Usage: they list sessions, not
  groups, and stay as they are.
- Any change to tabs, the tab's group line (`groupLine`), notifications or the project's blocked
  count.
- Keyboard shortcuts to collapse (none asked; the heading takes Enter/Space when focused).

## Do not touch

- `rollup()`'s order and its callers (tabs, panes): `groupState` calls it, it does not change it.
- `moveMember`'s rule that a drop never changes a group, and `dropEmpty`.
- The strict read of `projects.json` for everything else, and the project-level `rest` keys.
- Row behaviour: click selects the tab, double-click opens, the drag per section, the `⋯` menu's
  other entries and their order.
- The agents' data: this plan writes only `projects.json`.

## Execution blocks

### Block 1 — the group state in core

- [ ] Write the `groupState` cases in `tests/core/agentstate/shown.test.ts` (table above); see them
      fail.
- [ ] `groupState(states: readonly ShownState[]): ShownState | null` in
      `src/core/agentstate/shown.ts`, calling `rollup` when not empty.
- **Verify:** `npm run ci`.

### Block 2 — the model and the file

- [ ] Write the store and model cases (table above); see them fail.
- [ ] `Group` gains `readonly collapsed?: true` and `readonly leader?: string`.
- [ ] `store.ts`: read both (decision 7), write each only when set, after `members`.
- [ ] `model.ts`: `setLeader(state, sessionId)`, `clearLeader(state, sessionId)`,
      `setCollapsed(state, projectId, groupName, collapsed)`; `moveMember` keeps the leader first
      (8); every path that takes a session out of a group drops its `leader` (9) — check
      `setGroup`, `removeMember`, joining another project (`model.ts:132`) and any other caller
      that filters `members`.
- [ ] Actions in `src/shared/workspace.ts`: `{ type: 'setLeader', session, leader: boolean }`,
      `{ type: 'collapseGroup', project, group, collapsed: boolean }`; handled in
      `src/main/workspace.ts` beside `setGroup`, saved at once like the rest. `groups` reach the
      renderer with the two keys.
- **Verify:** `npm run ci`.

### Block 3 — the sidebar

- [ ] Write `e2e/groups.spec.ts` (table above; reuse the fixtures of `e2e/projects.spec.ts`,
      `e2e/row-drag.spec.ts` and the agent-state specs for a blocked member and readings); see it
      fail.
- [ ] `renderList`: a group's heading is a `button.group-heading` with the chevron; collapsed, it
      carries `collapsed`, the count, `★ <leader>`, the `groupState` dot, the fullest running ring
      and `contains-selected`, and its rows are not rendered. "No group" stays a `div`.
- [ ] `row()`: the leader's name gets `★` (`class="leader-star"`, `title` = the translated
      "Group leader").
- [ ] `rowMenu`: in a group, "Make group leader" / "Not the group's leader" right after the Group
      submenu.
- [ ] Strings through `t()`, English and Spanish both (`check-i18n`): the two menu entries, the
      star's title, the heading's accessible label ("Collapse group" / "Expand group"), the count
      if it needs a template.
- [ ] CSS in `src/renderer/style.css` next to `.group-heading`: the button reset, the chevron, the
      collapsed row aligned with a session row (dot, ring and `⋯` columns), `contains-selected`.
- **Verify:** `npm run ci`; `npm run ui-check` (the new spec and the full suite); screenshots of
  the list expanded, collapsed with a blocked member and a ring, and with a leader, in a dark and a
  light theme, looked at before reporting.

### Block 4 — docs and close

- [ ] `docs/projects.md`: the two keys, the leader rules (7–10), the collapsed row (3), the
      rejected list; the old "a group keeps only its three keys" line verbatim to
      `docs/history/projects.md`.
- [ ] `docs/NOT_BUILT_YET.md`: the out-of-scope leader entry with its trigger.
- [ ] Execution log below.
- **Verify:** `npm run ci` (the history check).

## Execution log

_Written by the executing session._
