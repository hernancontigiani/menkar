# History of `docs/orchestration.md`

## The sidebar in the mode

> Left on 2026-11-12: a double-click on a topic sets it to discussing and tells the orchestrator (decision 1.96).
the number, the title, a red mark when blocking. A click unfolds its context, who raised it and its
status, per window. It is read only. Empty, it says "No open topics".

## The orchestration mode

> Left on 2026-11-12: plan 35 adds decisions 1.99–1.104.
Decisions 1.77, 1.78, 1.83, 1.84, 1.86, 1.89–1.91, 1.93 and 1.94 (the human, 2026-11-12; the look chosen from

## The data

> Left on 2026-11-12: decision 1.100: blocking topics come right after the ★ ones.
  - **The order shown** (`shownTopics`), in the sidebar and in `topic_list`: open and discussing
    only, those raised by a ★ session first, then by number. A blocking topic is marked, not moved.

## Read-only tabs

> Left on 2026-11-12: main no longer drops a read-only pane's input, so the terminal's replies to the agent's queries arrive; the window keeps the user's input out (`set`).
- **Main drops its input** (`paneInput`, `src/main/workspace.ts`): a paste, a key or anything else
  sent to that pane never reaches the agent. The window also skips what xterm would send there
  (`setPaneBanner`, `src/renderer/terminals.ts`), so the app's shortcuts still work. Scrolling,
  selecting and copying work. Drawers share the input path and are never read only.

## Read-only tabs

> Left on 2026-11-12: the yellow banner became a fixed amber with dark text.
- **A yellow banner** across the top of the pane: "This session reports to the orchestrator.", with

## The sidebar in the mode

> Left on 2026-11-13: the heading became "Consultants" (decision 1.107).
2. **"Experts and consultants"**: every session with a role label that is not the orchestrator and
   not nested, each with its own children as in 1.

## Read-only tabs

> Left on 2026-11-13: the blue banner's button became "Back to reporting to the orchestrator" (decision 1.111).
  with you.", with "Hand back to the orchestrator", which clears the mark, makes it read only again

## Handing sessions to the orchestrator

> Left on 2026-11-13: the row menu's two items were renamed (decision 1.111).
- **The row menu**, in the mode, for any session but the orchestrator, after "With you": "Hand to
  the orchestrator" (its parent becomes the orchestrator), or, for one under it, "Take back from the
  orchestrator" (`clearParent`, `src/core/projects/parents.ts`). Both are `setManaged`.

## The orchestration mode

> Left on 2026-11-13: the mode gained tasks, the Work view and the Board (decisions 1.112–1.116).
Decisions 1.77, 1.78, 1.83, 1.84, 1.86, 1.89–1.91, 1.93, 1.94 and 1.99–1.104 (the human, 2026-11-12; the look chosen from
mock-ups). A project can be switched into a mode where the human talks to one orchestrator
session, sees the team in the sidebar ordered by role, and sees the open topics the orchestrator
keeps for them. Off, Menkar is as before and the marks wait.

## The data

> Left on 2026-11-13: the ★ moved from sessions to tasks (decision 1.114).
- **Marks, per project in `projects.json`:** `orchestration` — on, the orchestrator, roles, ★,
  "with you" — and `topics_collapsed`.

## The data

> Left on 2026-11-13: the ★ moved from sessions to tasks (decision 1.114).
  - **The order shown** (`shownTopics`), in the sidebar and in `topic_list` (decision 1.100, which
    amends 1.77's): open and discussing only, those raised by a ★ session first, then blocking ones,
    then the rest by number, so the top topic is the one to take.

## The data

> Left on 2026-11-13: tasks joined the topics as data agents reach (decision 1.113).
- **Agents reach both** through Menkar's MCP tools (`docs/session-control.md`): `topic_add`,
  `topic_update`, `topic_close`, `topic_list`, the marks in `list_sessions`, and `start_session`
  refused to anyone but the orchestrator while the mode is on with one marked.

## Switching it, and the marks

> Left on 2026-11-13: the ★ moved from sessions to tasks (decision 1.114).
  (marking one unmarks the previous), "Role…" (one text field; empty removes the label), "Priority",
  "With you" — each with ✓ when set (`orchestrationItems`, `src/renderer/orchestration.ts`).

## The sidebar in the mode

> Left on 2026-11-13: the switch "Work | Team" came above it; this became the Team view (decision 1.112).
`modeRows` (`src/core/orchestration/rows.ts`) orders the rows; `renderSessionList` draws them while
the shown project's mode is on, and today's list otherwise, through the same code as before.

## The sidebar in the mode

> Left on 2026-11-13: the ★ moved from sessions to tasks (decision 1.114).
is labelled "Orchestrator"), the ★ before its name, and "with you" as a badge after it.

## The sidebar in the mode

> Left on 2026-11-13: the ★ moved from sessions to tasks (decision 1.114).
and saved (`topics_collapsed`), headed "Topics · N". A row: ★ when raised by a priority session,
the number, the title, a red mark when blocking.

## The sidebar in the mode

> Left on 2026-11-13: the Topics section moved under the switch "Work | Team" (decision 1.112).
**The Topics section** sits at the top of the sidebar while the mode is on, collapsible like Files

## The orchestration mode

> Left on 2026-11-13: the mode gained tasks, the Work view and the Board (decisions 1.112–1.116); the whole line.
keeps for them. Off, Menkar is as before and the marks wait. The guide for users and agents ships

## The data

> Left on 2026-11-13: the ★ moved from sessions to tasks (decision 1.114); the whole line.
  "with you" — and `topics_collapsed`. How they are read, kept and followed through a `/clear`, a

## Rejected

> Left on 2026-11-13: the ★ moved from sessions to tasks (decision 1.114).
- **Blocked events before finished ones in a wake**: not decided; only ★ first (1.78).

> Left on 2026-11-13: a new orchestrator's first prompt says the orchestration is new and names the guide.
    prompt telling it to load `menkar:orchestrator` and marked as it starts, then switches the mode
    on. **Not now** leaves it off.

## The data

> Left on 2026-11-13: plan 37 adds `parked` and `workers_cap`, a task with no assignee yet, and the workers' tools (decisions 1.118–1.123).
  "with you" — and `topics_collapsed`, `team_view`, `consultants_collapsed` and `done_today_open`. How they are read, kept and followed through a `/clear`, a
    shown by its current name), `star`, `state`, `steps` (3 to 7 lines, empty while queued), `step`
  and `start_session` refused to anyone but the orchestrator while the mode is on with one marked.

