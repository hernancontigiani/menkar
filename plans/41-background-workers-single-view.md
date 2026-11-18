# Plan 41 — Background workers, one peek tab, and one sidebar view

**Status:** written 2026-11-17 by `menkar-t60` (task 60); revised the same day after the review
`prompts/reports/menkar-t66-review-41.md` (F1–F17, all confirmed against the tree at `8ad8f81`).
**Decisions D1–D6 and questions Q1–Q6 are open** (§6; with the human as topic 51). Until they are
answered, the plan assumes the recommended option, marked **(decided 2026-11-18, Dn)** or **(pending Qn)**, and
each one is written in **one place**: §2.7's table, which every block cites.

**Comes from:** decisions 1.176 (workers without a tab, one peek tab; task 59's mock-ups
`$MENKAR_FILES/menkar-t59-*`) and 1.177 (one sidebar view; task 60's mock-ups
`$MENKAR_FILES/menkar-t60-sheet.png`), both in `plans/00-STATUS.md` §1, taken as given.

**Exit when executed:**

| Part | Goes to |
|---|---|
| The rule that a session runs only while it has a tab, in its new wording (Q1, the human's) | `AGENTS.md`, "Product rules"; the old wording to `docs/history/root/AGENTS.history.md` |
| Background, peek and pinned tabs: what they are, `place`, the one selection writer, what closes and what hangs up, a hidden tab's drawer, restart | `docs/window.md`, a new section "Background workers and the peek tab" |
| `place` in the saved layout; `orchestrator_open` replacing `orchestrator_collapsed`; `team_view` retired | `docs/projects.md` (the old keys' lines to `docs/history/projects.md`) |
| The sidebar in the mode: one view, its parts, the row weights, the pills | `docs/orchestration.md`, `## The sidebar in the mode`: its "The Work view" and "The Team view" paragraphs replaced (verbatim to `docs/history/orchestration.md`) |
| `background_toast` in `state.json` | `docs/sessions.md` (the state keys' list) |
| What the agents read about it | `plugin/guide/orchestration-mode.md`, `plugin/skills/orchestrator/workers.md`, the MCP tools' descriptions and replies |
| Disposing a background worker's renderer view; sizing a background pty to the window | `docs/NOT_BUILT_YET.md`, each with its trigger |
| Rows 1.176 and 1.177 marked built; D1–D6 recorded | `plans/00-STATUS.md` (by `set`) |
| What was rejected and why (§2.8) | the "Rejected" lines of `docs/window.md` and `docs/orchestration.md` |
| The rest | `git log` |

**Modifies:** no plan. **Replaces:** the Work/Team switch (1.112, 1.115) as the sidebar's shape in
the mode.

---

## 1. Goal, and what already exists

**Goal.** In the orchestration mode, (a) the orchestrator's workers run without a place in the tab
strip and are seen one at a time in a peek tab (1.176); (b) the sidebar is one view, in 1.177's
order, whose rows keep everything the Team view's rows have today.

**What exists, verified in the tree on 2026-11-17 (`8ad8f81`):**

- **A pane's process and output live in main**: one `Terminal` per pane (`src/main/terminal.ts`),
  keeping the last 512 KiB of output (`BUFFER_CHARS`, line 35) for a window that shows the pane
  later. The pty starts at 80×24 (`startPaneHeld`, `src/main/workspace.ts` ~966); the renderer fits
  it when its body is shown (`refit`, `src/renderer/terminals.ts:132`, skipping width 0).
- **The renderer keeps one xterm.js view per pane** and a body per tab of `s.tabs`
  (`renderContent`, `src/renderer/app.ts:1389`); `forgetPanesExcept` (`terminals.ts:381`) is fed
  from `s.tabs`. **An unselected tab already behaves as a background worker would**: hidden body,
  view receiving output, 80×24 until first shown if it was started unselected (1.32).
- **The layout** (`src/core/projects/layout.ts`): a window holds tabs of several projects and one
  remembered selection **per project** (`LayoutWindow.selected`, line 39); the strip draws the
  shown project's tabs (`renderStrip`, `app.ts:1161`). `withoutTab` (~86) picks the next tab of the
  project as the new selection, whatever it is; `openSession` (~170), `moveSessionHere` (~258,
  keeps `...found.tab` and selects it), `insertTabAfter` (~307), `moveTab` (~322), `stepTab`,
  `nthTab`, `toSaved` (~370), `reopen` (~405), `bringProject` (~126, moves every tab of the
  project).
- **Who writes a window's selection in main**: `revealPane` (`workspace.ts:1084`, used by
  `selectSessionTab`, notifications), `revealTab` (`:3409`, used by Go to agent:
  `src/renderer/switcher.ts:194–208` → `listTabs`, `:3456`, which lists every tab), the
  `selectTab` action (`:3063`), and the layout functions above.
- **What ends a pane** — all through the `closeTab` **function** (`:1127`, hangs up): the
  `closeTab` action (`:3070`), `closeAllTabs` and `closeOtherTabs` (`:3150–3155`, over `w.tabs` of
  every project the window holds), `closePane` on a tab's only pane (`:3299–3304`; the prefix's
  `x`, `src/renderer/keys.ts:144`), `stopSession` (`:2788`), parking and a closed task
  (`stopPane`, `putAwayWorker`), Remove/trash/delete, `deleteProject`; window close and quit hang
  up every tab. A pane that exits by itself removes its tab (`onPaneExit`).
- **A row's click sends `selectTab`** with its session's tab (`app.ts:1040–1044`); its double-click
  `openSession` (`:1045`). ⋮ Open sends `openSession` too (`app.ts:1058`,
  `src/renderer/sessionmenus.ts:210`).
- **`changed()`** (`workspace.ts:719`) runs after every change, `startShownTabs()` at `:725`; the
  boot path is `reopen` (`:2557`) then a plain `changed()`.
- **The window's `open` set is built from panes** (`:552`), not tabs; `inSomeTab` and `runningIn`
  (`:1784`) read the layout. The cap counts `runningIn`.
- **Who is a worker in the code**: `isWorker` (`src/core/orchestration/workers.ts:67`) — mode on,
  parent is the orchestrator, no role label. Parking and the cap use it.
- **A managed child's pane is read only** with a banner (`bannerOf`,
  `src/core/orchestration/readonly.ts`); "Take control" is a button in that banner
  (`syncBanner`, `app.ts:1473`).
