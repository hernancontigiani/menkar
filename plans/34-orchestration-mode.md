# Plan 34: the orchestration mode in the app

> **Status:** written 2026-11-12 by `set` with the human, ready to execute.
> **Design:** decisions 1.77, 1.78, 1.83, 1.84, 1.86, 1.89, 1.90, 1.91 (`plans/00-STATUS.md` §1);
> sources `plans/ideas/groups-and-orchestration.md`, `plans/ideas/research/`, plan 31's tools and
> plan 33's skills. The look was chosen from mock-ups (A1 · B1 · C1 · D1 · E1 · F1).
> **Exit, when executed:**
> - `docs/orchestration.md` (new, with its row in `CLAUDE.md`'s subsystem table): the mode as a
>   subsystem — its data, the sidebar in the mode, the topics store, the first-time card, the
>   `Ctrl+\`` picker, and the "Rejected" section of this plan.
> - `docs/session-control.md`: the four `topic_*` tools, the new `list_sessions` fields, the
>   `start_session` refusal, the wake order; "four tools" becomes eight.
> - `docs/projects.md`: the orchestration keys of `projects.json`.
> - `plugin/guide/orchestration-mode.md` (new): the user's and the agents' guide, shipped.
> - `plugin/skills/orchestrator/SKILL.md`: topics through `topic_*`, "with you", priority.
> - `plans/ROLE-ORCHESTRATOR.md`: the topics-file trial (1.52) ends; this repository's orchestrator
>   uses `topic_*`. The paragraph leaves for `docs/history/plans/ROLE-ORCHESTRATOR.md`.
> - `README.md`: one paragraph on the mode.
> - `docs/NOT_BUILT_YET.md`: the online guide (trigger: plan 28's site); "with you" known by itself.
> - `plans/00-STATUS.md`: rows 1.77, 1.78, 1.86, 1.89, 1.90, 1.91 point to `docs/orchestration.md`;
>   the old cells leave verbatim for its history.
> **Replaces:** nothing. **Amends:** 1.77 point 3 (no panel; 1.89), already recorded.

## 1. Goal

A project can be switched into an orchestration mode where the human talks to one orchestrator
session, sees the team in the sidebar ordered by role, and sees the open topics the orchestrator
keeps for them; off, Menkar is as today and the marks wait.

### What already exists (verified 2026-11-12)

- **Projects data:** `Project` in `src/core/projects/model.ts:16-37` (`hidden`, `earlier`,
  `parents`, `rest`); lenient parse in `src/core/projects/store.ts:55-136`, written whole by
  `serializeProjects` (141-168) through `writeJson` (`src/core/jsonstate.ts:85`). A key not read is
  dropped (how `leader` went, store.ts:92).
- **Following a new id:** `followNewId` / `followResume` in `src/core/projects/rekey.ts` move
  membership, group, hidden flag and parents (`followParents`, `src/core/projects/parents.ts:36`).
  `leave()` (model.ts:110) and `forgetSession` (`src/core/projects/earlier.ts:67`) tidy a session out.
- **Projects to the renderer:** actions through `'window:action'` (`src/shared/workspace.ts:82-212`,
  handled in `src/main/workspace.ts`, e.g. `hideSession` at 1856), state pushed as `ProjectInfo`
  (`src/core/projects/info.ts:5-18`, mapped at workspace.ts:371-378).
- **Sidebar:** `renderSessionList` (`src/renderer/app.ts:353-453`), `row()` (660-740),
  `rowMenu` (742-810), project popover `openProjectPopover` (1254-1316), header built in
  `buildFrame()` (143-232); the Files section is the precedent of a collapsible sidebar section
  saved per project (`filesCollapsed`).
- **MCP tools:** `TOOL_NAMES` (`src/core/control/files.ts:12`), `TOOLS` (`protocol.ts:12-59`),
  `handleControl` (`src/main/workspace.ts:894-909`, a switch with no default), `list_sessions`
  answered from the snapshot (`server.ts:12-18`; `Snapshot` at files.ts:142-156, built by
  `snapshotOf`, workspace.ts:1095-1116), `startForAgent` (workspace.ts:1007-1067), parents set at
  1039. Tool-name parity with the skills: `tests/core/plugin.test.ts:85-87`; the exact tool list:
  `tests/core/control/server.test.ts:54-66`.
- **Wakes:** `WakeBatcher` (`src/core/control/events.ts:22-59`), one message per parent per
  `WAKE_DELAY_MS`, events joined by "; ", no priority.
- **Shell drawer:** `toggleDrawer` (`src/renderer/app.ts:1231`) → action `toggleDrawer`
  (`src/main/workspace.ts:1986-1996`) → `openDrawer` (299-338) with `drawerFolder`
  (`src/core/drawers.ts:13-26`).
- **Quick list:** `jumpDialog` (`src/renderer/switcher.ts:44-148`) with `start` (preselected row);
  used by `projectSwitcher` (217-254).
- **Starting a new session from the UI:** action `startNew` (`src/main/workspace.ts:2026-2056`), no
  first prompt today; `start_session`'s first prompt goes through `prompted` / `promptFile`
  (workspace.ts:887-922).
- **Read-only file tabs:** `checkFile` returns a `readOnly` key (`src/core/files/check.ts:53`),
  honoured by `src/main/files.ts:140,156`.
- **The plugin folder:** `pluginFolder` (`src/core/paths.ts:59`), `plugin/` in the repository,
  `resources/plugin` when packaged (`electron-builder.yml:28-31`).
- **UI checks:** Playwright specs in `e2e/`, one per feature, screenshots by explicit
  `page.screenshot` to `/tmp/menkar-shots/` (e.g. `e2e/drawer.spec.ts:157-170`). There is no
  `tools/ui/check.py`.

## 2. The design

### 2.1 Data, in `projects.json`, per project

```ts
// on Project
readonly orchestration?: {
  readonly on: boolean
  readonly orchestrator?: string        // session id; one per project
  readonly roles?: Record<string, string>  // id → free label (1.83), e.g. "Fabric expert"
  readonly priority?: readonly string[] // ids with the ★ (1.78)
  readonly withYou?: readonly string[]  // ids marked "with you" by hand (1.86)
}
readonly topicsCollapsed?: true         // the Topics section shows its heading alone
```

On disk the keys are snake_case like the others (`orchestration: {on, orchestrator, roles,
priority, with_you}`, `topics_collapsed`). Read leniently: a wrong type drops that key, an id that
is not a member is dropped, an orchestrator that is not a member leaves none. Written only when
something is set. **Off keeps everything** (1.77 point 1): `on: false` with its marks.

Every place that moves or removes a session moves or removes its marks: `followNewId` and
`followResume` (the new id takes the old one's role, orchestrator mark, ★ and "with you", as 1.56
says it takes its place), `leave()`, `forgetSession`.

### 2.2 Topics, in `topics.json` in the config directory

A file of its own, not `projects.json`: agents write topics often, and a broken topics file must
never move the projects aside. Written whole through `writeJson`, read leniently through the same
`readJsonReport` as the others (an unreadable one is moved aside, never deleted).

```ts
interface Topic {
  readonly number: number       // per project, never reused (next = highest ever + 1)
  readonly title: string
  readonly context: string
  readonly from: string         // the session's id; shown by its current name
  readonly blocking: boolean
  readonly status: 'open' | 'discussing' | 'closed'
  readonly decision?: string    // set by topic_close
  readonly created: string      // ISO, through src/core/clock.ts
  readonly updated: string
}
// topics.json: { version: 1, projects: { [projectId]: { next: number, topics: Topic[] } } }
```

A closed topic stays with its decision (the human may ask "what did we decide on 7?").

**Order shown** (in the Topics section and in `topic_list`): open and discussing only; those whose
`from` session has the ★ first; then by number. Blocking ones are marked, not moved (1.77).

### 2.3 Menkar's MCP tools

- **`topic_add { title, context, blocking? }`** → "Topic N added." `from` is the caller.
- **`topic_update { number, title?, context?, blocking?, status?: "open" | "discussing" }`**.
- **`topic_close { number, decision }`** → closed with its decision.
- **`topic_list { all? }`** → the order above; `all: true` adds closed ones, with their decision.
  Each line: number, ★ if from a priority session, title, from (name), blocking, status, context.
- Any session of the project may call them. A topic of another project is "not found".
- **`list_sessions`** gains, per session: `role` (label or null), `orchestrator` (bool),
  `priority` (bool), `with_you` (bool); and at the top `orchestration` (bool). With the mode off
  the four fields are null/false: off is the ordinary Menkar.
- **`start_session`**, with the mode on and an orchestrator marked, refuses any caller that is not
  the orchestrator (1.84): "Only this project's orchestrator, ‹name›, starts sessions. Ask it to
  delegate the work." With the mode off it works as today.
- **Wake order** (1.78 point 6): in one batched message to a parent, events of ★ children come
  first; otherwise the order stays as today.

### 2.4 The sidebar in the mode (1.89, mock C1)

A pure function in core, `modeRows(project, view)` → the ordered items the renderer draws:

1. **The orchestrator**, then its children with a tab, indented; then one "N earlier" row for its
   children without a tab, folded; a click unfolds them (per window, not saved).
2. Heading **"Experts and consultants"**: every session with a role label that is not the
   orchestrator and not nested, each followed by its own children as in 1.
3. Heading **"Others"**: the rest, with groups as today (headings, collapsed groups, drag order).

A child is nested under its parent wherever the parent sits; a child of a child is nested under the
same top row (one level of indent). Rows of parts 1 and 2 follow `project.members` order and are
not dragged; dragging works in part 3 as today. Hidden rows and earlier conversations stay out, as
today. Each row shows its role label after the name (as `.folder` does today) and the ★ for
priority; "with you" shows as a small badge.

**Topics section** (A1): at the top of the sidebar while the mode is on, collapsible like Files
(`topicsCollapsed`), heading "Topics · N". Each row: ★ if from a priority session, number, title
(ellipsed), a red mark if blocking. A click unfolds its context, from, and status under it; read
only (1.86). Empty: "No open topics".

### 2.5 Switching the mode, the row menu, the first-time card

- **Header (E1):** a switch with the word "Orchestration" right of Usage, for the project the
  window shows.
- **Project popover (D1):** a team icon per project row beside rename and delete, lit when on.
- **Row menu (B1):** with the mode on, after "Group ▸", a block: "✓ Orchestrator" (marking one
  unmarks the previous), "Role…" (a small dialog with one text field; empty removes the label),
  "✓ Priority", "✓ With you".
- **First-time card (F1, 1.90–1.91):** switching on a project with no orchestrator marked opens a
  card instead: a title "Orchestration mode · ‹project›", two lines on what it is, "Who
  orchestrates?" with one radio per listed session (with a tab first, then by name) and "A new
  session" (name, default "orchestrator", and a folder chosen among the project's sessions' folders,
  the same list as `Ctrl+\``; with none, the recent folders Add session offers). Buttons: "Open the
  guide", "Copy a prompt for another session", "Not now" (the mode stays off), "Start" (marks the
  chosen session or starts the new one, then switches the mode on).
  - A new orchestrator starts through `startNew` extended with a first prompt, as `start_session`
    passes one: "Load `menkar:orchestrator`. You are the orchestrator of the project ‹name›."
  - **The guide** is `plugin/guide/orchestration-mode.md`, shipped in the plugin folder, so every
    session can read it from disk with no network. "Open the guide" opens it in a Menkar file tab,
    read only (a new `readOnly` key for files under the plugin folder). "Copy a prompt" copies:
    "Read ‹absolute path› — Menkar's guide to its orchestration mode — and help me set it up in
    this project." No external link (nothing leaves the machine; the online copy waits for plan 28).

