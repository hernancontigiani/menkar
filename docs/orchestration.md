# The orchestration mode

Decisions 1.77, 1.78, 1.83, 1.84, 1.86, 1.89–1.91, 1.93, 1.94 and 1.99–1.104 (the human, 2026-11-12),
and 1.112–1.116 (2026-11-13), the look chosen from mock-ups. A project can be switched into a mode
where the human talks to one orchestrator session, sees what waits on them and how far each
delegated task is, and sees the team in the sidebar ordered by role. Off, Menkar is as before and
the marks, topics and tasks wait. The guide for users and agents ships
in the plugin folder, `plugin/guide/orchestration-mode.md`.

## The data

- **Marks, per project in `projects.json`:** `orchestration` — on, the orchestrator, roles,
  "with you", `parked`, `workers_cap` (decision 1.118) and the added `folders` (decision 1.124) — and `topics_collapsed`,
  `consultants_collapsed`, `orchestrator_open`, `others_collapsed` and `done_today_open`,
  each written only while true. How they are read, kept and followed through a `/clear`, a
  resume or a session leaving is in `docs/projects.md` ("The orchestration mode's marks").
- **Topics, in `topics.json` in the config directory** (`topicsPath` in `src/core/paths.ts`;
  `src/core/orchestration/topics.ts`), a file of their own: agents write topics often, and a broken
  topics file must never move the projects aside. Version 1: `{ version, projects: { [projectId]:
  { next, topics } } }`. Read through `readJsonReport` (an unreadable file is moved aside, never
  deleted, with a notice), written whole through `writeJson`.
  - A topic: `number`, `title`, `context`, `from` (the raising session's id, shown by its current
    name), `blocking`, `status` (`open`, `discussing`, `closed`), `decision` once closed, `created`
    and `updated` (ISO, through `src/core/clock.ts`).
  - **Numbers are per project and never reused:** `next` is kept beside the list, and a file whose
    `next` fell behind a number in use reads it as that number plus one.
  - **A closed topic stays,** with its decision.
  - A topic may name the **`task`** it belongs to, by number (`topic_add`'s `task`, refused when
    the project has no such task).
  - **The order shown** (`shownTopics`), in the sidebar and in `topic_list` (decisions 1.100,
    1.114 and 1.169, which amend 1.77's): open and discussing only, the discussing one first (the
    current one, 1.169), then those of a ★ task, then blocking ones, then the rest by number, so
    the top topic is the one to take.
  - **`seen`**, written only once true: the human unfolded the topic or double-clicked it. A topic
    written before it reads as not seen.
- **Main keeps the topics** (`src/main/topics.ts`), loaded at start and written in the background on
  every change. The window state carries the shown project's topics in that order, `from` as a
  name (`TopicView`).
