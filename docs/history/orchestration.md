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
