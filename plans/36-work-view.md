# Plan 36: the work view — delegated tasks with steps, the ★ on tasks, the Board

> **Status:** written 2026-11-13 by `set` with the human, ready to execute.
> **Design:** decisions 1.112–1.116 (`plans/00-STATUS.md` §1), discussed as topics 19–21 in Menkar's
> Topics section, from mock-ups M1 and M3; `plans/ideas/research/management-view.md`.
> **Exit, when executed:**
> - `docs/orchestration.md`: tasks (data, states, tools), the ★ on tasks, the Work and Team views,
>   the Board; history for every line that leaves (the session ★ above all).
> - `docs/session-control.md`: the task tools and `topic_add`'s `task`; the wake order by task ★.
> - `plugin/skills/orchestrator/SKILL.md`, `plugin/skills/worker/SKILL.md`,
>   `plugin/guide/orchestration-mode.md`: delegating with a task, reporting steps, reviewing.
> - `plans/00-STATUS.md`: rows 1.112–1.116 point to their docs (`set` at closing).
> **Amends:** 1.78 point 6 and 1.100 (the ★ moves to tasks, 1.114), already recorded.

## 1. Goal

The human sees what waits on them (topics) and how far each delegated task is ("Release 0.2 ·
packager · 3/5 · building .deb"), in the sidebar's width, and every task in a Board tab.

### What already exists (verified 2026-11-13)

- **Topics** are the pattern to copy: `src/core/orchestration/topics.ts` (model, store through
  `jsonstate.ts`, `topicTool`, `shownTopics` at 165 ranking by the *session* ★ at 169–170, the
  `★ ` prefix at 326); main keeps them in `src/main/topics.ts`; the tools in `TOOL_NAMES`
  (`src/core/control/files.ts:12`) and `TOOLS` (`protocol.ts`); `handleControl` in
  `src/main/workspace.ts`.
- **The session ★** lives in `orchestration.priority` (`src/core/projects/orchestration.ts`: parse
  at 40/60, write at 15–22/74, follow at 96–103); the row menu's "Priority" and the wake order
  (`WakeBatcher`'s `isPriority`, `src/core/control/events.ts`) read it.
- **The sidebar in the mode:** `modeRows` (`src/core/orchestration/rows.ts`) and
  `src/renderer/orchestration.ts` (Topics section, header switch, row menu block, card).
- **Tabs** are `kind: 'session' | 'file' | 'transient'` (`src/shared/workspace.ts:25`).
- **The clock:** `src/core/clock.ts` (midnight for "Done today").

## 2. The design

### 2.1 Tasks (1.113), in `tasks.json` in the config directory

```ts
interface Task {
  readonly number: number          // per project, never reused
  readonly title: string
  readonly assignee: string        // session id, shown by its current name; followed on a new id
  readonly star: boolean           // 1.114
  readonly state: 'queued' | 'in progress' | 'waiting' | 'to review' | 'done' | 'dropped'
  readonly steps: readonly string[]  // 3–7, set by the assignee; empty while queued
  readonly step: number            // 1-based current step; 0 while queued
  readonly note: string            // one line, the latest report
  readonly waitingOn?: string      // "topic 4" or a session name, while waiting
  readonly created: string; readonly updated: string; readonly closed?: string  // clock.ts
}
```

A file of its own, like topics (a broken one never takes projects with it); read leniently.
A session's **current task**: its task in progress or waiting, else its oldest queued one.

### 2.2 The tools

- `task_add { title, assignee, star? }` → "Task N added." **Orchestrator only** (refused to others
  and with the mode off). State queued.
- `task_steps { number, steps }` — the assignee only: 3 to 7 non-empty lines; sets in progress,
  step 1.
- `task_progress { number, step?, note, waiting_on? }` — the assignee only: advances, writes the
  note; with `waiting_on` the state is waiting, without it in progress.
- `task_review { number, note }` — the assignee only: state to review.
- `task_close { number, outcome: "done" | "dropped" }` — orchestrator only.
- `task_list { all? }` — anyone: open tasks (★ first, then by number); `all` adds closed ones.
- `topic_add` gains `task?` (a number): the topic belongs to that task.
- Refusals are our own sentences for the agent. Tasks follow a session to a new id (`/clear`,
  resume, renew, reused name) as the other marks do.

### 2.3 The ★ moves to tasks (1.114)

- Remove the session ★: `orchestration.priority` is read and dropped; the row menu's "Priority"
  goes; `list_sessions`'s `priority` becomes the current task's ★.
- A row shows ★ while its current task has one.
- `shownTopics` ranks a topic first when its `task` has the ★; then blocking; then by number.
- Wakes: a child whose current task has the ★ first.
- The human toggles a task's ★ from its right-click menu (Work view and Board).

### 2.4 The Work and Team views (1.112, 1.115, 1.116)

- A switch "Work | Team" at the top of the sidebar in the mode; **Work by default**; the choice is
  saved per project like the folded sections (set's technical choice, 2026-11-13).
- **Work**, from the top: count tiles (`N topics` · `N working` · `N waiting`); **Topics** (as
  today); **Tasks** (open ones, ★ first: title, assignee, step segments, `3/5`, the note; a red
  edge while waiting); **Consultants** (one compact row each with its dot; a click opens its tab;
  foldable, saved); **Done today** (topics closed and tasks done since local midnight, newest
  first; **folded by default**, saved). When more than 6 open tasks, the list shows 6 and
  "See all (N) →".
- **Team** is today's sidebar; each session row shows its current task and step under its name.

### 2.5 The Board (1.112, 1.116)

- A new tab kind `board`, one per project per window, opened by a "Board" button right of the
  header's Orchestration switch (only while the mode is on) and by "See all (N) →"; if open, both
  select it. Saved with the layout like other tabs; closing it is like closing a file tab.
- Columns: Topics · Queued · In progress · Waiting · To review · Done (today; older folded under
  "Done before"). A card: title, ★, assignee with its dot, `3/5`, the note. A click selects the
  assignee's tab. Read only.

### 2.6 Rejected, and why

- **A time-based progress bar:** nobody knows how long a task takes; steps done over steps planned
  says where it is (the human, 2026-11-13).
- **The assignee marking its own task done:** "Done today" would mean unreviewed (1.113).
- **A separate "Waiting on you" section:** everything waiting on the human is a topic (1.115).
- **Tasks for consultants:** a consultation is a conversation, not a ticket (1.115).
- **A ★ on sessions:** urgency belongs to the work, not to who does it (1.114).

### 2.7 Product decisions and the tests that hold them

| Decision | Test (before the code) | The case |
|---|---|---|
| Numbers never reused | `tests/core/orchestration/tasks.test.ts` | add 1, 2; close 2; add → 3 |
| States and who moves them (1.113) | same, pure `taskTool` | orchestrator adds; assignee sets 4 steps → in progress 1/4; progress waiting_on "topic 4" → waiting; review → to review; assignee close → refused; orchestrator close done → done |
| Steps 3–7 | same | 2 steps → refused; 8 → refused |
| Current task | same | queued 5, in progress 3 → 3; none in progress → oldest queued |
| ★ on tasks orders topics (1.114) | `tests/core/orchestration/topics.test.ts` | topic 1 (task 2 ★), topic 2 (blocking), topic 3 → [1, 2, 3] |
| Session ★ dropped | `tests/core/projects/store.test.ts` | `orchestration.priority: [X]` → not read, not written |
| Wake order by task ★ | `tests/core/control/events.test.ts` | A (no task), B (★ task) finish together → "B …; A …" |
| Done today at midnight | `tasks.test.ts` with the clock at 23:59 and 00:01 | done at 23:58 → in "today" at 23:59, not at 00:01 |
| Tasks follow a new id | `tasks.test.ts` | assignee X → Y: the task's assignee is Y |
| Tool names in the skills | `tests/core/plugin.test.ts` | every `task_*` named in a skill is in `TOOL_NAMES` |

## 3. Out of scope

- Tasks for other agents than Claude; editing a task's title or steps by the human; due dates.
- Notifications for task changes (topics already notify what is the human's).
- Plans in `plans/` as data (milestones, % of blocks): `plans/ideas/research/management-view.md`.

## 4. Do not touch

- The sidebar with the mode off; the Team view's rows apart from the added task line.
- Topics' behaviour apart from the order; Mute, read-only tabs, `adopt_session`.
- The human's running Menkar, `~/.config/menkar/`, `~/.claude`.

## 5. Execution blocks

Each block ends with `npm run ci` green; UI blocks run their spec and, at the end, `npm run ui-check`
whole (`docs/toolchain.md`). Screenshots to `/tmp/menkar-shots/`, copied by hand to
`$MENKAR_FILES` with the worker's name first.

### Block 1 — the task store and its tools
- [ ] Tests first (rows 1–4, 8, 9); see them fail.
- [ ] `src/core/orchestration/tasks.ts` (model, lenient store, `taskTool`, current task, done
  today); `tasksPath` in `paths.ts`; main keeps them like `src/main/topics.ts`.
- [ ] The six tools and `topic_add`'s `task` in `TOOL_NAMES`, `TOOLS`, `handleControl`.
- [ ] Follow on a new id wherever the other marks follow.
- **Verify:** `npm run ci`.

### Block 2 — the ★ moves to tasks
- [ ] Tests first (rows 5–7).
- [ ] Drop `orchestration.priority` (lenient read, not written); remove the row menu's "Priority";
  the row ★ and `list_sessions`'s `priority` from the current task; `shownTopics`; `WakeBatcher`.
- **Verify:** `npm run ci`; the orchestration spec updated where it set a session ★ (an expect
  that asserted the session ★ is accepted: the human moved it, 1.114).

### Block 3 — the Work and Team views
- [ ] The switch (saved per project), the Work sections (tiles, Topics, Tasks with "See all",
  Consultants, Done today folded), the task line in Team rows, the task right-click menu (★).
- [ ] Spec with seeded `tasks.json` and `topics.json`; screenshots `‹name›-work.png`,
  `‹name›-team-tasks.png`.
- **Verify:** `npm run ci`; the spec; `groups.spec.ts` and `row-drag.spec.ts` unchanged.

### Block 4 — the Board
- [ ] The `board` tab kind, its two openers, its columns and cards, "Done before" folded.
- [ ] Spec: open from the header and from "See all", one tab only, a card click selects the
  assignee's tab; screenshot `‹name›-board.png`.
- **Verify:** `npm run ci`; the spec; `npm run ui-check` whole.

### Block 5 — skills, guide, documents
- [ ] Orchestrator skill: create a task when delegating and name its number in the handoff; close
  it after reviewing; a review that is the human's goes as a topic with what to try. Worker skill:
  with a task number, set 3–7 steps, report each advance, `task_review` when done, never close.
  The guide: tasks, the ★ on tasks, the Work view and the Board. Skills under 200 lines.
- [ ] The exit's documents, with history.
- **Verify:** `npm run ci` (plugin parity included).

## 6. Execution log

(Written by the session that executes it.)
