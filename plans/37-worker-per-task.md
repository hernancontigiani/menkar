# Plan 37: a worker per task, parking and resuming, experts with several tasks, the cap

> **Status:** written 2026-11-13 by `set` with the human, ready to execute.
> **Design:** decisions 1.118, 1.119, 1.120 (`plans/00-STATUS.md` §1), topics 22–24. Builds on plan
> 36's tasks (`src/core/orchestration/tasks.ts`).
> **Exit, when executed:**
> - `docs/orchestration.md`: per-task workers, parking and resuming, closing hides, experts with
>   several tasks, the cap; history for lines that leave.
> - `docs/session-control.md`: `start_session`'s `task`, `park_session`, `resume_session`, the cap's
>   refusals.
> - `docs/preferences.md`: the Orchestration section in Settings' Work group.
> - `plugin/skills/orchestrator/SKILL.md` (and a reference file beside it if the body would pass 200
>   lines), `plugin/skills/worker/SKILL.md`, `plugin/guide/orchestration-mode.md`.
> - `plans/ROLE-ORCHESTRATOR.md`: this repository's workers become per-task (`menkar-t<N>`, cap 2),
>   replacing b1/b2 (1.55 amended by 1.118); history for what leaves. `set` does this at closing.
> - `plans/00-STATUS.md`: 1.118–1.120 point to their docs (`set` at closing).

## 1. Goal

An orchestrator starts a worker for each task, parks it while its task waits long (a PR under
review) and resumes it with its context when the wait ends; a closed task's worker goes away from
the sidebar; experts hold several tasks, one in progress; a per-project cap bounds how many workers
run at once.

### What already exists (verified 2026-11-13)

- Tasks (plan 36): `task_add` (assignee required), `currentTask`, states with `waiting` and
  `waitingOn`, `taskTool` in `src/core/orchestration/tasks.ts`; tasks follow a new id.
- `start_session` (`startForAgent`, `src/main/workspace.ts`): name, prompt, model, loose, role;
  parents; `mayStart` (orchestrator only in the mode).
- Resuming a session in a tab: `start: { kind: 'resume', id }` (`src/core/command.ts:17`, used in
  `src/main/workspace.ts:1985`). Hanging up as closing a tab does, after the turn: `renew`'s path.
- Hiding: `hideMember` (`src/core/projects/model.ts:319`), refused while running.
- Settings: sections in `src/renderer/settings.ts` (`titles` at 489), grouped (Appearance, Work,
  Data, Integrations, System, decision 1.34).

## 2. The design

### 2.1 Per-task workers (1.118)

