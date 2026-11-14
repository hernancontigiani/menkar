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
