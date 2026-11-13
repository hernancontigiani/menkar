# Ideas — the orchestration mode: what is built, and what is still open

> **Status: ideas, not a plan.** Pruned 2026-11-12 after plans 34 and 35: what this file proposed
> and the human accepted is built, and its documentation is the code's docs, not this file. Only
> what is still open stays below. The earlier text is in `git log -- plans/ideas/groups-and-orchestration.md`.

## Built (read these, not this file)

| Idea | Where it lives now |
|---|---|
| Collapsible groups (Idea 1); groups as a visual gathering only, no leader (1.76) | `docs/projects.md` |
| The orchestration mode: per project, the orchestrator mark, free role labels, ★ priority, "with you", the sidebar ordered by role, workers nested | `docs/orchestration.md` |
| The board and the human's inbox (2c, 2d, 2d′): topics kept by the orchestrator through `topic_*`, shown in the sidebar's Topics section, discussed in the chat (double-click) | `docs/orchestration.md` · `docs/session-control.md` |
| Priorities (2e): a flag, not levels | `docs/orchestration.md` |
| Notifications instead of polling (2f): only the orchestrator, "with you" and loose sessions notify in the mode; topics notify; Mute per session | `docs/orchestration.md` · `docs/agent-state.md` |
| How sessions reach Menkar (hooks / MCP / CLI): Menkar's MCP server, files as transport, wakes through cross-session messaging | `docs/session-control.md` |
| Menkar ships the orchestration skills (plugin) and an agent-readable guide | `docs/session-control.md` · `plugin/guide/orchestration-mode.md` |
| Undefined things and the orchestrator inventing: answer only from what is written, route the rest | `plugin/skills/orchestrator/SKILL.md` |
| The shell drawer from the orchestrator's tab (one shell per folder) | `docs/orchestration.md` |
| Read-only tabs, taking control, handing sessions to the orchestrator | `docs/orchestration.md` |
| A session waiting on its own background work reads as working | `docs/agent-state.md` |

## Still open

- **States a session would report itself** (2b: waiting on another session, waiting on the human
  without a prompt): deferred with their trigger in `docs/NOT_BUILT_YET.md`; survey in
  `research/reported-states.md`.
- **Other agents in the mode** (Codex, Gemini, Cursor): STATUS 2.21 and `docs/NOT_BUILT_YET.md`.
- **The guide online**: `docs/NOT_BUILT_YET.md`. ("With you" known by itself was dropped on
  2026-11-13: read-only tabs make taking control explicit.)
- **An overview with counts** (2a: working, blocked, done, idle, stopped for a project or a group,
  each count opening its list): not asked for since the sidebar became the team in the mode;
  reconsider if the sidebar stops being enough with many sessions.
- **Hosting Claude Code's agent teams** (teammates in Menkar tabs) instead of Menkar's own
  orchestration: studied in `research/agent-teams.md`, never decided either way.

## Background kept for designers

The research behind the mode is in this folder: `agent-deck.md`, `research/` (transport, waking,
skills delivery, ways of working, agent teams, reported states). The three shapes of an
orchestration the mode must cover:

## Three real profiles of an orchestration (the human, 2026-11-12)

From fewest sessions and most expert orchestrator to most sessions and least expert one:

1. **Menkar — the orchestrator is engineering manager and the expert.** The human talks only to it;
   it designs the plans, hands them to generalist workers and reviews. Workers are not experts in
   anything; talking to one of them directly is rare. In practice it works like subagents.
2. **LaburoMenos — the orchestrator is a PM with expertise.** Workers are ephemeral: created for a
   plan, gone after it. Slowly one or two **expert sessions** appear and stay open; the human talks
   to one of them directly for an hour on a topic, and when an idea closes, the expert tells the
   orchestrator ("we have this design" or "I wrote this plan"); the orchestrator decides who takes
   the plan and when, by priority. With 5–6 sessions in parallel it also decides **who may work
   at the same time, by the resources they touch** (conflicts, frontend vs backend). One product
   with interconnected verticals in one ecosystem, so a session understands context more easily.
3. **ccai — the orchestrator is a PM with almost no expertise**, like someone running a Jira board
   who doesn't know what each ticket means in depth. Many experts: some only design or plan, some
   review or consult (other human developers commit code that did not go through this machine,
   and an expert evaluates it for regressions). The orchestrator starts the worker sessions and
   organises them by resources, but almost never can answer a worker's question about its task: it
   tells the worker which expert session to ask. **With no expert for a topic, the orchestrator asks
   the human**, until a topic comes up often enough that an expert is created for it. Three products
   linked by a bridge but largely independent (own engines, repositories, rules), more human
   developers, more need for review and consultation.

What changes between them is how much the orchestrator knows, and so how much the **experts outside
it** carry: designing, planning, consulting, reviewing. The mode must cover all three.