### 2.6 `Ctrl+\`` in the orchestrator's tab (1.78 point 7)

With the mode on and the selected tab running the orchestrator, a `Ctrl+\`` that would open the
drawer first gathers the folders of the project's sessions with a running pane, deduplicated.
One folder: it opens there at once, as today. Several: `jumpDialog` lists them by last folder
name with the full path as caption, the last one chosen (per window and project, in memory)
preselected; Enter opens the drawer there. A shown drawer is hidden as today, with no list.
`toggleDrawer` gains an optional `folder`.

### 2.7 Rejected, and why

- **A panel beside the orchestrator's tab** (1.77's first form): it repeated the team the sidebar
  already shows and took width from the terminal; the human chose the sidebar section (1.89).
- **Answering a topic from the panel**: the discussion stays in the orchestrator's chat, where
  voice works (2026-11-11, 1.86).
- **"With you" known by itself** (typing in the pane, a timer): the human chose a manual toggle
  (1.86); a prompt sent from the phone would not be seen anyway.
- **Topics inside `projects.json`**: written often by agents; a broken file would take projects
  with it.
- **Fixed roles** (Expert, Consultant, Reviewer, Worker): a free label (1.83).
- **An external link in the card now**: no site exists; the app opens no URL of its own.
- **Blocked events before finished ones in a wake**: not decided; only ★ first (1.78).

