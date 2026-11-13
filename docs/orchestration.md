# The orchestration mode

Decisions 1.77, 1.78, 1.83, 1.84, 1.86, 1.89–1.91, 1.93, 1.94 and 1.99–1.104 (the human, 2026-11-12),
and 1.112–1.116 (2026-11-13), the look chosen from mock-ups. A project can be switched into a mode
where the human talks to one orchestrator session, sees what waits on them and how far each
delegated task is, and sees the team in the sidebar ordered by role. Off, Menkar is as before and
the marks, topics and tasks wait. The guide for users and agents ships
in the plugin folder, `plugin/guide/orchestration-mode.md`.

## The data

- **Marks, per project in `projects.json`:** `orchestration` — on, the orchestrator, roles,
  "with you" — and `topics_collapsed`, `team_view`, `consultants_collapsed` and `done_today_open`. How they are read, kept and followed through a `/clear`, a
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
  - **The order shown** (`shownTopics`), in the sidebar and in `topic_list` (decisions 1.100 and
    1.114, which amend 1.77's): open and discussing only, those of a ★ task first, then blocking
    ones, then the rest by number, so the top topic is the one to take.
  - **`seen`**, written only once true: the human unfolded the topic or double-clicked it. A topic
    written before it reads as not seen.
- **Main keeps the topics** (`src/main/topics.ts`), loaded at start and written in the background on
  every change. The window state carries the shown project's topics in that order, `from` as a
  name (`TopicView`).
- **Tasks, in `tasks.json` in the config directory** (decision 1.113; `tasksPath`,
  `src/core/orchestration/tasks.ts`), a file of their own for the same reason as the topics, read
  and written the same way, version 1: `{ version, projects: { [projectId]: { next, tasks } } }`.
  - A task: `number` (per project, never reused, as topics), `title`, `assignee` (a session id,
    shown by its current name), `star`, `state`, `steps` (3 to 7 lines, empty while queued), `step`
    (1-based, 0 while queued), `note` (the latest report, one line), `waiting_on` while waiting,
    `created`, `updated` and `closed` (ISO, through the clock).
  - **States:** `queued` (added) → `in progress` (steps set; step n of m) → `waiting` (on a topic
    or a session, named) → `to review` (the assignee says it is done) → `done` or `dropped`, which
    only the orchestrator sets, after reviewing, so "done" always means reviewed.
  - **A session's current task** (`currentTask`): its task in progress or waiting, else its oldest
    queued one.
  - **The ★ belongs to a task** (decision 1.114): a topic of a ★ task comes first, a row shows ★
    while its current task has it (`onStarredTask`), and its wakes reach the orchestrator first.
    The human sets it from a task's right-click (`setTaskStar`), the orchestrator at `task_add`
    when the human asks.
  - **Tasks follow a session to a new id** (`followTasks`): a `/clear`, a resume, a renew and a
    reused name move its tasks to the new id, wherever its mute follows.
  - **Done today** (`doneToday`, `closedTopicsToday`): tasks closed as done and topics closed since
    the local midnight before now, newest first; a closed topic's last change is its close.
- **Main keeps the tasks** (`src/main/tasks.ts`) as it keeps the topics. The window state carries
  the shown project's open tasks (★ first, then by number), those closed today and before, each
  session's current task (`TasksView`), and "Done today" (`DoneView`).
- **Agents reach them** through Menkar's MCP tools (`docs/session-control.md`): `topic_add`,
  `topic_update`, `topic_close`, `topic_list`, the six task tools, the marks in `list_sessions`,
  and `start_session` refused to anyone but the orchestrator while the mode is on with one marked.

## Switching it, and the marks

- **The header's switch**, "Orchestration", right of Usage, for the project the window shows; **the
  project popover's team icon** per project, lit when on. Both are `setOrchestrationMode`.
- **The row menu**, only while the mode is on, after "Group ▸", in a block of its own: "Orchestrator"
  (marking one unmarks the previous), "Role…" (one text field; empty removes the label), "With
  you" — each with ✓ when set (`orchestrationItems`, `src/renderer/orchestration.ts`). The row menu
  has no "Priority": the ★ is a task's (decision 1.114).
- **The first-time card** (`firstTimeCard`): switching on a project with no orchestrator marked opens
  it instead. It says what the mode is and what an orchestrator is, and asks "Who orchestrates?":
  one radio per listed session (with a tab first, then by name) and "A new session" (a name,
  "orchestrator" by default, and a folder among the project's running sessions' folders — the list
  `Ctrl+\`` offers — or, with none, the recent folders Add session offers).
  - **Start** marks the chosen session, or starts the new one through `startNew` with a first
    prompt telling it to load `menkar:orchestrator`, that the project's orchestration is new, and to
    read the guide at its absolute path first (2026-11-13), marked as it starts; then it switches
    the mode on. **Not now** leaves it off.
  - **Open the guide** opens `plugin/guide/orchestration-mode.md` in a Menkar file tab, read only
    (files under the plugin folder get `files.readOnlyMenkar` from the file check), and hides the
    card (decision 1.94, mock G1). Closing that tab brings the card back with what had been chosen
    — the radio, the new session's name and folder — kept per window, in memory; the mode does not
    move until Start or Not now. Like any Markdown tab, the guide's has "Ask an agent"
    (`docs/files.md`).
  - **Copy a prompt for another session** copies a prompt naming the guide's absolute path. No
    external link: the app opens no URL of its own.

## The sidebar in the mode

**"Work | Team"** (decision 1.112) sits at the top of the sidebar while the mode is on, a segmented
switch; **Work is the default**, and the choice is saved per project (`team_view`, written only
for Team; `set`'s choice, 2026-11-13). Off, neither shows and the sidebar is the ordinary one.

**The Work view** (decision 1.115, `src/renderer/work.ts`), from the top:

1. **Count tiles**: open topics, tasks in progress ("working") and tasks waiting.
2. **Topics**, as in the Team view below.
3. **Tasks · N**: the open tasks, ★ first, then by number. A row: ★, the title, `3/5` (or the state
   while it has no steps), the assignee, one segment per step (done, current, to come), and the
   note — "waiting on ‹what›" first while waiting, with a red edge. A click selects the assignee's
   tab if it has one, starting nothing (`selectSessionTab`); the right-click menu sets or removes the
   ★. More than 6: the first 6 and "See all (N) →", which opens the Board.
4. **Consultants · N** (when any): one compact row each, its state dot, name and role; a click
   opens its tab. Foldable, saved (`consultants_collapsed`).
5. **Done today · N**: topics closed and tasks done since local midnight, newest first; **folded
   by default**, its unfolding saved (`done_today_open`).

**The Team view** is the sidebar as follows. `modeRows` (`src/core/orchestration/rows.ts`) orders
the rows; `renderSessionList` draws them while the shown project's mode is on, and today's list
otherwise, through the same code as before.

**Four profiles** (decision 1.107, the human, 2026-11-13), read from the marks with no mark of their
own: the **orchestrator**; an **expert**, a session under the orchestrator with a role label, shown
nested under it with its label; a **generalist** worker, under it without a label; a
**consultant**, a loose session with a label, under "Consultants".

1. **The orchestrator**, then its children with a tab, indented; its children without a tab fold
   into one "N earlier" row a click unfolds (per window, not saved).
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
and saved (`topics_collapsed`), headed "Topics · N". A row: ★ when its task has the ★, the
number, the title, a red mark when blocking. A click unfolds its context, who raised it and its
status, per window. Empty, it says "No open topics".

**A double-click on a topic** (decision 1.96, 2026-11-12) sets it to "discussing", selects the
orchestrator's tab and posts to the orchestrator "[Menkar] The human wants to discuss topic N",
through the same cross-session messaging as the wakes (`wakeSession`, `postToSession`); nothing is
typed into its terminal. With no orchestrator running (none marked, or no tab), the topic still
goes to discussing and nothing is posted (`discussTopic` in `src/main/workspace.ts`).

## The Board

Decisions 1.112 and 1.116 (2026-11-13). A tab of its own kind, `board`, one per project
(`openBoard`, `src/core/projects/layout.ts`), opened by the header's **Board** button, right of the
Orchestration switch and shown only while the mode is on, and by the Work view's "See all (N) →";
when it is open, both select it. It is saved with the layout (`{ board: true }`) and reopened once
per project; closing it is closing a file tab. **Switching the mode off closes the project's Board
in every window** (`closeBoards`; the human, 2026-11-13), so nothing of the mode shows with it off.

Columns (`boardElement`, `src/renderer/work.ts`): **Topics** (the open ones, in their order) ·
**Queued** · **In progress** · **Waiting** · **To review** · **Done**: today's closed tasks, newest
first, and the older ones folded under "Done before · N" (per window, not saved); a dropped task is
struck through. A task card: its number, ★, title, the assignee with its state dot, `3/5` and the
step segments, the note. A click selects the assignee's tab; the right-click sets the ★; nothing
else is edited there.

## `Ctrl+\`` in the orchestrator's tab

With the mode on and the selected tab running the orchestrator, a `Ctrl+\`` that would open the
drawer first gathers the folders of the project's sessions with a running pane, each once
(`teamFolders`, `src/core/orchestration/folders.ts`). With one, the drawer opens there at once, as
anywhere else. With several, a list (`folderPicker`, `src/renderer/switcher.ts`) shows them by the
folder's last name with the path as caption, the one last chosen (per window and project, in
memory) preselected; Enter opens the drawer there (`toggleDrawer`'s `folder`). A shown drawer is
hidden as always, with no list.

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
- **Show** (the toast's button, or a click on the desktop notice) shows the orchestrator's tab, opens
  the Topics section if it was collapsed and unfolds the topic.
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
  "Take control", which marks it "with you", makes it writable and posts to the orchestrator
  "[Menkar] The human took control of ‹name›".
- **"With you"**, the banner is blue (the theme's ANSI blue, the role `blue`): "This session is
  with you.", with "Back to reporting to the orchestrator", which clears the mark, makes it read only again
  and posts "[Menkar] The human handed ‹name› back". Both posts go through the wakes' messaging
  (`wakeSession`); nothing is typed.
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
  the human's, from the row menu's "Role…".

## Rejected

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
- **Tasks for consultants**: a consultation is a conversation, not a ticket (1.115).
- **Reported states** (`set_waiting`): in the mode a worker waits only on the orchestrator, and the
  human's questions go as topics (`docs/NOT_BUILT_YET.md`).
- **Muting loose sessions in the mode** (1.99's first form): nothing would ever tell the human about
  them (1.104).
- **Muting topics with the orchestrator**: the human would lose what waits on them.
- **Read only by hiding the terminal**: the human must still watch the session work.
- **A badge Menkar sets on the dock** for unseen topics: the desktop already counts Menkar's
  notices, and a second count would add to it.