- **Agent states in the renderer**: `agentStates.panes[]` with `state` per pane (`PaneState`,
  `src/core/agentstate/shown.ts:9`, no time) and `agentStates.blocked`, a **count per project**.
- **The sidebar today** (`renderSessionList`, `app.ts:432`): `#view-switch` is built in
  `buildFrame` (`app.ts:224`); Work draws `workView` (`src/renderer/work.ts`: tiles, topics, tasks
  at most `SHOWN_TASKS = 6`, line 17, compact consultants, Done today); Team draws
  `#topics-section` (fixed) and `modeList` → `modeRows` (`src/core/orchestration/rows.ts`), whose
  rows (`row` `:961`, `teamText` `:936`, `teamFold` `:897`) carry the phone, dot, role label, task
  and step, ★, "with you", muted speaker and ⋮, then the **"N hidden" foot** (`:538–549`) and the
  row-drag marker (`:551`).
- **The orchestrator's fold**: `orchestratorCollapsed`, read by `modeRows` (`rows.ts:109`), set by
  the triangle (`app.ts:913`, `setOrchestratorCollapsed`) and main (`workspace.ts:540`,
  `src/main/projects.ts:55`); saved as `orchestrator_collapsed` only when true
  (`src/core/projects/store.ts:141`, `:202`).
- **Toasts with an action**: `toast` (`src/renderer/ui.ts:124`), used with `t('toast.show')` in
  `src/renderer/orchestration.ts:19`.

## 2. The design

### 2.1 A background worker is a tab the strip does not draw

`SessionTab` gains `place?: TabPlace`, `type TabPlace = 'background' | 'peek'` in a new
`src/core/projects/place.ts`, imported by `layout.ts`, `model.ts` (`SavedTab.place?: 'background'`)
and `src/shared/workspace.ts` (`TabView.place`): one type across both boundaries, so parity holds
by construction. Absent is an ordinary tab; for a worker, a **pinned** one.

Everything that follows a pane by its tab keeps working with no second case (verified, review §5):
output routing by `pane.tabId`, `bringProject`, window close and quit, saving, 1.32's start, the
cap, names, renew and `/clear` (the re-keying spread keeps `place`), notifications (a background
tab is never "seen").

- **Background**: never selected, not drawn, skipped by `stepTab`, `nthTab`, `shownTab`. Its body
  exists in the renderer, hidden, as an unselected tab's.