## The sidebar in the mode

> Left on 2026-11-13: parked workers fold apart into a "Parked · N" row (decision 1.120).
   into one "N earlier" row a click unfolds (per window, not saved).

## The data

> Left on 2026-11-14: a project's added folders join the marks (decision 1.124).
  "with you", `parked` and `workers_cap` (decision 1.118) — and `topics_collapsed`, `team_view`,

## The first-time card

> Left on 2026-11-14: the card offers the project's folders, not only its running sessions' (decision 1.124).
  "orchestrator" by default, and a folder among the project's running sessions' folders — the list
  `Ctrl+\`` offers — or, with none, the recent folders Add session offers).

## `Ctrl+\`` in the orchestrator's tab

> Left on 2026-11-14: `Ctrl+\`` offers the project's folders, running or not, and the added ones (decision 1.124); `teamFolders` was removed.
drawer first gathers the folders of the project's sessions with a running pane, each once
(`teamFolders`, `src/core/orchestration/folders.ts`). With one, the drawer opens there at once, as

## The sidebar in the mode

> Left on 2026-11-14: the tiles' count moved to `workCounts`, shared with the orchestrator's posts (decision 1.125).
1. **Count tiles**: open topics, tasks in progress ("working") and tasks waiting.

## The Board

> Left on 2026-11-14: the Board became a panel under the header, not a tab (decision 1.126).
Decisions 1.112 and 1.116 (2026-11-13). A tab of its own kind, `board`, one per project
(`openBoard`, `src/core/projects/layout.ts`), opened by the header's **Board** button, right of the
Orchestration switch and shown only while the mode is on, and by the Work view's "See all (N) →";
when it is open, both select it. It is saved with the layout (`{ board: true }`) and reopened once
per project; closing it is closing a file tab. **Switching the mode off closes the project's Board
in every window** (`closeBoards`; the human, 2026-11-13), so nothing of the mode shows with it off.

## The sidebar in the mode

> Left on 2026-11-14: "See all (N) →" opens the Board panel on Show all (decision 1.126).
   ★. More than 6: the first 6 and "See all (N) →", which opens the Board.

## The Board

