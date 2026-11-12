# Plan 34: the orchestration mode in the app

> **Status:** stub, taken 2026-11-12 by `set`; being designed with the human. Not executable yet.
> Sources: `plans/ideas/groups-and-orchestration.md` (profiles, roles, undefined things, the shell
> drawer, priorities), `plans/ideas/research/` (ways of working, agent teams, transport, waking),
> plan 31's tools (`docs/session-control.md`), plan 33's skills.

## Decided with the human (2026-11-12, decision 1.77)

1. **Per project.** The project dropdown's menu has "Orchestration mode" (on/off). Off is the
   ordinary Menkar; roles and topics are kept for when it is switched on again.
2. **Roles are Menkar's data, set from the row's menu**: "Role ▸ Orchestrator / Expert / Consultant
   / Reviewer / Worker" and "Area and skill…" (free text, e.g. "Fabric: CI/CD · skill fabric"),
   saved in `projects.json`. One orchestrator per project. Agents read them through
   `list_sessions`, which gains role, area and skill.
3. **A panel beside the orchestrator's tab**, shown while that tab is selected, hideable: the open
   topics on top (those of priority sessions first, blocking ones marked), the team below (who is
   working, waiting, blocked, free). The human keeps talking to the orchestrator in its terminal.
4. **The sidebar is ordered by role in the mode**: the orchestrator first with the workers it
   started nested under it (folded when done), then experts and consultants with their area, then
   the other sessions. Groups still work inside each part. Off the mode, the sidebar is as today.

5. **Topics are written through Menkar's MCP tools** — `topic_add`, `topic_update`,
   `topic_close`, `topic_list` (number, title, short context, from which session, blocking or not,
   status) — kept as Menkar's data per project; the panel follows them. The human says "topic 7"
   and the orchestrator reads it with `topic_list`.
6. **The priority flag**: "Priority" in a row's menu (and in the panel's team list); a yellow ★
   beside the name; its topics go to the top of the panel with the same ★, and its wake messages
   reach the orchestrator first.
7. **`Ctrl+\`` in the orchestrator's tab** opens a quick list of the folders of the project's active
   sessions, deduplicated, the last choice preselected, arrows and Enter; when they all share one
   folder it opens there at once, as today. Elsewhere, as today.
8. **Talking to one session directly**: the human just opens its tab. While they talk, the panel
   shows that session "with you" and the orchestrator gives it no work. When a topic closes, the
   human asks the session to tell the orchestrator, and it sends a short summary by name (with the
   path of a plan or design if there is one) — its skill says how. Menkar types nothing.

## Still to decide

- What the panel's team list shows per session, and what a click on it does.
- How "with you" is known (the human selecting the tab and typing in it? a toggle?).
- Whether a topic can be answered from the panel, or only in the chat.