- **Peek**: at most **one per project** — per strip **(decided 2026-11-18, D1)**. It is **moved to the end of
  its project's tabs** when it becomes the peek, and a tab opened while a peek exists is inserted
  before it; so the drawn order is the layout's order, and pinning, dragging and `moveTab` need no
  special case. Drawn italic, regular weight, with a pin button left of its ×; a double-click on it
  pins it (task 59's mock-up tooltip).
- **Backgroundable** (`backgroundable`): a session that is a worker **(pending Q2: `isWorker`)** and
  not "with you". A **tab** may be background or peek only if it has one pane, judged in main by
  `tabPanes` (which holds a split shell, unlike `tab.panes`).

### 2.2 One writer of the selection

Every path that selects a tab goes through **`select(layout, windowId, tabId)`** in `layout.ts`:
a background tab is made the peek (the project's previous peek → background) and selected; any
other tab is selected. `openSession`, `moveSessionHere`, `insertTabAfter`'s callers use it inside
the layout; main's `revealPane`, `revealTab` and the `selectTab` action call it. `withoutTab`'s
neighbour skips background tabs. **Invariant, tested by a sweep in block 1**: after any exported
function of `layout.ts`, no window's `selected` names a background tab.

### 2.3 The transitions

| From | Event | To |
|---|---|---|
| — | `start_session` / `resume_session` start a worker | background, after the caller's tab; selection untouched |
| background | a click on its row, task row, Board card, pill; a notification; Go to agent (`select`) | peek, selected; the project's previous peek → background |
| background | ⋮ Open, a double-click on its row **(decided 2026-11-18, D3)** | ordinary (pinned), selected |
| — (stopped, earlier, parked worker) | ⋮ Open, a double-click **(decided 2026-11-18, D3)** | ordinary, selected, as today |
| peek | the pin button, a double-click on the tab | ordinary, in place (already last), selected |
| peek | `splitPane` or `openBeside` into it | ordinary (pinned) first, then split |
| peek or pinned | ×, middle click, Close, `Ctrl+B x` on its only pane, Close others, Close all | background; selection by `withoutTab`; toast the first time ever (2.5) |
| pinned, with a second pane | its × **(decided 2026-11-18, D2)** | the second pane hung up as today; the worker → background |
| background | Close others / Close all | stays background |
| selected peek | stops being backgroundable (Take control in its banner, With you, a role set, Take back, orchestrator unmarked, mode off) | ordinary, in place, **still selected** |
| background, or a peek not selected | stops being backgroundable (same events; also at boot) **(pending Q3)** | ordinary, appended before the project's peek, not selected |
| pinned | a click on its row | selected; the peek stays (1.176) |
| any | Stop, parking, its task closing, Remove/trash/delete, deleting the project, window close, Quit, its process exiting | hung up and removed, as today: **only these end a worker** |

`ordinaryUnless(layout, backgroundable, selected)` does the two "stops being backgroundable" rows,
and main calls it **in every `changed()`, before `startShownTabs()`**, so boot (a saved background
tab of a session that is no longer a worker), `splitPane` and every mark change are covered.

**The order "ordinary, pinned, peek"** (1.176) is kept where a session's tab opens (a tab of a
session that is not a worker opens after the project's last non-worker tab), not enforced: file
tabs, new and forked sessions, `moveSessionHere` and Take control land after the pinned workers, as
today's tabs land at the end. Dragging stays free.

**Restart**: background and peek tabs are saved as `place: 'background'`; they reopen as
background and start when their project is shown (1.32), resumed with `--resume`; what their
screen showed is gone, as for every tab today.

**The cap**: closing a worker's tab no longer frees a slot (it runs); only Stop, parking or its task
closing do. Consistent with 1.176; one line in the guide.

**A hidden tab's drawer** keeps its shell running (`closeDrawer` is only in the `closeTab`
function); shown again with the peek. One line in `docs/window.md`.

### 2.4 Where a background worker's screen lives

**Where it lives today for an unselected tab: main's 512 KiB buffer and the renderer's xterm.js view
with the user's scrollback, in a hidden body.** The peek shows it at once with its scrollback. **No
measurement is needed to build this**: the cost is today's. Deferred to `docs/NOT_BUILT_YET.md`
(block 6):

- *Disposing a background view and replaying main's buffer when peeked* — trigger: the renderer's
  memory grows with background workers on the human's machine. To measure then:
  `webContents.getProcessMemoryInfo()` with 0 and with 10 background workers, each having printed
  the same transcript through the stand-in `claude`.
- *Sizing a background pty to the window's tab body* (80×24 until first shown) — trigger: a peeked
  worker's earlier output reads badly wrapped at 80 columns.

### 2.5 What the human sees (1.176)

- **Worker rows** (`rowWeight`, block 2): **bold + pin icon** with an ordinary tab; **regular** in
  the background; *italic, regular* in the peek; **regular** with no tab at all **(decided 2026-11-18, D5)**.
  Rows of sessions that are not workers are drawn as today **(pending Q5)**. Every other mark stays
  where the Team view has it (`menkar-t60-3-unfolded-marks-*`).
- **The pills**: one per background worker **of the shown project** whose pane's state is
  `blocked` (`agentStates.panes[]`, not the per-project count), **in the tabs' order (decided 2026-11-18, D6)**,
  one each **(pending Q6)**, at the strip's right end before `#prefix-pill`, "‹name› · permission";
  a click → `select`. A worker in the peek or pinned shows its tab's red dot instead.
- **The toast**: the first time ever a worker's tab is closed into the background, "‹name› keeps
  running in the background" with Show (→ `selectSessionTab`). The action's result carries
  `backgrounded: { names: string[], first: boolean }` (Close all may hide several: one toast,
  naming the first, when `first`). Then `background_toast: true` in `state.json`, through
  `updateState`, in `src/core/background-toast.ts` beside `src/core/mute.ts`.
- **A row's click** on a worker with a tab: `selectSessionTab` (→ `select`). Its **double-click**
  pins (decided 2026-11-18, D3); the browser fires two clicks first, so the row is peeked, then pinned, and the
  project's previous peek goes to the background on the way. Accepted: the human is replacing it.

### 2.6 One sidebar view (1.177)

With the mode on, top to bottom; the Work/Team switch and `team_view` go:

- **Fixed** (`#topics-section`): the three count tiles (for you · working · waiting, `workCounts`,
  unchanged), then "Awaiting you", at most 5 and "N more" (1.171).
- **Scrolling** (`#session-list`): Tasks, **at most 3** (`TASKS_SHOWN = 3` in `rows.ts`, beside
  `TOPICS_SHOWN`) and "See all (N) →" opening the Board as now; `modeRows` as the Team view draws
  it — the orchestrator **folded by default**, its count and worst dot after its name (`teamFold`,
  1.171; the human's pick, 2026-11-17), Consultants, Others; then the **"N hidden" foot after
  Others' rows (decided 2026-11-18, D4)**; then **Done today, folded**, last; the row-drag marker as today.
- **Rows are the Team view's** (`row`, `teamText`), plus 2.5's weights; Work's compact consultant
  rows go. ⋮ is `rowMenu`; its **labels and order** are not touched (only Open's action may pass
  `pin`, pending D3); an e2e asserts the labels on a worker row.
- **The fold's saved key** becomes `orchestrator_open: true`, written only when unfolded;
  `orchestrator_collapsed` is no longer read, and dropped on the next write. In memory,
  `Project`/`ProjectInfo.orchestratorCollapsed` and the action `setOrchestratorCollapsed` stay,
  derived as "not open". My choice: a project whose orchestrator the human had unfolded comes back
  folded once; the other way needs a migration that guesses.

### 2.7 Pending decisions, each in one place

| Id | Assumed (the reviewer's / my recommendation) | Changes, if answered otherwise |
|---|---|---|
| D1 | one peek per project | block 1's peek tests; `select` |
| D2 | × on a worker's tab with a second pane: that pane hung up, the worker → background | block 3's `closeTab` action; one e2e case |
| D3 | ⋮ Open and a row's double-click on a background worker pin it; a worker with no tab opens ordinary | block 3's `openSession` (`pin`); block 5's row double-click |
| D4 | "N hidden" after Others, before Done today | block 4's order; one e2e line |
| D5 | a worker with no tab: regular | `rowWeight` (block 2) |
| D6 | the pills in the tabs' order | block 5's pill order |
| Q1 | §6's wording | block 6's `AGENTS.md` edit |
| Q2 | backgroundable = `isWorker` (experts keep ordinary tabs) | `backgroundable` (block 2) |
| Q3 | stopping being backgroundable → ordinary; nothing stops | `ordinaryUnless` (block 1) |
| Q5 | non-worker rows unchanged | `rowWeight` (block 2) |
| Q6 | one pill per worker | block 5's pills |

(Q4 of the first draft is D3.)

### 2.8 Rejected, and why

- **A registry of tabless panes in main, outside the layout**: every path that follows a pane by its
  tab (output routing, reveal, `bringProject`, window close, saving, 1.32, the cap, `inSomeTab`)
  would need a second case, each forgotten one a lost or orphaned process.
- **Hanging up a worker whose tab closes, resuming it on a click** (parking): stops running work;
  1.176 keeps it running.
- **Disposing a background view and replaying main's buffer**: loses what is older than 512 KiB and
  can start inside an escape sequence, to save memory nobody has seen short (deferred, 2.4).
- **Drawing the peek last whatever its index**: pinning then jumps the tab and a drop before the peek
  lands at its index (review F8); the peek is moved to the end instead.
- **One peek per window**: a window holds a selection per project, and a peek in project Y would
  demote X's selected peek into a selected background tab (F5).
- **Sorting the strip by kind when drawing**: a drag would be undone at the next render.
- **A Team/Work switch with one default**: 1.177 removes it so background workers are found without
  knowing a second view exists.
- **The folded count in the orchestrator's role line**: the human picked it after the name.

## 3. Out of scope

- 1.178 entirely (the inbox, which events wake the orchestrator, Menkar raising a topic for a
  prompt, the `UserPromptSubmit` hook, `inbox`).
- The two deferrals of 2.4.
- Parked workers (1.120, 1.164): parking still removes the tab.
- The Board, chat tabs, file tabs; the ordinary sidebar with the mode off.

## 4. Do not touch

- The wake and post path (`wakes`, `wakeSession`, `postToSession`, `onShownChange`,
  `src/core/orchestration/notifies.ts`, `postCounts`): plan 41 adds no post, no wake, no tool.
- `src/core/orchestration/readonly.ts` and the banners; `src/main/terminal.ts` and the reaper.
- `rowMenu`'s labels and order.
- `e2e/r10.spec.ts`, `tests/core/r10.test.ts`; R10's files move only in block 6, on main, by `set`.
- The worktree `/home/hernan/git/menkar-multi-agent`.

### The seam with 1.178 (task 62)

**Behaviour**: with plan 41 built and 1.178 not, a background worker at a prompt still wakes its
parent as today (`onShownChange`, `workspace.ts:2037–2064`) and shows the pill; 1.178 removes the
wake and raises the topic, reading the same `blocked` pane state the pill reads. Plan 41's events
(backgrounded, peeked, pinned) are layout changes only; Take control / hand back keep posting as
today, and 1.178 moves them to the inbox.

**Files both plans touch**: `src/main/workspace.ts`, `src/core/control/protocol.ts`,
`src/renderer/app.ts` (if 1.178 gives the pill anything), `e2e/session-control.spec.ts`,
`e2e/fixtures.ts`, `plugin/guide/orchestration-mode.md`, `plugin/skills/orchestrator/workers.md`,
`docs/orchestration.md`, `docs/session-control.md`, R10's files; and the `ui-check` lock.
**1.178's execution starts after plan 41's block 5**, or runs before that only blocks that touch
none of these. **R10 is refreshed once per plan, never with the other plan's change in the tree.**

## 5. Execution blocks

Blocks run **in order, one worker at a time** (each may share files with the next). Every block ends
with `npm run ci` green, its output in the report; blocks 3–5 also `npm run ui-check` under the lock
`set` names, with screenshots in `$MENKAR_FILES` as `‹worker›-41-b‹n›-*`.

### Block 1 — the layout (1.176), core only

Files: new `src/core/projects/place.ts`; `src/core/projects/layout.ts`; `src/core/projects/model.ts`
(`SavedTab.place`); `tests/core/projects/layout.test.ts`.

- [ ] Tests first, the decision in each one's comment:
  - `toBackground`: `[orch, t9]`, t9 → background, still in `tabs`, not in `shownTabs`, selection
    on `orch`;
  - closing a peek next to a background tab: `[orch, A(peek), B(bg), c1]`, close `A` → `c1`
    selected (never `B`);
  - one peek per project (D1): bg `A`, `B` of project X; `select(A)` → `A` peek, last, selected;
    `select(B)` → `B` peek, last, selected, `A` background; a peek in project Y leaves X's peek;
  - the peek is the last tab: after `select(A)`, `A` is at the end of X's tabs; a tab opened next is
    inserted before it;
  - `pin(A)` → ordinary, same index (the last), selected; a later `select(B)` puts `B` after it;
  - `select(C)` on a pinned `C` while `A` is the peek → `C` selected, `A` still peek;
  - a non-worker's new tab opens before the pinned workers: `[orch, t9(pinned)]`, open `c1` →
    `[orch, c1, t9]` (the predicate `worker(id)` passed in);
  - `ordinaryUnless`: a **selected** peek that no longer qualifies → ordinary, in place, selected; a
    background tab and an unselected peek → ordinary, before the peek, not selected (Q3);
  - `reopen` then `ordinaryUnless` with a saved background tab of a non-worker → ordinary;
  - `pin` before a split: the peek given a second pane is ordinary;
  - `stepTab`, `nthTab`, `shownTab` never land on a background tab; `openSession` on a background
    tab → peek, with `pin` → ordinary (D3); `moveSessionHere` of a background worker → peek;
  - `toSaved`: background and peek → `place: 'background'`; `reopen` reads it as background; an
    unknown `place` reads as ordinary;
  - `bringProject` moves X's background tabs and its peek, places kept (one peek per project, D1);
  - **the sweep**: on a layout with background tabs in two projects, after each exported function
    of `layout.ts`, no `selected` value names a background tab.
- [ ] Then the code: `select`, `toBackground`, `pin`, `ordinaryUnless`, the insertion rule, the
  neighbour rule in `withoutTab`.
- Verify: `npm run ci`.

### Block 2 — rows, tasks, who is backgroundable (1.176, 1.177), core only

Files: `src/core/orchestration/rows.ts`, `src/core/orchestration/workers.ts`,
`tests/core/orchestration/rows.test.ts`, `tests/core/orchestration/workers.test.ts`. After block 1
(imports `place.ts`).

- [ ] `backgroundable(team, withYou, id)` (Q2): a generalist → true; with you → false; an expert →
  false; mode off → false.
- [ ] `TASKS_SHOWN = 3`, `tasksFolded(open)` → `{ rows, more }`: 8 open → 3 rows, `more` 5; 3 → 3
  rows, `more` 0.
- [ ] `rowWeight(worker, place: TabPlace | 'ordinary' | null)` → `'pinned' | 'background' | 'peek' |
  'none' | null`: not a worker → null (Q5); ordinary → pinned; background; peek; no tab → `'none'`,
  drawn regular (D5). A test per value.
- Verify: `npm run ci`.

### Block 3 — main, and the minimum of the renderer that makes it usable (1.176)

Files: `src/main/workspace.ts`, `src/shared/workspace.ts`, new `src/core/background-toast.ts` and
`tests/core/background-toast.test.ts`, `src/renderer/app.ts` (`renderStrip`, `row`'s click and
double-click only), new `e2e/background-workers.spec.ts`, `e2e/session-control.spec.ts`,
`e2e/orchestration.spec.ts`. After block 2.

- [ ] **e2e first** (`background-workers.spec.ts`, the stand-in's SPAWN1 starts a worker): a started
  worker has no tab in the strip and its pid is alive; a click on its row shows it as the last tab;
  × on it → pid alive, no tab; `Ctrl+B x` on its only pane → pid alive; ⋮ Stop → pid gone; a
  relaunch on the same home → the worker background and running; Close all → workers' pids alive.
- [ ] `TabView.place` in the window's state; `start_session` and `resume_session` insert a worker's
  tab as background.
- [ ] The `closeTab`, `closePane` (only pane), `closeOtherTabs`, `closeAllTabs` actions send a
  backgroundable single-pane tab (by `tabPanes`) to the background; with a second pane, D2. Their
  result carries `backgrounded` (2.5), `first` from `background-toast.ts`. The `closeTab`
  **function** is unchanged and still hangs up.
- [ ] `revealPane`, `revealTab`, the `selectTab` action → `select`; a new action `pinTab`;
  `openSession` takes `pin?: true` (D3); `splitPane` and `openBeside` on a peek pin it first.
- [ ] `layout = ordinaryUnless(...)` at the top of `changed()`, before `startShownTabs()`.
- [ ] Renderer, minimum: `renderStrip` skips `place: 'background'` (the peek is already last); a
  worker row's click → `selectSessionTab`; its double-click → `openSession` with `pin` (D3).
- [ ] Rewrite the e2e that click or count a worker's tab: `session-control.spec.ts:352`, `:367–384`,
  `:408`, `:436–441`, `:483`, `:818` (reach the worker by its row, then Take control in its banner),
  and any in `orchestration.spec.ts` the run shows.
- Verify: `npm run ci`; `npm run ui-check`; screenshots: a worker in the background (strip without
  it), the same worker shown last after a click.

### Block 4 — the single view and the fold's key (1.177)

Files: `src/renderer/app.ts` (`renderSessionList`, `buildFrame`'s `#view-switch`),
`src/renderer/work.ts`, `src/renderer/style.css`, `src/core/i18n/en.ts`, `src/core/i18n/es.ts`,
`src/core/projects/{store,model,info,orchestration}.ts`, `src/main/projects.ts`,
`src/main/workspace.ts` (`setTeamView`, `teamView`), `src/shared/workspace.ts` (`setTeamView`),
`tests/core/projects/orchestration.test.ts`, `e2e/work-view.spec.ts`, `e2e/orchestration.spec.ts`,
`e2e/session-control.spec.ts`. After block 3.

- [ ] `renderSessionList` with the mode on: `#topics-section` = tiles + `topicsSection`;
  `#session-list` = tasks (`tasksFolded`) + "See all" + `modeList` + the hidden foot (D4) +
  `doneSection` + the drag marker. Remove `viewSwitch`, `#view-switch` from `buildFrame`, Work's
  `consultantsSection`, `SHOWN_TASKS`, the `work` class.
- [ ] The store: `orchestrator_open` (absent = folded); `orchestrator_collapsed` and `team_view` no
  longer read and not written back; `teamView` and `setTeamView` removed. Tests: a file with
  `orchestrator_collapsed: true`, and one with neither → folded; `orchestrator_open: true` →
  unfolded, written back; `team_view: true` → not written back.
- [ ] i18n: remove `work.view`, `work.work`, `work.team` from both catalogs.
- [ ] e2e, rewritten where they click `#view-switch` or seed `team_view` (`work-view.spec.ts:274`,
  `:335`, `:870`; `orchestration.spec.ts:109`, `:648–651`; `session-control.spec.ts:458`): the
  order (tiles, Awaiting you, "Tasks · 8" with 3 rows and "See all (8) →", the orchestrator folded
  with "6" and a red dot when a child waits at a prompt, Consultants, Others, "N hidden", Done today
  folded); no `#view-switch`; at 1280×600 with the list scrolled to its end, the tiles and
  "Awaiting you" visible; ⋮ on a worker row lists the same labels as before (the list in the test);
  the triangle saves `orchestrator_open`.
- Verify: `npm run ci`; `npm run ui-check`; screenshots of the folded and unfolded sidebar, dark and
  light, 1280×800, to compare with task 60's picks.

### Block 5 — the looks (1.176)

Files: `src/renderer/app.ts` (`tabButton`, `renderStrip`'s pills, `row`/`teamText` weights, the
toast), `src/renderer/style.css`, `src/core/i18n/en.ts`, `src/core/i18n/es.ts`,
`e2e/background-workers.spec.ts`. After block 4.

- [ ] The peek: italic, regular, pin button with its tooltip, double-click → `pinTab`.
- [ ] Rows: `rowWeight` → `.name` classes and the `pin-mark`.
- [ ] The pills (2.5): from `agentStates.panes[]`, shown project, tabs' order (D6), one each (Q6).
- [ ] The toast from `backgrounded`.
- [ ] New strings, both catalogs (Spanish proposed, for `set` to check): `tab.pin` "Pin tab (or
  double-click it)" / "Fijar pestaña (o doble clic)"; `row.pinned` "Pinned tab" / "Pestaña
  fijada"; `tab.blockedWorker` "{name} · permission" / "{name} · permiso"; `toast.background`
  "{name} keeps running in the background" / "{name} sigue trabajando en segundo plano".
- [ ] e2e: rows' weights (background regular, peek italic, pinned bold with pin, a parked worker
  regular); a click on another worker replaces the peek; the pin and the tab's double-click pin;
  the toast once, not on the second close; ASK in a background worker → its pill, which opens it in
  the peek; **Take control in the peek → the tab stays selected, no longer italic**; Take control
  from a background worker's row menu → an ordinary tab.
- Verify: `npm run ci`; `npm run ui-check`; screenshots of each state, dark and light.

### Block 6 — what agents read, the docs, R10 (on main, with `set`)

Files: `src/core/control/protocol.ts`, `src/main/workspace.ts` (replies and refusals only),
`plugin/guide/orchestration-mode.md`, `plugin/skills/orchestrator/workers.md`, `docs/window.md`,
`docs/orchestration.md`, `docs/projects.md`, `docs/sessions.md`, `docs/NOT_BUILT_YET.md`, their
`docs/history/` files, `docs/history/root/AGENTS.history.md`, `AGENTS.md` once Q1 is answered.

- [ ] Agent-facing sentences that become false, with **"running"** where they say "has a tab":
  - `start_session` (`protocol.ts:28`): "Starts a new Claude Code session in your Menkar project,
    without taking the focus. A worker you start runs in the background, with no tab of its own,
    until the human opens it; any other session gets a tab after yours. …" (the rest as now);
  - `resume_session` (`:286`) likewise; `park_session` (`:276`): "… Menkar hangs it up, as Stop
    does, …"; `list_sessions` (`:74`): "whether it is running";
  - replies (`workspace.ts:1422`, `:1899–1902`) and refusals (`:1399` "… is already running.",
    `:1817` "A session called "…" is already running in this project.");
  - the guide (`orchestration-mode.md:44`, `:58`, `:62`, `:128–129`, `:137`, `:160–163`, `:311`)
    and `workers.md:24`, plus one line: closing a worker's tab does not free a slot under the cap.
- [ ] The docs per the exit table, the history moves in the same change (the history check).
- [ ] R10: tools/list and the plugin files change; `set` refreshes them on main
  (`npx vitest run -u tests/core/r10.test.ts`), checks only those moved, and not while 1.178's
  change is in the tree.
- Verify: `npm run ci` (history check included).

## 6. Decisions and questions (with the human as topic 51)

The reviewer's D1–D6 (`prompts/reports/menkar-t66-review-41.md` §4), with its recommendation, which
I share; then my Q1–Q6 with my pick. §2.7 says where each lands.

- **D1 — the peek's scope.** (a) **One per project** (per strip). (b) One per window. **(a).**
- **D2 — × on a worker's tab that has a second pane.** (a) **The second pane hung up, the worker to
  the background**: × never ends a worker. (b) Both hung up, as today. **(a).**
- **D3 — ⋮ Open and a row's double-click on a worker** (the human's: UI). (a) **A background worker
  is pinned; a worker with no tab opens ordinary**, as today. (b) Open peeks; only the double-click
  pins. **(a)**: an Open that the next click replaces is a surprise.
- **D4 — "N hidden" in the single view** (the human's). (a) **After Others, before Done today.**
  (b) After Done today. **(a).**
- **D5 — a worker's name with no tab** (the human's). (a) **Regular**: bold means "in the strip".
  (b) Bold, as today. **(a).**
- **D6 — the pills' order.** (a) **The tabs' order.** (b) First to wait first, with a time added to
  `PaneState` (then `src/main/agentstate.ts`, `shown.ts` and a parity test join block 5). **(a).**
- **Q1 — the human's: `AGENTS.md`'s rule.** Today: "A session belongs to one project at most, runs
  only while it has a tab, and is in at most one tab across every window; a project is open in at
  most one window." Appended: "**In the orchestration mode a worker's tab may be in the background
  — not drawn in the strip, its process and screen kept — or in its project's one peek tab
  (decision 1.176); closing a worker's tab sends it there, and only Stop, parking, its task
  closing, removing or deleting it, its window closing or quitting end it.**" Pick: this, which
  keeps the invariant the code relies on (every running session has exactly one tab).
  Alternative: rewrite the first sentence to "runs only while it has a tab or runs in the
  background".
- **Q2 — which sessions go to the background.** (a) **`isWorker`: under the orchestrator, no role**;
  experts keep ordinary tabs, as they are long-lived and never parked. (b) Experts too. **(a).**
- **Q3 — a worker stops being backgroundable** (mode off, orchestrator unmarked, a role, Take back,
  With you). (a) **Its tab becomes ordinary; nothing stops.** (b) It is hung up. **(a).**
- **Q5 — the weight on rows that are not workers.** (a) **Unchanged**, as in task 60's mock-ups the
  human approved. (b) Regular without a tab, for every row. **(a).**
- **Q6 — several background workers at a prompt.** (a) **One pill each.** (b) One pill with a count,
  opening the first. **(a).**

## 7. Execution log

(Written by the session that executes it.)

### Block 1 — `menkar-t78` (task 78), 2026-11-18

**Built** (core only; nothing in main or the renderer calls it yet):

- `src/core/projects/place.ts`: `type TabPlace = 'background' | 'peek'`, nothing else.
- `src/core/projects/model.ts`: `SavedTab`'s session variant gains `place?: 'background'`.
- `src/core/projects/layout.ts`:
  - `SessionTab.place?: TabPlace` (absent = ordinary).
  - `shownTabs` (so `shownTab`, `stepTab`, `nthTab`, `openBeside`'s target) skip background tabs.
  - The neighbour rule: `withoutTab`'s selection logic is now `selectionWithout(w, tabId)`, which
    picks a **drawn** neighbour of the same project (next, else previous); `closeTab` and
    `toBackground` share it.
  - `select(layout, windowId, tabId)`: a background tab → the project's peek, moved after the
    project's last tab, the project's previous peek → background in place; any tab → selected.
    **It also sets `shown` to the tab's project** (as `revealPane` and `openSession` did).
    Unknown tab → same layout.
  - `toBackground(layout, windowId, tabId)`: session tab with **exactly one pane** in `tab.panes`
    → `place: 'background'` in place, selection by the neighbour rule; a two-pane tab, a file tab
    or an already background one → the same layout object. Main must hang up the second pane
    first (D2) — and main's `tabPanes` (a split shell) is not seen here.
  - `pin(layout, windowId, tabId)`: a peek → ordinary in place, selected; a background tab →
    ordinary, moved **right before the project's peek** (or last when there is none), selected,
    the peek stays; any other tab → `select`.
  - `ordinaryUnless(layout, keep)`: **signature differs from §2.3's** `(layout, backgroundable,
    selected)`: it is `keep: (tab: SessionTab) => boolean`, by tab, so main can combine
    `backgroundable(session)` with its `tabPanes` count; the selection is read from the layout.
    A placed tab loses its place when `keep` is false **or `tab.panes.length !== 1`**. A selected
    peek → ordinary in place; every other losing tab → ordinary, re-inserted before the project's
    surviving peek (or last when none survives), in their original order; nothing selected changes.
    Returns **the same layout object** when nothing changes, so `changed()` can call it cheaply.
  - `openSession(..., newId, options: OpenOptions = {})`, `OpenOptions = { pin?, worker? }`. A
    found tab → `pin` when `options.pin`, else `select` (a background tab is peeked). A new tab: a
    worker's (`worker(sessionId)`) goes before the project's peek; anyone else's after the
    project's last tab that is not a worker's (a tab with a `place`, or whose panes include a
    `worker`), or first among the project's tabs when all are workers'. Without `worker`, every
    unplaced tab counts as ordinary, so a new tab lands before background tabs and the peek.
  - `openBeside`: the tab it extends loses its `place` (a peek given a second pane is pinned).
  - `moveSessionHere`: a placed tab that comes here (from another window, or re-projected in this
    one) arrives as background and is `select`ed → the peek; an ordinary one is inserted before the
    peek and selected, as before. **My choice**: a background tab already in this window's shown
    project is peeked too (before: Add session on it changed nothing).
  - `insertTabAfter`: an unplaced tab that would land after its project's peek goes right before
    it; a background tab goes where asked.
  - `toSaved`: background and peek → `place: 'background'`; `reopen` reads only
    `place === 'background'`, anything else ordinary.
- `tests/core/projects/layout.test.ts`: 17 tests for the list above, then **the sweep**: one case
  per exported function of `layout.ts`, discovered from the module (`Object.entries`, a floor of
  20); a new export without a case fails. Each case runs the function over every window, tab and
  session of a layout with background tabs in two windows and three projects, and checks no
  `selected` names a background tab, no project has two peeks, and no returned tab id is a
  background one.

**Seen red**: six defects injected one at a time into `layout.ts` and reverted — the neighbour
allowed to be background, the previous peek not demoted, `shownTabs` drawing background tabs,
`toSaved` dropping `place`, `ordinaryUnless` keeping a two-pane placed tab, an uncovered export —
each failed its tests (and the sweep, where it applies).

**Not done here, for block 3**: main does not call any of it; `revealPane`, `revealTab`, the
`selectTab` action and the selection writes at `workspace.ts` 2386–2633/2984 still write
`selected` directly. **The plan's "peek is the last tab" holds only through these functions**:
`moveTab` (dragging) stays free, as §2.3 says.

**Checks**: `npm run ci` green (108 files, 1437 tests; biome, tsc, R10, code rules, i18n, test
integrity, history), output in `$MENKAR_FILES/menkar-t78-41-b1-ci.log`.