- **Tasks, in `tasks.json` in the config directory** (decision 1.113; `tasksPath`,
  `src/core/orchestration/tasks.ts`), a file of their own for the same reason as the topics, read
  and written the same way, version 1: `{ version, projects: { [projectId]: { next, tasks } } }`.
  - A task: `number` (per project, never reused, as topics), `title`, `assignee` (a session id,
    shown by its current name; absent until a worker is started for it, decision 1.118), `star`,
    `state`, `steps` (3 to 7 lines, empty while queued), `step`
    (1-based, 0 while queued), `note` (the latest report, one line), `waiting_on` while waiting
    and `waiting_note` beside it when given, `created`, `updated` and `closed` (ISO, through the
    clock).
  - **States:** `queued` (added) → `in progress` (steps set; step n of m) → `waiting` → `to
    review` (the assignee says it is done) → `done` or `dropped`, which only the orchestrator sets,
    after reviewing, so "done" always means reviewed.
  - **What a waiting task waits on** (decisions 1.197 and 1.199, the human, 2026-11-20 and
    2026-11-21; `parseWait` in `src/core/orchestration/tasks.ts`, `OUTSIDE_WAITS` in `taskState.ts`):
    `waiting_on` is "topic N" for an open topic of the project (written so, from "Topic #4" too), the
    name of one of its sessions, or an outside kind: `build`, `ci`, `release`, `pr-approval`,
    `pr-merge` or `other`. Free text goes only in `waiting_note`, one line beside it. Anything else
    is refused with a reply that names the accepted forms and says a wait on the human goes through
    `ask`, so it becomes a topic and shows in Awaiting you. A task card shows the kind's
    label and the note ("waiting on the build nightly"), as `review_wait` does. A value an older
    file holds is read as it is.
  - **Whom a task in To review waits on** (decision 1.164, the human, 2026-11-16):
    `review_wait: { on, note }`, present exactly while the task is `to review`. `on` is
    `orchestrator` (the default), `human`, `pr-approval` or `pr-merge`; `note` is one line beside
    it, such as the PR's number. The assignee says it with `task_review`; the orchestrator changes
    it after its own review, by calling `task_review` on the task in To review. A change stamps
    `updated` as any other does, so the flow metrics (deferred, 1.156) can read it later. A task an
    older file left in To review without it reads as waiting on the orchestrator.
  - **A session's current task** (`currentTask`): its task in progress or waiting, else its oldest
    queued one.
  - **One in progress per assignee** (decision 1.119): `task_steps`, or `task_progress` without
    `waiting_on`, on a task while the same assignee has another in progress is refused ("Finish or
    wait on task N first.").
  - **The ★ belongs to a task** (decision 1.114): a topic of a ★ task comes first, a row shows ★
    while its current task has it (`onStarredTask`), and its wakes reach the orchestrator first.
    The human sets it from a task's right-click (`setTaskStar`), the orchestrator at `task_add` or
    with `task_star` (decision 1.144), only when the human asks.
  - **Tasks follow a session to a new id** (`followTasks`): a `/clear`, a resume, a renew and a
    reused name move its tasks to the new id, wherever its mute follows.
  - **Done today** (`doneToday`, `closedTopicsToday`): tasks closed as done and topics closed since
    the local midnight before now, newest first; a closed topic's last change is its close.
- **Main keeps the tasks** (`src/main/tasks.ts`) as it keeps the topics. The window state carries
  the shown project's open tasks (★ first, then by number), those closed today and before, each
  session's current task (`TasksView`), and "Done today" (`DoneView`).
- **Agents reach them** through Menkar's MCP tools (`docs/session-control.md`): `topic_add`,
  `topic_update`, `topic_close`, `topic_list`, the task tools, the marks in `list_sessions`,
  and `start_session` refused to anyone but the orchestrator while the mode is on with one marked;
  `park_session`, `resume_session` and `set_workers_cap` for workers per task (below).

## Switching it, and the marks

- **The header's switch**, "Orchestration", right of Usage, for the project the window shows; **the
  project popover's team icon** per project, lit when on. Both are `setOrchestrationMode`.
- **The row menu**, only while the mode is on, after "Group ▸", in a block of its own: "Orchestrator"
  (marking one unmarks the previous), "Configure role…" (below) and "With you" — the first and the
  last with ✓ when set (`orchestrationItems`, `src/renderer/orchestration.ts`). The row menu has no
  "Priority": the ★ is a task's (decision 1.114).
- **"Configure role…"** (`roleWindow`; decisions 1.152, 1.154, 1.157, 2026-11-15; mock-up C) sets a
  session's role label and the skills Menkar stores for it (`docs/projects.md`), the only place
  that sets them: no tool does. "Configure role of ‹name›", then:
  - **Role**: one text field, trimmed; empty removes the label.
  - **Skills**: "‹n› chosen: ‹names›" beside the label, then one scrolling checklist with "Filter
    skills…" on top. **Not found** comes first, in red: a stored skill the session cannot load, its
    name struck through, "Not found in this project's or your skills" and **Remove**; it stays
    stored and flagged until removed, and the filter never hides it. Then at most two groups: the
    session's folder's skills, headed by the folder's name with `.claude/skills/`, and "Yours" with
    `~/.claude/skills/`. The filter hides rows whose name does not contain its text (case ignored)
    and any group left empty, and says "No skill matches." when none is left. The same name in
    both groups is one skill: ticking one ticks both, since what is stored is the name.
  - **Ticking adds a skill read only** and shows on its line the switch "Maintainer · Read only";
    unticking removes it. A skill another session maintains says "maintained by ‹name›" unticked,
    and once ticked "Maintained by ‹name›" in the warning colour, its Maintainer disabled: one
    maintainer per skill (1.119), and moving it means unsetting it on the other session first.
  - A legend says what Maintainer and Read only mean; **Save** applies the label and the skills in
    one `configureRole` action, **Cancel** and Escape change nothing.
  - **What is listed is what the session can load** (`roleSkills`, `src/main/workspace.ts`, from
    `listSkills`, `src/core/team/skills.ts`, read when the window opens): its folder's
    `.claude/skills/` and each parent's up to the repository root, and the user's. Another
    repository of the same project is not listed, since a session cannot load it; a skill stored
    from there shows under Not found. **Menkar's own skills never show**: they follow from the
    marks. Installed plugins' and MCP servers' skills are not listed: every session has them, and
    nobody in the team maintains them, so the list stays a project's ten or so.
  - **After Save** the skills the session can load are found again (`teamFoundChanged`,
    `src/main/team.ts`) and, if it runs and its facts changed, it gets one team update
    (`docs/session-control.md`, "The team block").
- **The mode switched while sessions run**: on, each running Claude session of the project gets its
  whole team block in one post; off, one line saying the instructions no longer apply
  (`docs/session-control.md`, "The team block").
- **The first-time card** (`firstTimeCard`): switching on a project with no orchestrator marked opens
  it instead. It says what the mode is and what an orchestrator is, and asks "Who orchestrates?":
  one radio per listed session (with a tab first, then by name) and "A new session" (a name,
  "orchestrator" by default, and a folder among the project's folders — the list `Ctrl+\``
  offers — or, with none, the recent folders Add session offers).
  - **With two or more agents installed** (decision 1.155 Q2; the human chose mock-up A on
    2026-11-20): an "Agent" line under the new session's name and folder, Add session's picker,
    defaulting to the agent last started (`last_agent`, which starting the new orchestrator
    writes, so the next card defaults to it); an agent not installed is greyed with its tooltip,
    and so would be one whose sessions can't use Menkar's tools (`caps.tools`; all four can).
    Each listed session names its agent, dim, beside its name. With one agent the card has
    neither.
  - **An agent with limits** (the descriptor's `teamLimits`; Cursor's: waking it when idle
    restarts it, and it asks before each tool not allowed) is said so under what chose it, never
    forbidden: under the choices when it is picked to orchestrate, under "Sessions the
    orchestrator manages" for each checked session of it.
  - **Start** switches the mode on first, so a new orchestrator starts with its team block and a
    running session chosen hears of the whole change in one post (`startTeam`); then it marks the
    chosen session, or starts the new one, of the agent chosen, through `startNew` with its
    agent's first prompt (`docs/agents.md`, "Codex as the orchestrator") telling it to
    load `menkar:orchestrator`, that the project's orchestration is new, and to read the guide at
    its absolute path first (2026-11-13), marked as it starts; then it hands the chosen sessions
    over and saves the cap. A refused start switches the mode back off and shows the refusal.
    **Not now** leaves it off.
  - **Open the guide** opens `plugin/guide/orchestration-mode.md` in a Menkar file tab, read only
    (files under the plugin folder get `files.readOnlyMenkar` from the file check), and hides the
    card (decision 1.94, mock G1). Closing that tab brings the card back with what had been chosen
    — the radio, the new session's name and folder — kept per window, in memory; the mode does not
    move until Start or Not now. Like any Markdown tab, the guide's has "Ask an agent"
    (`docs/files.md`).
  - **Copy a prompt for another session** copies a prompt naming the guide's absolute path. No
    external link: the app opens no URL of its own.

## The sidebar in the mode

**One view** while the mode is on (decision 1.177, the human, 2026-11-17, from task 60's mock-ups;
it replaced the Work | Team switch of 1.112 and 1.115). Off, the sidebar is the ordinary one. From
the top:

- **Fixed**, `#topics-section` (`modeTop`, `src/renderer/work.ts`): the count tiles, then Awaiting
  you; it stays in view however far the list below is scrolled.
- **Scrolling**, `#session-list`: the team, the "N hidden" foot, Done today.

**No Tasks list** (decision 1.198, the human, 2026-11-21): the tasks are on the Board, open by
default; in the sidebar a task shows only on its session's row (below).

1. **Count tiles**: "for you" (the open topics and the PRs waiting on the human, the rows of
   Awaiting you), tasks in progress ("working") and tasks waiting, counted by `workCounts`
   (`src/core/orchestration/counts.ts`), which also gives the tail of every post to the
   orchestrator (below).
2. **Awaiting you**: the Topics section below.
3. **The team**, below: the orchestrator and the sessions under it, Consultants, Others.
4. **"N hidden"**, the foot that shows the hidden rows, after Others (decision 1.176, D4).
5. **Done today · N**: topics closed and tasks done since local midnight, newest first; **folded
   by default**, its unfolding saved (`done_today_open`).

**Every post Menkar sends to the orchestrator** (decision 1.125, the human, 2026-11-14) ends,
after its time, with the tiles' three numbers: `[Menkar] packager set task 4 to review: PR open
(08:47:33) · 2 for you · 1 working · 1 waiting`. **They are three kinds only** (decisions 1.178,
the human, 2026-11-17, and 1.186, the human, 2026-11-19): every post is a line in the human's chat
with the orchestrator, so it is posted to when a task is set to review, when a session asks it
something and when the human wants to discuss a topic; everything else — a turn ended without a
report, a permission prompt, the rest of the human's own news — waits in its inbox and reaches it
with its next prompt, off the human's screen (`docs/session-control.md`, the
orchestrator's wakes and its inbox). The human follows the orchestrator from a phone through Remote Control, where
the statusline does not show and the posts do. `postCounts` gives them only for the orchestrator of
a project with the mode on, from the same `workCounts` as the tiles; posts to any other session are
unchanged.

**The team**: `modeRows` (`src/core/orchestration/rows.ts`) orders the rows; `renderSessionList`
draws them while the shown project's mode is on, and the ordinary list otherwise, through the same
code as before.

**Four profiles** (decision 1.107, the human, 2026-11-13), read from the marks with no mark of their
own: the **orchestrator**; an **expert**, a session under the orchestrator with a role label, shown
nested under it with its label; a **generalist** worker, under it without a label; a
**consultant**, a loose session with a label, under "Consultants".

**Three folds, each saved per project** (decision 1.171, the human, 2026-11-16), a triangle each:

- **The orchestrator's group** (`orchestrator_open`, written only while unfolded: **folded by
  default**, decision 1.177): the triangle sits on the orchestrator's
  row, in its left padding, while anyone is under it. Folded, every child is hidden — running,
  earlier and parked alike — and the row shows how many sessions are under it and the dot of the
  most urgent state among those running (`groupState`, as a collapsed group's), red when one waits
  at a permission prompt; with none running, the stopped dot. The count and the dot follow its
  name (1.171; the human's pick, 2026-11-17).
- **Consultants** (`consultants_collapsed`) and **Others**
  (`others_collapsed`): folded, the heading alone.

1. **The orchestrator**, then its running children, in the background or not, indented; its
   children not running fold
   into one "N earlier" row a click unfolds (per window, not saved). Its parked workers fold apart,
   after it, into a "Parked · N" row; unfolded (per window, not saved), each parked worker with
   "waiting on …" from its current task, else from its task in To review (decisions 1.120, 1.164;
   `modeRows`).
2. **"Consultants"**: every session with a role label that is not the orchestrator and not
   nested, each with its own children as in 1.
3. **"Others"**: the rest, one flat list in the project's order with no group headings (decision
   1.183, the human, 2026-11-18); the groups are kept for the mode off, and a drag still reorders
   a row only within its group.

A child sits under the top row of its line of parents, wherever that row is, at one level of indent.
Rows of parts 1 and 2 and nested rows are not dragged. Hidden rows and earlier conversations stay
out. A row shows its role label where the folder goes (the orchestrator without a label of its own
is labelled "Orchestrator"), the ★ before its name while its current task has it, and "with you"
as a badge after it. Under its name, its current task and step ("Release 0.2 · 3/5", or the state
while it has no steps; decision 1.116).

**A worker's row says where its tab is** (decision 1.176, from task 59's mock-ups; `rowWeight` in
`rows.ts`): its name **bold with a pin mark** while it has an ordinary tab in the strip (pinned),
regular while it runs in the background, *italic* and regular while it is in the peek, and regular
when it is not running. "A worker" here is a session that may go to the background
(`backgroundable`, `src/core/orchestration/team.ts`): every other row is drawn as before. A click on
a worker's row shows it in the peek; a double-click, or ⋮ Open, pins it as an ordinary tab. How the
peek and the background work is `docs/window.md`'s "Background workers and the peek tab".

**No group line on a session tab** (decision 1.183, the human, 2026-11-18; `tabGroupColor` in
`src/core/projects/orchestration.ts`): with the mode on, a tab is not underlined in its group's
colour; with it off, it is.

**The Topics section** sits after the tiles, collapsible like Files
and saved (`topics_collapsed`), headed "Awaiting you · N", so it says whose turn it is (1.146, the
human, 2026-11-14: only the label the user sees; "topic" stays the thing's name for agents, tools and
code). **After the topics, a row for each task in To review waiting on `pr-approval` or `pr-merge`**
(decision 1.197, the human, 2026-11-20; `awaitingRows` in `src/core/orchestration/rows.ts`), in the
tasks' order: ★, the PR its `review_wait` note names ("PR #436 · approve", "PR #436 · merge";
`prNamed` reads `#436`, `436`, `PR #436` or a pull request's URL, any other note shown as written)
and the assignee; a click selects the assignee, as a task card does. The heading's N counts both
kinds, as the "for you" tile does. A topic row: ★ when its task has the ★, the
number, the title, a green dot while it is discussing (the current topic, decision 1.169, the
human, 2026-11-16) and a red mark when blocking; a blocking topic being discussed shows both. A click unfolds its context, who raised it and its
status, per window. Empty, it says "Nothing awaits you".
**At most 5 rows** (`TOPICS_SHOWN`, `topicsFolded` in `src/core/orchestration/rows.ts`; decision
1.171, the human, 2026-11-16), then a "N more…" row as Files has; a click unfolds
the rest, per window, not saved. The current topic comes first in the order, so it is always among
the 5.

**A double-click on a topic** (decision 1.96, 2026-11-12) sets it to "discussing", selects the
orchestrator's tab and wakes the orchestrator (decision 1.186, the human, 2026-11-19): "The human
wants to discuss topic N" is posted through the wakes' messaging, so it takes the topic up without
waiting for the human's next prompt; nothing is typed into its terminal. An orchestrator that
cannot be woken (its tab closed, or an agent with no waker) is told through its inbox instead, when
it has one; a post that cannot be delivered falls back to the inbox too (`discussTopic` in
`src/main/workspace.ts`).

## The Board

Decisions 1.112, 1.116 and 1.126 (the human, 2026-11-14, from mock-ups). **A panel, not a tab**
(`src/renderer/board.ts`), between the header and the tab strip, across the right-hand area and
never over the sidebar. The header's **Board** button, right of the Orchestration switch and shown
only while the mode is on, toggles it, light blue (`aria-pressed`) while it is open; the × in its
bar closes it the same way.

- **Open by default** (decision 1.198, the human, 2026-11-21): when the mode is turned on and
  whenever a project in the mode is shown, unless the human closed it in that project, which is
  saved per project.

- **Its height.** By default, two cards per column: the bar, a heading and two cards with their
  gaps (`defaultBoardHeight`, `src/core/orchestration/board.ts`), measured from the real heading
  and a hidden probe card at a real column's width, never a share of the window. The probe is a
  full card (decision 1.132, the human, 2026-11-14): a title clamped to two lines, the assignee
  with its dot, the step bar and a one-line note, so two real cards fit. It stays one fixed height
  for the layout, not measured from the cards on show. A divider under it resizes it. "Show all"
  grows it to fit the tallest column, at most 70 % of the right-hand area (`showAllHeight`);
  "Default size" goes back. A column with more cards than fit scrolls under its fixed heading; the
  columns keep a minimum width (160 px) and the panel scrolls sideways when they don't fit.
- **The drawer keeps its height** (the human, 2026-11-14): the Board's room comes from the agent's
  pane only. Its height is capped so the pane keeps six rows under it with the drawer shown
  (`boardCap`), and the drawer's default height is a share of the tab's area as if the Board were
  closed, so opening it never changes the drawer.
- **Saved per project** in `projects.json` (`board_open: false` once closed, `board_height`;
  `docs/projects.md`): it reopens as it was after a restart. The last height is the one dragged or picked, Show all
  included as the pixels it came to; Default size removes it.
- **Switching the mode off hides it** (it shows only while the mode is on) and forgets that it was
  closed (`setMode` clears `board_open`), so turning the mode on again opens it.
- A Board tab an earlier version saved in the layout (`{ board: true }`) is dropped on read.

Columns (`boardElement`, `src/renderer/work.ts`): **Topics** (the open ones, in their order) ·
**Queued** · **In progress** · **Waiting** · **To review** · **Done**: today's closed tasks, newest
first, and the older ones folded under "Done before · N" (per window, not saved); a dropped task is
struck through. A task card: its number, ★, title, the assignee with its state dot, `3/5` and the
step segments, the note. The note line starts with what the task waits on, "waiting on ‹what›",
with a red edge while waiting: a waiting task's `waiting_on`, and a task in To review's
`review_wait` unless it waits on the orchestrator ("waiting on PR approval #436 · PR open",
decision 1.164). A click selects the
assignee's tab; the right-click sets the ★; nothing else is edited there.
A card's title, topic or task, is clamped to two lines with an ellipsis and whole in its tooltip,
so no card outgrows the probe (decision 1.145, the human, 2026-11-14).
A done task shows `N/N` and every segment done, whatever step its worker last reported; a dropped
one keeps the step it stopped at (decision 1.128, 2026-11-14).

## `Ctrl+\`` in the orchestrator's tab

With the mode on and the selected tab running the orchestrator, a `Ctrl+\`` that would open the
drawer first gathers the project's folders (below). With one, the drawer opens there at once, as
anywhere else. With several, a list (`folderPicker`, `src/renderer/switcher.ts`) shows them by the
folder's last name with the path as caption, the one last chosen (per window and project, in
memory) preselected; Enter opens the drawer there (`toggleDrawer`'s `folder`). A shown drawer is
hidden as always, with no list.

## A project's folders

Decision 1.124 (the human, 2026-11-14): **the folders of all its sessions, running or not, earlier
conversations included** (each session's `cwd`; a session just started, with no transcript yet,
takes its pane's folder), **plus the folders the human adds by hand**, each once, the sessions'
own by path and the added ones after them (`membersFolders`, `projectFolders`,
`src/core/orchestration/folders.ts`; `foldersOfProject` in main, `projectFolderList` in the
renderer, both through it).

- **Added folders** are the project's `folders` in `projects.json` (`docs/projects.md`), edited in
  the project's orchestration settings dialog: a "Folders" list of every folder of the project, the
  sessions' own marked "from its sessions" and not removable, an added one with a remove button,
  and "Add folder…" through the system's folder chooser (main's `pickFolder`). Adding and removing
  apply at once, not on Save. An added folder a session already works in is shown once, as the
  session's.
- **`start_session { folder }`** starts the new session there: accepted only when it is one of the
  project's folders and exists on disk, refused otherwise with a sentence listing the project's
  folders (`startFolder`; `docs/session-control.md`).
- **`Ctrl+\``** in the orchestrator's tab (above) and **the first-time card** offer the same list
  without the folders gone from disk (`presentFolders`); the settings' list keeps those, marked
  "missing", so the human sees why. Main checks the disk off the UI path whenever it sends the
  windows their state, one check at a time (`checkFolders`, `missingFolders`), and sends the gone
  ones as the state's `missingFolders`; a folder that cannot be read counts as there.
- A plan touching several repositories becomes one task per session and folder.

**One shell per folder** (decision 1.93, the human, 2026-11-12): in that tab each folder picked keeps
a drawer of its own (`DrawerRegistry`, `src/core/drawers.ts`). Picking a folder shows its drawer,
starting it the first time, and hides the one shown; the others stay alive and hidden, and no pick
hangs one up. Closing the tab hangs them all up, as closing a tab hangs up its drawer. Every other
tab keeps one drawer.

## Notifications in the mode

Decisions 1.99, 1.103 and 1.104 (the human, 2026-11-12). The human hears what is theirs: the
orchestrator, the sessions working with them, the loose ones, and the topics.

- **Who notifies** (`notifiesFor`, `src/core/orchestration/notifies.ts`, asked by main's `notify`
  first): a session muted by hand never does, in any mode; with the mode off, every other one does
  as before; with it on, a session **under the orchestrator** (its parent is the orchestrator) does
  not, unless it is marked "with you". The orchestrator and loose sessions notify as before: nothing
  else would tell the human about a loose one. Only the alerts go quiet (sound, toast, desktop
  notice): the dots, the blocked counts and the dropdown's badge still count every session.
- **Mute** ("Mute" / "Unmute" in every row menu, in any mode): `muted` in `state.json`
  (`src/core/mute.ts`, `docs/sessions.md`); the row shows a struck-through speaker after the name,
  drawn like the phone, 9×13 in the text color.
- **A new topic** notifies as a blocked session does, through the same settings: "Topic N" and its
  title, as a toast in the focused window that shows the project, or a desktop notice otherwise.
  While a topic of the project is "discussing", a new one makes no sound; it still shows. A change
  notifies only when a topic **becomes blocking** (`topicNotice`, raised from `topic_add` and
  `topic_update` in `src/main/workspace.ts`), and only while the mode is on: off, the Topics
  section is not shown, so a notice would lead nowhere. Menkar raises topics, not the orchestrator,
  so muting the orchestrator never mutes them.
- **Show** (the toast's button, or a click on the desktop notice) shows the orchestrator's tab — the
  waiting session's, for Menkar's permission topic —, opens the Topics section if it was collapsed
  and unfolds the topic.
- **The dock's count** is the desktop's own count of Menkar's open desktop notices; Menkar sets no
  badge. A topic's desktop notice goes in the same tray as the agents' (`NotificationTray`), under
  its project and number, and seeing the topic — unfolding it or double-clicking it — closes it
  (`set`, 2026-11-12, correcting the plan, which assumed a badge Menkar does not set). A topic
  shown as a toast stays out of the count, as an agent's toast does. `unseenTopics` counts the open
  topics not seen, of every project.
- **A topic's notice also leaves the tray** when the topic is closed before the human saw it, when its
  project leaves the mode, and when the project is deleted: after every change, main closes each
  topic notice whose topic is no longer open, unseen and in a project in the mode
  (`closeStaleTopicNotices`, `src/core/orchestration/notices.ts`). Without it, a topic closed by
  `topic_close` left the dock at "(1)" with nothing to clear it (the human, on a real desktop,
  2026-11-12).

## Read-only tabs

Decision 1.101 (the human, 2026-11-12). While the mode is on, the tab of a session **under the
orchestrator** and not "with you" is read only: the orchestrator gives it its work, and keys typed
there would cross its instructions (`readOnly` and `bannerOf`, `src/core/orchestration/readonly.ts`).

- **The window keeps the user's input out** (`src/renderer/terminals.ts`): keys through the custom
  key handler, keydown and keypress alike, past the app's shortcuts and the view's own (copy, find,
  the end); pastes (Ctrl+Shift+V, the menu's Paste, greyed, any paste event) and drops; typing
  through an input method. **The terminal's own replies still go out**: Claude Code queries its
  terminal (the cursor's position, colors, the keyboard protocol, focus), and a swallowed answer
  could hang or garble a session, worst at a resume that starts read only (`set`, 2026-11-12).
  Scrolling, selecting and copying work. Drawers are never read only.
- **Main refuses what Menkar sends for a key** in a read-only pane (`pty:typed`, `paneTyped` in
  `src/main/workspace.ts`: Shift+Enter's newline, a passed-on Ctrl+B); the terminal's own input
  (`pty:input`) passes.
- **A yellow banner** across the top of the pane, a fixed amber with dark text in every look and
  scheme so it stands out (the human, through `set`, 2026-11-12): "This session reports to the
  orchestrator.", with
  "Take control", which marks it "with you", makes it writable and tells the orchestrator "The
  human took control of ‹name›".
- **"With you"**, the banner is blue (the theme's ANSI blue, the role `blue`): "This session is
  with you.", with "Back to reporting to the orchestrator", which clears the mark, makes it read only again
  and tells it "The human handed ‹name› back". Both go to the orchestrator's inbox (decision
  1.178; posted through the wakes' messaging to one whose agent has none); nothing is typed.
- **At a permission prompt** (shown state `blocked`) the tab is writable while it waits; the banner
  stays yellow and says "Waiting for your permission".
- Loose sessions and the orchestrator have no banner and stay writable; with the mode off, nothing
  is read only.

## Handing sessions to the orchestrator

Decision 1.102 (the human, 2026-11-12). A session comes under the orchestrator — becomes its child —
in three ways; nothing restarts and nothing is typed, only who is woken changes (and so its tab
turns read only):

- **The row menu**, in the mode, for any session but the orchestrator, after "With you": "Report to
  the orchestrator" (its parent becomes the orchestrator), or, for one under it, "Stop reporting to
  the orchestrator" (`clearParent`, `src/core/projects/parents.ts`). Both are `setManaged`. The four
  texts share one vocabulary (decision 1.111): these two, the yellow banner's "This session reports
  to the orchestrator." and the blue one's "Back to reporting to the orchestrator".
- **The first-time card**: under "Who orchestrates?", "Sessions the orchestrator manages", a box per
  listed session, all checked; the one chosen to orchestrate is not listed. Start sets the checked
  ones' parent to the orchestrator, a new one once it is marked; unchecked ones stay as they were.
- **`adopt_session { name }`**, a Menkar MCP tool (`adopt`, `src/core/orchestration/adopt.ts`): the
  orchestrator makes a session of its project its child. Refused to any other caller and with the
  mode off. The orchestrator's skill calls it only when the human asks for it explicitly.
- **Born loose, or with a role** (decision 1.111): `start_session` with `loose: true` records no
  parent, so the new session is a consultant (1.107): no wakes to its caller, no read-only tab. With
  `role` it is born with that label (`placeStarted`, `src/core/orchestration/started.ts`); a loose
  one with a label sits under "Consultants". No tool changes an existing session's role: that stays
  the human's, from the row menu's "Configure role…".

## Workers per task

Decisions 1.118–1.123 (the human, 2026-11-13). The orchestrator starts a new generalist worker for
each task, parks it while its task waits long, resumes it with its context, and the worker goes
away when its task closes. Pure rules in `src/core/orchestration/workers.ts`; main applies them.

- **Who is a worker** (`isWorker`): with the mode on, a child of the orchestrator with no role
  label, whoever started it — the sessions handed in with the first-time card or "Report to the
  orchestrator" included (1.162). Experts (a label) and consultants (loose) are never parked,
  counted or hidden by Menkar; at setup the orchestrator goes through each handed-in session with
  the human, who gives it a role or keeps it a worker.
- **Its name** (`workerName`): `start_session { task }` names the session `<project>-t<N>` — the
  project's name lowercased, every run of other characters one dash — and assigns it the task
  (`assignTask`). Names are unique across the machine, so the project is in them. A given name must
  be that one; a task assigned to another session, open or parked, or closed, is refused
  (`untakenRefusal`): moving it would lose the context its session keeps. `task_add` may leave the
  assignee out for this.
- **Parking** (`park_session`, `mayPark`): only the orchestrator, for a worker whose current task
  is waiting, or whose task is in To review waiting on a PR (`pr-approval` or `pr-merge`,
  `parkingTask`; decision 1.164); one waiting on the orchestrator or the human is refused. Once its
  turn is over (its shown state idle or done, or the Stop hook's record)
  Menkar stops it as Stop does, never mid-turn and never by typing, and
  marks it `parked` in `projects.json`. The mark follows a new id and leaves with the member.
- **Resuming** (`resume_session`): only the orchestrator, a parked or stopped Claude Code session of
  the project, by name, not one running. A worker in the background (decision 1.176), any other
  session in a tab after the orchestrator's; without the focus,
  `--resume` of the same id, the optional prompt as its first message (as `start_session` passes
  one). The parked mark goes, and the row shows again.
- **Closing a task** (`task_close`, `hideOnClose`): the worker started for that task — the
  orchestrator's child, no role, named for that task's number — is stopped after its turn and
  hidden at once. Any other assignee is left as it is.
- **The cap** (`workers_cap`, `atCap`, `capRefusal`): a whole number from 1 per project, absent for
  any number. It counts the running workers, in the background too: closing a worker's tab sends it
  to the background and frees no slot; parked and stopped ones have no tab and don't count. A
  `start_session` or `resume_session` of a session that would count is refused at the cap; starting
  an expert or a consultant is not.
- **Where the cap is set**: the first-time card's "Workers at once" (decision 1.121; empty by
  default, saved on Start), the project's orchestration settings dialog (decision 1.122: a gear
  beside the project's mode icon in the project popover, shown only while its mode is on; the cap
  first), and
  `set_workers_cap` (decision 1.123: only the orchestrator, in the mode, only when the human asks).
  Orchestration settings belong to the project, so Settings has no Orchestration section.
- **Experts with several tasks** (decision 1.119): one in progress, enforced by the task tools; the
  rest — another task only while the current one waits outside, never a third, a skill's one
  maintainer — is the orchestrator's and the worker's skills.

## The human's presence

Decisions 1.165, 1.167 and 1.170 (the human, 2026-11-16). The human sets themselves **away** when
they step out; the state is the user's own, for the whole app, and concerns the orchestrators only.
What the user sees and how the orchestrator acts on it is in the guide; the rules are pure, in
`src/core/presence.ts`, and main holds the state (`askPresence`, `src/main/workspace.ts`).

- **Held in memory, never saved**: every start is "here", so opening Menkar counts as returning.
  Going away twice keeps the first time (`since`, shown as "Away since HH:MM", `formatClock`).
- **Set away only while some project has the mode on** (`presenceAsked`); coming back always works.
  The chip at the sidebar's foot (`chipShown`) shows while some project has the mode on, and also
  while away, so it can always be cleared if the modes were turned off meanwhile.
- **Three ways in**, all through `askPresence`: the chip, `Ctrl+B a` (`setPresence` with no value
  toggles) and the banner's "I'm back"; and `human_back`, the orchestrator's tool
  (`docs/session-control.md`). The window state carries `presence`; every window draws the banner
  under its header and the chip from it.
  Its mirror `human_away` comes here too (decision 1.181).
- **The orchestrators hear it** (decision 1.178): a change puts "The human is away: …" or "The human
  is back" (`presencePost`) in each mode-on project's orchestrator's inbox, the later replacing the
  earlier, so it reaches the orchestrator with its next prompt — the human's own, when they are
  back; the orchestrator that called `human_back` or `human_away` has it taken out instead. An
  orchestrator whose agent has no inbox is posted to through `wakeSession` while it runs
  (`postRecipients`). Each change is journaled too, `away` or `back` (`recordPresence`,
  `docs/usage.md`).
- **A session at a permission prompt** (decisions 1.178, and topic 54's answers, the human,
  2026-11-18): a session under the orchestrator, not "with you", whose tab is not in view, wakes
  nobody; Menkar raises a blocking topic "‹name› is waiting at a permission prompt" (context
  "Answer it in its tab. Menkar closes this topic once it is answered."), shown in the user's
  language, notified as a new topic is, and closes it 3 s after the prompt is answered, so a chain
  of prompts is one topic. It is kept out of Done today, and its Show leads to the waiting
  session's tab while it runs. With its tab in view the human answers it there and no topic is
  raised. (`docs/session-control.md`, the orchestrator's wakes and its inbox.)
- **Topics while away** (`topicNoticeNow`): a topic notice raises nothing — no sound, toast,
  desktop notice or tray entry — and nothing is replayed on return; the topic waits in Topics.
  The sessions' own notifications are not silenced.
- **Used while away, Menkar asks** (decision 1.188, the human, 2026-11-19, topics 68 and 70).
  Nothing clears away by itself: not activity, not a timer, not Not yet (1.167). The window
  marks (`activity:present`, `docs/usage.md`) also reach `noticeActivity`, before the journal's
  minute across windows, so every window's mark counts; `noticed` turns `asking` on, except within
  `ASK_AFTER_MS` (60 s) of going away — activity on the way out asks nothing — and a clock set back
  asks at once. While `asking`, the banner (`.away-banner.asking`) reads "**You're using Menkar —
  are you back?** · Away since HH:MM", a stronger amber, with "Not yet" and a filled "I'm back";
  the chip is unchanged. The state is main's, so every main window asks at
  once whichever window the activity came from, and an answer in one is every window's; the Usage
  and Settings windows send no marks.
  - **Not yet** (`notYet`, action `presenceNotYet`) puts the question away, still away.
  - **A question nobody answers** goes back by itself after `BURST_GAP_SECONDS` (10 min) without
    a mark (`quieted`, a timer main arms at `quietDue`).
  - Either way it comes back only on activity after 10 quiet minutes (`resting`, `lastActive`):
    steady use after Not yet asks nothing more. A new away starts not asking; back clears it all.
  - It does not reach the orchestrator: its prompt carries only that the human is away
    (`docs/session-control.md`, the inbox).

## Rejected

- **Clearing away on activity, or after a while of it** (1.188, 1.167): away ends only by the
  human.
- **Back-dating "I'm back" to the first activity**: a back the human did not give, written into
  the usage journal; and the question comes within seconds of using Menkar.
- **Telling the orchestrator that Menkar saw activity**: not in 1.188; the orchestrator would act
  on a guess the human did not confirm.
- **Each window deciding to ask on its own**: two windows would disagree, and a window opened
  later would not ask.
- **A modal or a toast for the question**: the strip is where away already lives (1.167); a modal
  would take a key meant for a terminal.

- **A Team/Work switch with one default** (1.177): background workers must be found without
  knowing a second view exists.
- **The folded count in the orchestrator's role line**: the human picked it after the name
  (2026-11-17).
- **A panel beside the orchestrator's tab** (1.77's first form): it repeated the team the sidebar
  already shows and took width from the terminal; the human chose the sidebar section (1.89).
- **Answering a topic from the Topics section**: the discussion stays in the orchestrator's chat,
  where voice works (1.86).
- **"With you" known by itself** (typing in the pane, a timer): the human chose a manual toggle
  (1.86); a prompt sent from the phone would not be seen anyway.
- **Topics inside `projects.json`**: agents write them often; a broken file would take the projects
  with it.
- **Fixed roles** (Expert, Consultant, Reviewer, Worker): a free label (1.83).
- **An external link in the card**: no site exists yet; the app opens no URL of its own.
- **Blocked events before finished ones in a wake**: not decided; only ★ tasks first (1.114).
- **A ★ on sessions** (1.78's first form): urgency belongs to the work, not to who does it (1.114).
- **A time-based progress bar** for tasks: nobody knows how long a task takes; steps done over
  steps planned says where it is (the human, 2026-11-13).
- **The assignee marking its own task done**: "Done today" would mean unreviewed (1.113).
- **A separate "Waiting on you" section**: everything waiting on the human is a topic (1.115).
- **Reported states** (`set_waiting`): in the mode a worker waits only on the orchestrator, and the
  human's questions go as topics (`docs/NOT_BUILT_YET.md`).
- **Muting loose sessions in the mode** (1.99's first form): nothing would ever tell the human about
  them (1.104).
- **Muting topics with the orchestrator**: the human would lose what waits on them.
- **Read only by hiding the terminal**: the human must still watch the session work.
- **A badge Menkar sets on the dock** for unseen topics: the desktop already counts Menkar's
  notices, and a second count would add to it.
- **Fixed workers reused for every task** (b1/b2): a task waiting days on a PR blocks its worker or
  loses its context (the human, 2026-11-13).
- **Closing a waiting worker and starting a new one for the feedback**: the new one rebuilds the
  context the old one had.
- **Two sessions of one expert**: both would distill one skill file and diverge (1.119).
- **Worker names without the project**: cross-session messages go by name across the machine; two
  `t42` would collide.
- **An Orchestration section in Settings** (1.120's first form): orchestration settings belong to
  the project, not the app (1.122).
- **Listing installed plugins' and MCP servers' skills in "Configure role…"** (1.154): every
  session has them, and nobody in the team maintains them.
- **Showing Menkar's own skills there** (1.154): they follow from the marks; storing one would let
  a session be told to load `menkar:orchestrator` without being the orchestrator.
- **Other repositories' skills shown disabled there** (1.157, Q5 (a)): the human chose to show only
  what the session can load.
- **Skills set by `start_session` or `specialize`**: only the human sets them (1.152); an agent that
  wrote a wrong name would mis-role a session silently.