- `start_session` gains `task?` (a number): the session is named `<project>-t<N>` by Menkar (the
  project's name lowercased, spaces and other non `[a-z0-9]` characters to `-`, collapsed), and
  becomes the task's assignee. With `task`, `name` may be omitted; a given `name` must equal it.
- `task_add`'s `assignee` becomes optional: a task can be created first and its worker started
  with `start_session { task }`.

### 2.2 Parking and resuming (1.118, 1.120)

- `park_session { name }` — orchestrator only: the session's current task must be `waiting`; once
  the session's turn is over, Menkar hangs it up as closing its tab does (transcript kept). The
  session is **parked**: a mark in `projects.json` (`orchestration.parked`, ids), cleared on resume.
- `resume_session { name, prompt? }` — orchestrator only: resumes a parked (or any stopped) session
  of the project by name, in a tab after the orchestrator's, without taking the focus, with
  `kind: 'resume'`; the optional prompt is its first message ("the PR got this feedback: …"),
  passed as `start_session` passes one. Refused for a session with a tab.
- Team view: under the orchestrator, a folded "Parked · N" row; unfolded, each parked worker with
  what its task waits on.

### 2.3 Closing a task (1.120)

When the orchestrator closes a task (done or dropped), Menkar hangs up its assignee if it runs and
hides it **at once** — only when the assignee is a child of the orchestrator named
`<project>-t<N>` for that task's number. Experts, consultants and sessions the human started are
never touched.

### 2.4 Experts with several tasks (1.119)

- An assignee may hold several open tasks; **at most one `in progress`**: `task_steps` or
  `task_progress` (without `waiting_on`) on a second one while another is in progress is refused
  ("finish or wait on task N first").
- The skills carry the rest: the orchestrator gives an expert another task only while its current
  one waits on something outside, names the task in every message, gives no third; for parallel
  work in an area it starts a per-task worker that loads the expert's skill **read only**; only the
  named expert distills its skill, and a worker's lesson for it goes in its report.

### 2.5 The cap (1.118, 1.120)

- A per-project number, `orchestration.workers_cap` in `projects.json`; absent = unlimited.
- It counts the orchestrator's **running** children that are not experts (no role label) — parked
  and stopped ones don't count.
- At the cap, `start_session` and `resume_session` are refused: "This project runs at most N
  workers at once; N are running. Leave the task queued and start it when one finishes."
- **Settings → Work → Orchestration** (a new section in the Work group): one row per project with
  the mode on, a number field, empty = unlimited.

### 2.6 Rejected, and why

- **Fixed workers reused for every task** (b1/b2): a task waiting days on a PR blocks its worker or
  loses its context (the human, 2026-11-13).
- **Closing a waiting worker and starting a new one for the feedback:** the new one rebuilds the
  context the old one had.
- **Two sessions of one expert:** both would distill one skill file and diverge (1.119).
- **Names without the project:** cross-session messages go by name across the whole machine; two
  `t42` would collide.

### 2.7 Product decisions and the tests that hold them

| Decision | Test (before the code) | The case |
|---|---|---|
| Worker name from the task | `tests/core/orchestration/workers.test.ts`, pure `workerName(project, n)` | "Confidential AI", 42 → `confidential-ai-t42`; "menkar", 7 → `menkar-t7` |
| One in progress per assignee (1.119) | `tests/core/orchestration/tasks.test.ts` | task 1 in progress for X; `task_steps` on task 2 for X → refused; task 1 waiting → task 2 steps accepted |
| Park only a waiting task's worker | `workers.test.ts`, pure `mayPark` | current task in progress → refused; waiting → allowed; caller not orchestrator → refused |
| Cap counts running non-experts | `workers.test.ts`, pure `atCap` | cap 2; running W1, W2, expert E, parked W3 → at cap; W2 stops → not |
| Closing hides only the task's worker | `workers.test.ts`, pure `hideOnClose` | task 42, assignee `p-t42` child of O → hide; assignee `controlplane` → no; `p-t41` → no |
| Parked mark follows a new id, cleared on resume | `tests/core/projects/orchestration.test.ts` | X parked; X → Y: Y parked; resume Y → none |
| Tools named in skills exist | `tests/core/plugin.test.ts` | `park_session`, `resume_session` in `TOOL_NAMES` |

## 3. Out of scope

- Knowing by itself that a PR was merged or reviewed (an integration): the human tells the
  orchestrator.
- Moving old workers' transcripts to the trash: Claude Code's retention (the integration).
- Usage grouped by task.

## 4. Do not touch

- Sessions the human started, experts and consultants: never parked, hidden or counted by Menkar.
- `renew`, `last_reply`, read-only tabs, Mute.
- The human's running Menkar, `~/.config/menkar/`, `~/.claude`.

## 5. Execution blocks

Each block ends with `npm run ci` green; UI blocks run their spec, and the last runs `npm run
ui-check` whole. Screenshots by hand to `$MENKAR_FILES` with the worker's name first.

### Block 1 — names, one in progress, the cap in core
- [ ] Tests first (rows 1, 2, 4); `workerName`, `atCap`, the one-in-progress rule in `taskTool`.
- [ ] `start_session { task }` names and assigns; `task_add` without assignee.
- [ ] `workers_cap` in `projects.json` (lenient); the cap's refusal in `startForAgent`.
- **Verify:** `npm run ci`.

### Block 2 — parking, resuming, closing
- [ ] Tests first (rows 3, 5, 6).
- [ ] `park_session` and `resume_session` (`TOOL_NAMES`, `TOOLS`, `handleControl`), the `parked`
  mark, hang-up after the turn (renew's path), resume in a tab (`kind: 'resume'`), the cap on
  resume.
- [ ] `task_close` hangs up and hides the task's worker (`hideOnClose`).
- [ ] e2e with the stand-in claude: park after waiting → no tab, parked mark; resume with a prompt
  → a tab, the prompt delivered; close the task → hidden.
- **Verify:** `npm run ci`; the spec.

### Block 3 — Team view and Settings
- [ ] "Parked · N" folded row under the orchestrator in the Team view.
- [ ] Settings → Work → Orchestration: a cap row per project with the mode on; strings en/es.
- [ ] Spec and screenshots `‹name›-parked.png`, `‹name›-settings-cap.png`.
- **Verify:** `npm run ci`; the spec.

### Block 4 — skills, guide, documents
- [ ] Orchestrator skill: a worker per task (`start_session { task }`), park when a task will wait
  long, resume with what came back, the cap, experts with several tasks, the skill's one keeper.
  Worker skill: a worker that loads an expert's skill never edits or distills it; lessons go in
  the report. Guide: the same for the person. Skills under 200 lines (a reference file beside the
  orchestrator skill if needed).
- [ ] The exit's documents, with history.
- **Verify:** `npm run ci`; `npm run ui-check` whole.

## 6. Execution log

(Written by the session that executes it.)