> Left on 2026-11-14: the probe became a full card at a real column's width (decision 1.132).
  gaps (`defaultBoardHeight`, `src/core/orchestration/board.ts`), measured from a hidden probe card
  and the real heading, never a share of the window. A divider under it resizes it. "Show all"

## The data

> Left on 2026-11-14: the orchestrator sets or removes a task's ★ with `task_star` (decision 1.144); the tools are no longer counted in prose.
    The human sets it from a task's right-click (`setTaskStar`), the orchestrator at `task_add`
    when the human asks.
  `topic_update`, `topic_close`, `topic_list`, the six task tools, the marks in `list_sessions`,

## The sidebar in the mode

> Left on 2026-11-14: the Topics section's label says whose turn it is, "Awaiting you · N" (decision 1.146).
and saved (`topics_collapsed`), headed "Topics · N". A row: ★ when its task has the ★, the
status, per window. Empty, it says "No open topics".

## Switching it, and the marks

> Left on 2026-11-16: "Role…" became "Configure role…", which also sets the stored skills (decisions 1.152, 1.154, 1.157).
- **The row menu**, only while the mode is on, after "Group ▸", in a block of its own: "Orchestrator"
  (marking one unmarks the previous), "Role…" (one text field; empty removes the label), "With
  you" — each with ✓ when set (`orchestrationItems`, `src/renderer/orchestration.ts`). The row menu
  has no "Priority": the ★ is a task's (decision 1.114).

## Switching it, and the marks

> Left on 2026-11-16: the first-time card switches the mode on first (plan 40).
  - **Start** marks the chosen session, or starts the new one through `startNew` with a first
    prompt telling it to load `menkar:orchestrator`, that the project's orchestration is new, and to
    read the guide at its absolute path first (2026-11-13), marked as it starts; then it switches
    the mode on. **Not now** leaves it off.

## Handing sessions to the orchestrator

> Left on 2026-11-16: "Role…" became "Configure role…".
  one with a label sits under "Consultants". No tool changes an existing session's role: that stays
  the human's, from the row menu's "Role…".

## Workers per task

> Left on 2026-11-16: "keeper" is "maintainer" (plan 40).
  keeper — is the orchestrator's and the worker's skills.

## Rejected

> Left on 2026-11-16: consultants get a task for a request that needs more than a short answer (1.148).
- **Tasks for consultants**: a consultation is a conversation, not a ticket (1.115).

> Replaced 2026-11-16: a session under the orchestrator with no role counts as a worker, whoever started it (1.162).
- **Who is a worker** (`isWorker`): with the mode on, a child of the orchestrator with no role
  label. Experts (a label), consultants (loose) and sessions the human started are never parked,
  counted or hidden by Menkar.

## The sidebar in the mode

> Left on 2026-11-16: a parked worker's "waiting on …" also comes from its task in To review (decision 1.164).
   "waiting on …" from its current task (decision 1.120; `modeRows`).

## The Board

> Left on 2026-11-16: a task card's note line says whom a task in To review waits on (decision 1.164).
step segments, the note. A click selects the assignee's tab; the right-click sets the ★; nothing
else is edited there.

## Workers per task

