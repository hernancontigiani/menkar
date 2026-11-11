# Ideas — collapsible groups, and an orchestration overview

> **Status: ideas, not a plan.** Written 2026-11-11 from a conversation with the human, to be
> continued in another session. Nothing here is decided; every "Proposal" is a recommendation
> waiting for the human. When an idea is accepted it becomes a row in `plans/00-STATUS.md` §1 and a
> numbered plan (`/design-plan`); this file is then deleted.
>
> Companion: `plans/ideas/research-prompt.md`, a prompt to paste into a session with web access to
> survey what already exists.

What the code does today, checked against the tree (2026-11-11):

- Shown states are `working`, `blocked`, `idle`, `done` (`src/core/agentstate/shown.ts`). A session
  with no running agent has no shown state ("stopped").
- The dots (`src/renderer/style.css`, "states, rings, logo"): **idle** = green outline, **done** =
  green filled (finished while nobody looked), **working** = yellow filled, **blocked** = red filled
  with a halo.
- `rollup()` already merges several panes into one state, most urgent first:
  `blocked > working > done > idle`.
- The context ring is shown only for running sessions (decision 1.21); yellow from 60 %, red from
  90 % by default (1.22).
- Groups live inside a project in `projects.json`; a group keeps only `name`, `color`, `members`
  (`docs/projects.md`). Nothing collapses today.

---

Idea 1 (collapsible groups) was built on 2026-11-11 (decisions 1.50, 1.54; `docs/projects.md`).

---

## Idea 2 — An orchestration overview and an inbox for the human

### The problem

