# A management view: what Backlog.md and agent-deck show (2026-11-13)

> Asked by the human for a management-level sidebar or view in the orchestration mode. Web survey by
> a subagent of `set` (READMEs, `Statistics.tsx`, `MilestonesPage.tsx`, `TaskCard.tsx`, `web.jpeg`
> of Backlog.md; `tui-reference.md`, `docs/COMMAND-CENTER.md` of agent-deck). Both MIT: ideas only.

## Backlog.md
- Web board: sidebar (search, Tasks with Kanban/All, Documents, Decisions); columns To Do / In
  Progress / Done with count chips. A card: title, id, 2–3 line excerpt, assignee, created date;
  optionally type, acceptance-criteria ring "n of m", priority badge, labels, branch banner.
- No "review" status: its checkpoints are human steps.
- Milestones page: a bucket per milestone with % and a progress bar; completed milestones apart.
- Statistics page: totals, status and priority distribution, recently created/updated, and
  **Project Health**: average age, N stale (no update for 30 days, not done), N blocked.
- Terminal board; `board export` to Markdown.

## agent-deck
- TUI: list plus preview pane; a row is a state glyph (running, waiting, idle, error, starting),
  tool icon, title, fold badge on a parent; groups with headers; filters by state; fuzzy search.
- tmux status bar: the waiting sessions, numbered, newest first, a key jumps to one.
- Cost dashboard: today/week/month, top sessions, by model; web drill-down by group.
- Web "Fleet": a card per group, or a **Status** kanban of what each session's *work* is doing —
  Needs input / Ready for review / In progress / Parked / Done / Untriaged — set by a status hint
  the agent or user writes (goal, current state, decision); the process state is a small dot;
  count tiles above; conductors pinned with their Markdown note.
- Command Center: conductors with active children, current work, waiting decisions, recent
  completions; comment and instruction boxes type into sessions (Menkar's rules forbid that).

## Ideas for Menkar ([exists] = from today's data; [new] = needs new data)
1. "Waiting on you" strip at the top: blocking topics, blocked sessions "with you" or loose. [exists]
2. Count tiles: working · blocked · idle · open topics (blocking). [exists]
3. One card per line of work: the orchestrator or each expert with its children folded, counts by
   state, one line of current work from the last reply. [exists] (a curated headline is [new])
4. Goal / Current state / Decision per card. [new] (decisions from closed topics: [exists])
5. "Done today": closed topics with decisions, sessions that finished today. [exists] for topics
6. Semantic kanban (Needs input, Ready for review, In progress, Parked, Done). [new]
7. Health row: stale sessions, long-blocked ones, topics left unseen. [exists]
8. Plans as milestones with % of blocks done. [new]
9. The orchestrator's note pinned on top, a short Markdown summary. [new]
10. Cost and time per line of work, from `src/core/usage/`. [exists]