> Left on 2026-11-16: a worker whose task is in To review waiting on a PR is parked too (decision 1.164).
  is waiting. Once its turn is over (its shown state idle or done, or the Stop hook's record)

## The data

> Left on 2026-11-16: the discussing topic, the current one, comes first (decision 1.169).
  - **The order shown** (`shownTopics`), in the sidebar and in `topic_list` (decisions 1.100 and
    1.114, which amend 1.77's): open and discussing only, those of a ★ task first, then blocking
    ones, then the rest by number, so the top topic is the one to take.

## The sidebar in the mode

> Left on 2026-11-16: a topic row shows a green dot while it is discussing (decision 1.169).
number, the title, a red mark when blocking. A click unfolds its context, who raised it and its

## The data

> Left on 2026-11-16: the Team view's folds are saved beside them, and Consultants' fold is one key for both views (decision 1.171).
  `consultants_collapsed` and `done_today_open`. How they are read, kept and followed through a `/clear`, a

> Replaced 2026-11-16: tasks 52 and 54 (1.171–1.173).
"The human wants to discuss topic N", "took control of", "handed … back" — ends, after its time,
with the tiles' three numbers: `[Menkar] packager finished its turn (08:47:33) · 2 topics · 1
working · 1 waiting`. The human follows the orchestrator from a phone through Remote Control, where

## The data

> Left on 2026-11-18: one sidebar view replaces Work | Team, the orchestrator folded by default, workers in the background (decisions 1.176, 1.177; plan 41). The section as it stood:
  "with you", `parked`, `workers_cap` (decision 1.118) and the added `folders` (decision 1.124) — and `topics_collapsed`, `team_view`,
  `consultants_collapsed`, `orchestrator_collapsed`, `others_collapsed` and `done_today_open`,
  each written only while true. `consultants_collapsed` folds Consultants in both views, Work and
  Team: one key for the same sessions (`set`'s choice, 2026-11-16). How they are read, kept and followed through a `/clear`, a

## The sidebar in the mode

> Left on 2026-11-18: one sidebar view replaces Work | Team, the orchestrator folded by default, workers in the background (decisions 1.176, 1.177; plan 41). The section as it stood:
**"Work | Team"** (decision 1.112) sits at the top of the sidebar while the mode is on, a segmented
switch; **Work is the default**, and the choice is saved per project (`team_view`, written only
for Team; `set`'s choice, 2026-11-13). Off, neither shows and the sidebar is the ordinary one.

**The Work view** (decision 1.115, `src/renderer/work.ts`), from the top:

1. **Count tiles**: open topics, tasks in progress ("working") and tasks waiting, counted by
   `workCounts` (`src/core/orchestration/counts.ts`), which also gives the tail of every post to the
   orchestrator (below).
2. **Topics**, as in the Team view below.
3. **Tasks · N**: the open tasks, ★ first, then by number. A row: ★, the title, `3/5` (or the state
   while it has no steps), the assignee, one segment per step (done, current, to come), and the
   note — "waiting on ‹what›" first while waiting, with a red edge. A click selects the assignee's
   tab if it has one, starting nothing (`selectSessionTab`); the right-click menu sets or removes the
   ★. More than 6: the first 6 and "See all (N) →", which opens the Board on Show all.
4. **Consultants · N** (when any): one compact row each, its state dot, name and role; a click
   opens its tab. Foldable, saved (`consultants_collapsed`).
5. **Done today · N**: topics closed and tasks done since local midnight, newest first; **folded
   by default**, its unfolding saved (`done_today_open`).

**Every post Menkar sends to the orchestrator** (decision 1.125, the human, 2026-11-14) — a wake,
"The human wants to discuss topic N", "took control of", "handed … back", away or back — ends,
after its time, with the tiles' three numbers: `[Menkar] packager finished its turn (08:47:33) · 2
topics · 1 working · 1 waiting`. **They are few** (decision 1.173, the human, 2026-11-16): every
post is a line in the human's chat with the orchestrator. A worker whose turn ends with its report
to the orchestrator gets no "finished its turn" for it, and everything arriving within
`WAKE_DELAY_MS` goes in one post, the human's own news first (`docs/session-control.md`, waking a
parent). The human follows the orchestrator from a phone through Remote Control, where
the statusline does not show and the posts do. `postCounts` gives them only for the orchestrator of
a project with the mode on, from the same `workCounts` as the tiles; posts to any other session are
unchanged.

**The Team view** is the sidebar as follows. `modeRows` (`src/core/orchestration/rows.ts`) orders
the rows; `renderSessionList` draws them while the shown project's mode is on, and today's list
otherwise, through the same code as before.

**Four profiles** (decision 1.107, the human, 2026-11-13), read from the marks with no mark of their
own: the **orchestrator**; an **expert**, a session under the orchestrator with a role label, shown
nested under it with its label; a **generalist** worker, under it without a label; a
**consultant**, a loose session with a label, under "Consultants".

**Three folds, each saved per project** (decision 1.171, the human, 2026-11-16), a triangle each:

- **The orchestrator's group** (`orchestrator_collapsed`): the triangle sits on the orchestrator's
  row, in its left padding, while anyone is under it. Folded, every child is hidden — with a tab,
  earlier and parked alike — and the row shows how many sessions are under it and the dot of the
  most urgent state among those running (`groupState`, as a collapsed group's), red when one waits
  at a permission prompt; with none running, the stopped dot.
- **Consultants** (`consultants_collapsed`, shared with the Work view) and **Others**
  (`others_collapsed`): folded, the heading alone.

1. **The orchestrator**, then its children with a tab, indented; its children without a tab fold
   into one "N earlier" row a click unfolds (per window, not saved). Its parked workers fold apart,
   after it, into a "Parked · N" row; unfolded (per window, not saved), each parked worker with
   "waiting on …" from its current task, else from its task in To review (decisions 1.120, 1.164;
   `modeRows`).
2. **"Consultants"**: every session with a role label that is not the orchestrator and not
   nested, each with its own children as in 1.
3. **"Others"**: the rest, with groups as in the ordinary list (headings, collapsed groups, the
   drag order).

A child sits under the top row of its line of parents, wherever that row is, at one level of indent.
Rows of parts 1 and 2 and nested rows are not dragged. Hidden rows and earlier conversations stay
out. A row shows its role label where the folder goes (the orchestrator without a label of its own
is labelled "Orchestrator"), the ★ before its name while its current task has it, and "with you"
as a badge after it. Under its name, its current task and step ("Release 0.2 · 3/5", or the state
while it has no steps; decision 1.116).

**The Topics section** sits under the switch in the Team view and after the tiles in the Work
view, collapsible like Files
and saved (`topics_collapsed`), headed "Awaiting you · N", so it says whose turn it is (1.146, the
human, 2026-11-14: only the label the user sees; "topic" stays the thing's name for agents, tools and
code). A row: ★ when its task has the ★, the
number, the title, a green dot while it is discussing (the current topic, decision 1.169, the
human, 2026-11-16) and a red mark when blocking; a blocking topic being discussed shows both. A click unfolds its context, who raised it and its
status, per window. Empty, it says "Nothing awaits you".
**At most 5 topics** (`TOPICS_SHOWN`, `topicsFolded` in `src/core/orchestration/rows.ts`; decision
1.171, the human, 2026-11-16), in both views, then a "N more…" row as Files has; a click unfolds
the rest, per window, not saved. The current topic comes first in the order, so it is always among
the 5.

**A double-click on a topic** (decision 1.96, 2026-11-12) sets it to "discussing", selects the
orchestrator's tab and posts to the orchestrator "[Menkar] The human wants to discuss topic N",
through the same cross-session messaging as the wakes (`wakeSession`, `postToSession`); nothing is
typed into its terminal. With no orchestrator running (none marked, or no tab), the topic still
goes to discussing and nothing is posted (`discussTopic` in `src/main/workspace.ts`).

## The Board

> Left on 2026-11-18: one sidebar view replaces Work | Team, the orchestrator folded by default, workers in the background (decisions 1.176, 1.177; plan 41).
- The Work view's "See all (N) →" opens it on Show all. **Switching the mode off closes it**
step segments, the note. The note line starts with what the task waits on, as in the Work view's

## Workers per task

> Left on 2026-11-18: one sidebar view replaces Work | Team, the orchestrator folded by default, workers in the background (decisions 1.176, 1.177; plan 41).
  Menkar stops it as closing its tab does, never mid-turn and never by typing, and
  the project, by name, not one with a tab. A tab after the orchestrator's, without the focus,
  any number. It counts the running workers; parked and stopped ones have no tab and don't count. A

## Notifications in the mode

> Left on 2026-11-18: Menkar's permission topic's Show leads to the waiting session (decision 1.178, plan 42).
- **Show** (the toast's button, or a click on the desktop notice) shows the orchestrator's tab, opens
  the Topics section if it was collapsed and unfolds the topic.

## Read-only tabs

> Left on 2026-11-18: taking control and handing back go to the orchestrator's inbox, not a post (decision 1.178, plan 42).
  "Take control", which marks it "with you", makes it writable and posts to the orchestrator
  "[Menkar] The human took control of ‹name›".
  and posts "[Menkar] The human handed ‹name› back". Both posts go through the wakes' messaging
  (`wakeSession`); nothing is typed.

## The human's presence

> Left on 2026-11-18: away and back go to the orchestrators' inboxes, not a post (decision 1.178, plan 42).
- **The posts**: a change posts `[Menkar] The human is away: …` or `[Menkar] The human is back`
  (`presencePost`) through `wakeSession` to each project's running orchestrator, minus the one
  that called `human_back` (`postRecipients`).
  Likewise for the one that called `human_away`.

## The sidebar in the mode

> Left on 2026-11-18: "Others" is one flat list with no group headings in the mode (decision 1.183, task 105).
3. **"Others"**: the rest, with groups as in the ordinary list (headings, collapsed groups, the
   drag order).