### 2.8 Product decisions and the tests that hold them

| Decision | Test (written before the code) | The case |
|---|---|---|
| Off keeps the marks (1.77.1) | `tests/core/projects/orchestration.test.ts` | set role, orchestrator, ★; switch off; serialize → parse: all there, `on: false` |
| One orchestrator per project (1.77.2) | same | mark A, then B → orchestrator is B |
| Marks follow a `/clear` (1.56) | same, with `followNewId` | role "Fabric expert" and ★ on X; X → Y: Y has both, X none |
| Leaving a project drops the marks | same | `leave` X → no key names X |
| Lenient read | `tests/core/projects/store.test.ts` | `orchestration: {on: "yes", roles: {X: 3}}` → on false, no roles; ids not members dropped |
| Numbers never reused (1.78.5) | `tests/core/orchestration/topics.test.ts` | add 1, 2; close 2; add → 3 |
| Topics order (1.77.3) | same | topics 1 (from A), 2 (from ★B, blocking), 3 (from A, closed) → [2, 1] |
| Closed topics keep their decision | same | close 3 with "trash" → `all` lists it with "trash" |
| `list_sessions` fields | `tests/core/control/server.test.ts` | snapshot with role/★/with_you → returned; mode off → null/false |
| Only the orchestrator starts sessions (1.84) | `tests/core/orchestration/mayStart.test.ts` (pure `mayStart(project, callerId)`) | on + orchestrator O: O yes, W no (refusal names O); off: W yes; on with none: W yes |
| ★ wakes first (1.78.6) | `tests/core/control/events.test.ts` | children A then ★B finish within the delay → "B …; A …" |
| Sidebar in the mode (1.89, C1) | `tests/core/orchestration/rows.test.ts` | O with children W1 (tab), W2, W3 (no tab), E with role, S plain, G group → [O, W1, earlier(2), heading experts, E, heading others, group G…, S] |
| Folders for `Ctrl+\`` | `tests/core/orchestration/folders.test.ts` | panes in /a, /b, /a → [/a, /b]; one → no list |
| Tool names in the skills | `tests/core/plugin.test.ts` (exists) | `topic_list` named in the orchestrator skill ⇒ in `TOOL_NAMES` |

