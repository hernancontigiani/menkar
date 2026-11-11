# Research prompt — orchestration dashboards and human inboxes for coding agents

> Paste everything below the line into a session **with web access**. It is self-contained.
> Context for the human: `plans/ideas/groups-and-orchestration.md`, Idea 2.

---

I build Menkar, a desktop app (Electron, GPL-3.0-or-later, Linux first) that runs several real
`claude` CLI sessions (and Cursor's agent) in embedded terminals, with projects and groups of
sessions. It already reads each agent's state from its terminal: working, blocked at a prompt, idle,
done-while-unseen.

I work with one **orchestrator** session that hands work to other sessions. My problems:

1. The orchestrator leaves decisions for me inside its chat; there is no list of pending items to
   answer one by one, by priority.
2. The orchestrator learns where each session is by asking it.
3. I have to poll every session to know if something needs me.

I am considering: an overview of all sessions' states; a local **board** where sessions report
their status ("waiting on session X", "needs the human") and post questions; an **inbox** of those
questions with priorities; notifications instead of polling. Sessions would reach the board through
Claude Code hooks (passed with `--settings`), a local stdio MCP server, or a CLI. Hard constraint:
the app never types into an agent's terminal on my behalf, so an answer must reach the agent some
other way (a blocking MCP tool call, a `Stop` hook that returns `decision: block`, a
`UserPromptSubmit` hook, or the orchestrator relaying it). Nothing may leave the machine.

**Research, and report as a Markdown document:**

1. **Claude Code's own features first.** What does Agent View (`claude agents`) do today, exactly:
   which sessions it sees (only background ones?), how it knows a session waits on input, whether
   another app can read the same data, and whether it has an API, files or hooks. Also: the
   current list of hook events and what each can return (especially `Notification`, `Stop`,
   `SubagentStop`, `UserPromptSubmit`, `SessionStart`), "channels"/notifications pushed into a
   running session, and any official way to deliver a message to an idle session without typing in
   its terminal. Cite the official docs (code.claude.com / docs.anthropic.com) with dates.
2. **Open-source apps** that manage many coding-agent sessions with an overview and an attention
   inbox: at least Claude Command Center, Octogent, Mission Control (builderz-labs), CrewDeck,
   Dorothy, Executive, recon, Claude Squad, Vibe Kanban, Crystal, AgentsRoom, Orca, plus any you
   find. For each: license, last commit date, stars, platform, how it learns each agent's state
   (terminal scraping, hooks, MCP, SDK), whether it has a human-questions inbox, priorities, and how
   an answer gets back to the agent.
3. **MCP servers / skills** for agent coordination and human-in-the-loop questions: Moo Tasks,
   agent-collab-hub, Meridian, interagent, agent-coord, bothy-board, and similar. For each: tools
   exposed (names and arguments), storage (local file, SQLite, hosted), whether a question blocks
   the agent, how the answer is delivered, and how an orchestrator reads the others' status.
4. **Claude Code skills or plugins** for an orchestrator pattern (one session coordinating
   others), and how they keep shared state.
5. **Backlog.md** (https://github.com/MrLesk/Backlog.md) in depth, as the likely store: the full
   task frontmatter (is there priority, assignee, labels, a custom status like "needs human"?), the
   MCP server's tools with their arguments, the `--json` schema and `--watch` behaviour, how two
   agents writing at once are handled, whether the folder can live outside the repository, and
   whether a status can be "waiting on another task/agent". Could an orchestrator keep "topics to
   discuss with the human" there, and could a desktop app draw a side panel from `--watch`?
6. **Keeping an orchestrator's chat clean**: how others stop worker messages from flooding the
   coordinator's conversation (queues, digests, hooks that inject a one-line summary, a "focus"
   mode), so the human can discuss one topic at a time in the chat itself (with voice).
7. **Patterns worth copying**, with the project they come from: data model of a status/question
   item, priority scales, how "waiting on another agent" is represented, how notifications are
   throttled, how the UI lists pending items.

**Output format:**

- A comparison table per section (name, link, license, last activity, the columns above).
- For each pattern worth copying: what it is, where it comes from, why it fits or not given the
  constraints above (local only, no typing into the terminal, `--settings` instead of editing
  `~/.claude/settings.json`).
- What does **not** exist yet (the gap Menkar would fill).
- Every claim with its source link; mark anything you could not verify. Do not copy code: ideas
  only (Menkar is GPL and written from scratch).
