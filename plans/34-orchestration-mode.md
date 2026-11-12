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

## Still to decide

- How topics reach the panel (the orchestrator's MCP tools writing Menkar's data, or a file Menkar
  reads), their fields, and who closes them.
- The priority flag on a session (1.6x ideas: a flag, not levels): where it is set and shown.
- `Ctrl+\`` in the orchestrator's tab: the folder picker (ideas file).
- Talking to one session directly inside the mode, and its debrief to the orchestrator.
- What the panel's team list shows per session, and what a click on it does.