## 3. Out of scope

- Who may write a topic beyond the project (no cross-project topics).
- Waking a session that is "with you" differently; Menkar only marks it.
- Notifications for a new topic (toast, sound, dock count): not decided.
- Dragging rows in the role parts; ordering roles among themselves beyond `members` order.
- The online guide and its link (plan 28's site); translating the guide (English only, like docs).
- Other agents (Cursor) in the mode: the tools are Claude's (2.21 stays open).

## 4. Do not touch

- The ordinary sidebar with the mode off: `renderSessionList` must draw exactly today's rows
  (`e2e/groups.spec.ts`, `e2e/row-drag.spec.ts` stay green unchanged).
- `renew`, `last_reply`, and the request/response files' format.
- `Ctrl+\`` outside the orchestrator's tab, and in it when only one folder is active
  (`e2e/drawer.spec.ts` unchanged).
- Anything under `~/.claude`: the mode writes only Menkar's own files.
- The human's running Menkar and its `~/.config/menkar/`: tests use the temporary HOME of
  `e2e/app.ts`.

## 5. Execution blocks

Each block ends with `npm run ci` green. UI blocks also run their e2e spec through `npm run
ui-check` (or `xvfb-run -a env MENKAR_E2E_XVFB=1 npx playwright test e2e/<spec>` after
`npx electron-vite build`) and save the named screenshots to `/tmp/menkar-shots/` and copies in
`$MENKAR_FILES`, named `b1-…`.

### Block 1 — the orchestration data in `projects.json`
- [ ] Tests first: `tests/core/projects/orchestration.test.ts` and the lenient case in
  `store.test.ts` (rows 1–5 of §2.8); see them fail.
- [ ] `Project.orchestration` and `topicsCollapsed`; parse and serialize in `store.ts`.
- [ ] Pure mutations in `src/core/projects/orchestration.ts`: `setMode`, `setOrchestrator`,
  `setRole`, `setPriority`, `setWithYou`, `setTopicsCollapsed`.
- [ ] Follow and tidy in `rekey.ts` (`followNewId`, `followResume`), `leave()`, `forgetSession`.
- [ ] `ProjectInfo` gains `orchestration` (on, orchestrator, roles, priority, withYou) and
  `topicsCollapsed`; mapped in `src/main/workspace.ts:371-378`.
- **Verify:** `npm run ci`.

### Block 2 — the topics store
- [ ] Tests first: `tests/core/orchestration/topics.test.ts` (rows 6–8), with the clock injected.
- [ ] `src/core/orchestration/topics.ts`: the model, `addTopic`, `updateTopic`, `closeTopic`,
  `shownTopics(project, list)`; the store read and written through `jsonstate.ts`; its path in
  `src/core/paths.ts` (config directory, resolved when called).
- [ ] Main loads it at start and keeps it, as `src/main/projects.ts` keeps projects; topics pushed
  to the renderer in the window state for the shown project (shown order, `from` as a name).
- **Verify:** `npm run ci`.

### Block 3 — the MCP side
- [ ] Tests first: tool list in `server.test.ts`, the snapshot fields, `mayStart.test.ts`, the
  ★-first case in `events.test.ts` (rows 9–11).
- [ ] `TOOL_NAMES` and `TOOLS` gain the four `topic_*` (descriptions written for an agent, one
  sentence each); `handleControl` cases calling block 2; refusals in our own English sentences.
- [ ] `Snapshot` gains `orchestration` and per session `role`, `orchestrator`, `priority`,
  `withYou` (`with_you` in the answer); `snapshotOf` fills them; `snapshotsChanged` on every
  orchestration change.
- [ ] `mayStart` in `src/core/orchestration/`, called first in `startForAgent`.
- [ ] `WakeBatcher` takes a `isPriority(child)` and puts ★ children's events first.
- **Verify:** `npm run ci`; by hand in the e2e harness of `e2e/session-control.spec.ts`, a second
  session calling `start_session` in the mode is refused.

### Block 4 — switching the mode and the row menu
- [ ] Actions in `src/shared/workspace.ts`: `setOrchestrationMode`, `setOrchestrator`, `setRole`,
  `setPriority`, `setWithYou`, `setTopicsCollapsed`; cases in `src/main/workspace.ts`.
- [ ] The header switch (E1) in `buildFrame()`; the popover's team icon (D1); the row menu block
  (B1) and the "Role…" dialog. Every string through `t()`, English and Spanish.
- [ ] The switch on a project without an orchestrator opens the card of block 6; until block 6
  lands, it switches on directly (the card replaces that call).
- [ ] `e2e/orchestration.spec.ts`: switch on from the header and from the popover; mark an
  orchestrator, a role, ★, with you, and read them back through `menkar.window.state()`; off and
  on again keeps them. Screenshots `orchestration-header-{off,on}.png`,
  `orchestration-row-menu.png`, `orchestration-popover.png`.
- **Verify:** `npm run ci`; the spec green; the screenshots show the switch's word, the lit icon,
  and the menu's block after "Group ▸".

### Block 5 — the sidebar in the mode and the Topics section
- [ ] Test first: `tests/core/orchestration/rows.test.ts` (row 12).
- [ ] `modeRows` in core; `renderSessionList` draws it when the shown project's mode is on, and
  today's rows otherwise (the `else` is the current code untouched).
- [ ] Role label, ★ and "with you" badge in `row()`; the "N earlier" row; the two headings.
- [ ] The Topics section at the top, collapsible and saved, click to unfold.
- [ ] Spec: a project with an orchestrator, two children (one closed), an expert, a plain session
  and three topics (one from a ★ session, one blocking), seeded through `projects.json` and
  `topics.json` in the test HOME. Screenshots `orchestration-sidebar.png`,
  `orchestration-topics-open.png`.
- **Verify:** `npm run ci`; spec green; `groups.spec.ts` and `row-drag.spec.ts` unchanged and
  green; the screenshot matches mock C1 with the Topics section of A1.

### Block 6 — the first-time card and the guide
- [ ] `plugin/guide/orchestration-mode.md`, written for a user and for an agent reading it on
  their behalf: what the mode is; the orchestrator, roles, ★, "with you"; topics and the
  `topic_*` tools; the sidebar; who may start sessions; which skills to load; the three shapes of
  an orchestration (from `plans/ideas/groups-and-orchestration.md`, "Three real profiles", told
  without the projects' names). No number that a test does not assert.
- [ ] `startNew` takes an optional first prompt, passed as `start_session` passes one.
- [ ] A read-only key for files under `pluginFolder` in the file check; opening the guide uses it.
- [ ] The card (F1), shown by both switches when no orchestrator is marked; "Copy a prompt"
  through `navigator.clipboard.writeText` with the guide's absolute path.
- [ ] Spec: switch on → the card; "Not now" → off; choose an existing session → marked and on;
  "Open the guide" → a read-only file tab; "A new session" → a tab named as typed, marked
  orchestrator (the test's fake `claude`, as the other specs use). Screenshot
  `orchestration-card.png`.
- **Verify:** `npm run ci`; spec green; the screenshot matches mock F1;
  `npm run package && npm run package:check` lists `resources/plugin/guide/orchestration-mode.md`.

### Block 7 — `Ctrl+\`` in the orchestrator's tab
- [ ] Test first: `tests/core/orchestration/folders.test.ts` (row 13).
- [ ] `toggleDrawer` with an optional `folder`; the renderer gathers the folders (from the window
  state) and calls `jumpDialog` when there are several.
- [ ] Spec: orchestrator in /a, a worker running in /b → `Ctrl+\`` lists /a and /b, Enter on /b
  opens the drawer in /b; again after hiding it preselects /b; in the worker's tab no list.
  Screenshot `orchestration-folders.png`.
- **Verify:** `npm run ci`; spec green; `drawer.spec.ts` unchanged and green.

### Block 8 — the skills and the documents
- [ ] `plugin/skills/orchestrator/SKILL.md`: the topics paragraph uses `topic_add`, `topic_update`,
  `topic_close`, `topic_list` (a project without Menkar's tools keeps a topics file, one line); a
  session `with_you` gets no work; ★ sessions' topics and reports first. Under 200 lines.
- [ ] `plugin/skills/worker/SKILL.md`: when the human, talking to it directly, says a topic is
  closed, it sends the orchestrator a short summary by name, with a plan's path if there is one
  (1.78 point 8). Check whether a line already says it before adding one.
- [ ] The exit of the header: `docs/orchestration.md` and its `CLAUDE.md` row, the other docs,
  `README.md`, `NOT_BUILT_YET.md`, the STATUS rows and their history.
- **Verify:** `npm run ci` (plugin parity, history check); `npm run ui-check` whole.

## 6. Execution log

(Written by the session that executes it.)