The human works with an **orchestrator** session that hands work to other sessions (this
repository's own `set` / `b1` / `b2`). Today:

- The orchestrator leaves things for the human to decide **inside its chat**, and reminds them now
  and then. The pending items are scattered in scrollback; there is no list to answer one by one.
- The orchestrator learns where each session is **by asking it**, or by waiting to be told.
- The human has to **poll**: look at every session to know whether something needs them.

Goal: **pay attention when something happens, not all the time**; see the pending decisions as a
list; answer them in priority order.

Note: this repository already does a static version of it. `plans/00-STATUS.md` §2 is a list of
things waiting on the human, and the orchestrator role says "all state is in files". The idea is
the live version of that, for any project.

### Pieces, cheapest first

**2a. Overview (dashboard) — no new data.** A view (a tab or a window, like Usage) with the counts
the app already knows, for a project or a group: working, blocked, done (unseen), idle, stopped.
Each count opens its list; each row jumps to the session (Go to agent already does the jump).

**2b. States the terminal cannot show.** Two states the human asked for cannot be read from the
screen:

- **Waiting on another session** ("b1 waits for set's review").
- **Waiting on the human, but not blocked at a prompt** (a question left in prose at the end of a
  turn: the agent looks idle).

They have to be **reported by the session itself** to a common place: the **board**.

**2c. The board.** A store owned by Menkar, in its data directory, where each session reports its
status and posts questions, and the orchestrator reads it instead of asking each one.

- Per session: status line ("writing the migration"), state (`working` / `waiting-on:<session>` /
  `needs-human` / `done`), updated time.
- Per item (a question for the human): session, text, options if any, priority, blocking or not,
  created, answered (with the answer and who answered).

**2d. The inbox.** The human's view of the board's open items: sorted by priority then age; answer
one, dismiss one, or **open it with the orchestrator** (discuss it in the orchestrator's tab,
which reads the same board and can answer on the human's behalf when told to).

**2d′. Topics to discuss — the human's refinement (2026-11-11).** The human does **not** want to
answer in a separate form: the discussion stays **in the orchestrator's own chat**, where Claude
Code's features work (voice above all). What is wrong today is around the chat, not the chat:

- The topics live only in the scrollback: to discuss one, the human scrolls back to find it and
  its details.
- While they talk, messages from other sessions arrive in the orchestrator's chat with new things,
  and the conversation gets mixed with them.

So the change is:

1. **The orchestrator keeps its topics outside the chat**, in a list it writes (the board, or a
   file): id, title, one-paragraph context, links (files, plans, the session it came from),
   priority, status (`open` → `discussing` → `decided`), and the decision once taken.
2. **Menkar shows that list beside the orchestrator's tab** (a side panel, sorted by priority).
   The human picks one and says, by voice or typing, "let's do topic 7"; the orchestrator reads
   its details from the list, not from memory or scrollback. Menkar types nothing: at most a
   "copy reference" button.
3. **Other sessions stop writing into the orchestrator's chat.** They post to the board; the
   orchestrator reads it when it chooses (between topics, or when asked). At most one line arrives
   in the chat ("3 new items on the board"), through a hook, and **none while a topic is being
   discussed** (a focus mode).
4. When a topic is decided, the orchestrator writes the decision on the item and, where it
   belongs, to its home (`plans/00-STATUS.md`, a doc), and closes it.

This can be tried **before Menkar builds anything**: change how the orchestrator works (its role
file or skill) so it keeps the topics in a plain file and workers post there instead of messaging
it. The trial is throwaway; what it shows decides which fields and states the Menkar panel needs.

**2e. Priorities.** On a session (the human sets it, e.g. high / normal / low) and on an item (the
agent proposes, the human may change it). The inbox sorts by them; notifications may be limited to
high ones. Priorities are the app's own data, never in a session's name.

**2f. Notifications instead of polling.** A new item, or a session entering `needs-human`, notifies
as `blocked` does today (sound, toast, desktop notice, the count on the dropdown). The dock count
could become the number of open items.

### How a session reaches the board — options

| Option | How | For | Against |
|---|---|---|---|
| **A. Claude Code hooks** | Menkar passes hooks with `--settings` to the sessions it starts (`Notification`, `Stop`, `SessionStart`, `UserPromptSubmit`); each runs a small `menkar board …` command | Automatic, no cooperation from the agent; reliable start/stop/needs-permission events | Says *that* something happened, not *why* or *on whom* it waits; Claude Code only (Cursor has its own hooks) |
| **B. A Menkar MCP server** | Local stdio server given to the sessions with `--settings`/`--mcp-config`; tools such as `report_status`, `ask_human`, `get_answers`, `list_board`, `answer` (the orchestrator's) | The agent says what it waits on and asks structured questions; the orchestrator reads the whole board | Needs the agent (or a skill / CLAUDE.md line) to call it; a new running piece; decision 1.16 said "no MCP server for now" (for usage) |
| **C. A CLI** | The agent runs `menkar board ask "…" --priority high` through Bash | No protocol, works with any agent | Permission prompts for Bash; free-form |

**Proposal:** A for the automatic part (states and "needs the human"), B for questions and
"waiting on", C as the implementation both share (the hook and the server call the same core).

### The hard part — getting the answer back to the agent

A product rule: **nothing is typed into a running agent's terminal on the human's behalf**. So an
answer in the inbox cannot be typed into the agent. Options:

1. **A blocking tool call.** `ask_human(question, blocking: true)` does not return until answered;
   the agent waits inside the call and continues with the answer as the tool's result. Clean, but
   the agent is busy while it waits (it would show as working: needs its own state), and long
   waits need a timeout.
2. **Delivered at the end of a turn.** A `Stop` hook that finds answered items returns
   `decision: block` with the answers as the reason, so Claude continues with them. Only works
   while the agent is mid-work; an agent already idle is not woken.
3. **Picked up on the next prompt.** A `UserPromptSubmit` hook adds the answers as context the
   next time the human writes anything to that session.
4. **Through the orchestrator.** The answer goes to the board; the orchestrator relays it to the
   worker the way it hands out work today.

Proposal: 1 for blocking questions, 2 and 3 for the rest. Whether waking an idle agent is ever
allowed is **the human's decision**, since it bends the "nothing typed" rule.

### Rules this touches (from `CLAUDE.md`)

- Board data in Menkar's own directories, JSON (or the SQLite exception, which would need a
  decision); written whole through a rename.
- Hooks and the MCP server go in with `--settings` for the sessions Menkar starts, **never** into
  `~/.claude/settings.json`; sessions started outside Menkar would need the integrations menu.
- Nothing leaves the machine: a local stdio server or a local socket only.
- `src/core/` holds the board's model; main serves it; the renderer only draws it.

### Questions for the human

0. ~~Menkar's own board or Backlog.md?~~ **The human's direction (2026-11-11): everything native
   in Menkar**; whatever Backlog.md does well is copied or absorbed. Still open within that:
   - **Ideas or code?** Backlog.md is MIT, which GPL-3.0-or-later may include with its notice
     kept; but Menkar is written from scratch and carries no code so far. Proposal: ideas and
     formats only (its task fields, its MCP tools' shape, its `--watch` feed), no code.
   - **Where the board lives**: Menkar's data directory (one board across every project, never in
     the repository), or a folder in the repository like Backlog.md (versioned, but commits and one
     board per repository). Proposal: the data directory, as the rule on the app's own state says;
     a "export to the repository" can come later if wanted.
1. Overview as a tab, a window (like Usage), or a panel above the session list?
2. Is "an orchestration" a **group** (orchestrator + workers), a project, or a new thing? Proposal:
   a group with one member marked orchestrator — it ties Idea 1 and Idea 2 together.
3. Which delivery of answers (1–4 above), and may an idle agent ever be woken?
4. Priority scale: three levels, or P0–P3?
5. Claude Code only at first, or Cursor too from the start?

### Suggested order

0. Optional, throwaway: the trial of 2d′ without code (the orchestrator keeps its topics in a
   plain file, the workers post there instead of writing in its chat), to learn the fields before
   designing the native board.
1. Idea 1, collapsible groups (one plan).
2. 2a, the overview over the states already known (one plan).
3. 2b + 2c + 2f with hooks only (option A): "needs the human" and the notifications.
4. 2c with the MCP server (option B) + 2d inbox + 2e priorities.

---

## What already exists (first search, 2026-11-11, not verified in depth)

From a web search only; the repositories were not opened. `plans/ideas/research-prompt.md` asks a
session to check them properly.

- **Backlog.md** (MrLesk, MIT, ~7.4k stars, very active; brought by the human): tasks as Markdown
  files in a `backlog/` folder of the repository, with IDs (`TASK-1`), status, dependencies,
  acceptance criteria and milestones; a CLI (`backlog task create/edit/list`, `--json`,
  `task list --json --watch` streams changes), a **local MCP server** (`backlog mcp start`, set up
  per client, Claude Code included), a terminal kanban and a web board bound to 127.0.0.1.
  **The reference for Menkar's native board** (not a dependency: the human chose native,
  2026-11-11). Worth absorbing: Markdown/plain-file items with stable IDs, a CLI and an MCP server
  over the same core, a `--watch` JSON feed, the review checkpoints. Not taken: living in the
  repository (commits, one board per repository). Its priority and assignee fields were not
  confirmed from the README.
  ([repository](https://github.com/MrLesk/Backlog.md))
- **Claude Code's own Agent View** (`claude agents`, May 2026): one CLI dashboard of background
  sessions, which ones wait on input, reply or attach. Overlaps 2a; must be looked at first.
  ([guide](https://www.buildfastwithai.com/blogs/claude-code-agent-view-guide))
- **Claude Command Center / Octogent / Mission Control / CrewDeck / Dorothy** — local dashboards for
  many agents; Mission Control has a task board whose first column is an inbox; Dorothy has a
  "super agent" coordinating others through MCP tools and a kanban.
  ([Octogent](https://magicshot.ai/news/octogent-claude-code-multi-agent-dashboard/),
  [Mission Control](https://www.mintlify.com/builderz-labs/mission-control/introduction),
  [CrewDeck](https://github.com/ThomasMeb/crewdeck),
  [Dorothy](https://backiee.wasmer.app/https_github_com/Charlie85270/Dorothy),
  [Executive](https://hn.jakechampion.name/reader/https://github.com/ncr5012/executive))
- **MCP servers for coordination and human questions**: agents pause with an attached question and
  resume when it is answered (Moo Tasks); shared boards (StateLode, Tasklix — hosted, so not for
  Menkar); task queues with leases and an inbox checked by hooks (agent-collab-hub).
  ([agent-collab-hub](https://glama.ai/mcp/servers/Nathan-Z01/agent-collab-hub),
  [StateLode](https://mcpservers.org/servers/statelode-dev),
  [Tasklix](https://mcpservers.org/servers/tasklix-dev-docs),
  [coordination tag on mcp.so](https://mcp.so/tags/coordination))
- **Parallel-agent managers**: Claude Squad (tmux, AGPL), Vibe Kanban (kanban, reportedly sunset),
  Crystal (reportedly deprecated), Conductor (macOS, commercial).
  ([comparison](https://www.augmentcode.com/tools/open-source-agent-orchestrators),
  [awesome-claude-code orchestrators](https://www.mintlify.com/hesreallyhim/awesome-claude-code/tooling/orchestrators))

Licenses matter: Menkar is GPL-3.0-or-later and carries no code over; these are for ideas only.

---

## Menkar ships the orchestration skills (the human, 2026-11-11)

If Menkar offers orchestration as an optional advanced mode, it ships at least the base skills
(the orchestrator's role, a worker's, distill-then-clear) as defaults the user can edit, rather
than leaving each user to write them. Open when the mode is designed: where the defaults live
(installed with the app, copied into a project on first use), how a user's edits survive an update,
and how they reach a session (`--settings`, a plugin, or files in the repository).

How the user gets them (the human, 2026-11-11, two options, not decided): **published** in a
skills marketplace that Claude Code installs from (e.g. a `menkar-…` plugin), so the user installs
them from there; or **installed from Menkar**, where the user picks the scope (this repository, or
their user-level skills). Either way Menkar shows the skill and the user chooses; nothing is
installed by itself (as the integrations rule already says for `~/.claude/settings.json`).


What agent-deck does about skills and orchestration, and what Menkar could take: `plans/ideas/agent-deck.md`.

## The human's refinement of priorities and the board (2026-11-11, for after plan 31)

- **Priority is a flag, not levels** (replaces 2e's scale question): the human marks one or two
  sessions or leaders as *priority*; anything that comes from them — a question, a blocked prompt,
  a finished task, a topic — is queued above everything else for the human. Mostly a matter of
  what the human sees first (e.g. a deployment in progress: everything it raises comes first).
- **Open, to discuss when the orchestration mode is designed:**
  - Who is managed by the orchestrator: every session a leader unless marked otherwise, or
    sessions added to the orchestration explicitly? (Plan 31 already records the parent of a
    session started by `start_session`.)
  - How a leader is marked (1.50's leader mark exists, per group) and how the priority flag is set
    (a row's menu, a star-like mark?).
  - Where the board lives and whether it is needed at all: the human keeps talking to the
    orchestrator in its terminal, so the question is what the board shows that the chat cannot
    (the queue of topics in priority order, which workers wait on whom) and where: a button beside
    Usage, a panel beside the orchestrator's tab, or the sidebar itself changing in orchestration
    mode.
