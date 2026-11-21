# History of `docs/sessions.md`

## Remote Control, and the details' tokens

> Replaced 2026-11-09 by decision 1.18: the phone shows the live bridge, the list only as the fallback.
- Each pane remembers whether it started with the flag. That and the list decide the row's phone
  icon and its tooltip.

## On screen

> Left on 2026-11-09: one New ▾ menu; the advanced new session, Continue last and New chat removed (decision 1.30).
  remembered folder still exists. The advanced dialog carries model, permission mode and an extra
  folder to the start.

## Remote Control, and the details' tokens

> Left on 2026-11-09: one New ▾ menu; the advanced new session, Continue last and New chat removed (decision 1.30).
- Forks and Continue last never carry it. Nothing is ever typed into a running session: turning it

> Left on 2026-11-10: the phone left the tab (plan 23, decision 1.19).
    phone is the same outline in the row (after the state dot) and on the tab (before its name),
    in the dimmed text color (decision 1.19).

## On screen

> Left on 2026-11-10: replay removed from Menkar (decision 1.33).
- **Details, export and replay** read the whole transcript in main and use

## A session that changes id in its tab

> Left on 2026-11-11: the session a tab leaves is an earlier conversation of the one that replaced it, not a stopped row (decision 1.63, amending 1.56 and 1.57).
- **After a clear** (`followNewId`, `src/core/projects/rekey.ts`) the new id takes the old one's
  place: its spot in the project's members, its group, the group's leader mark and its hidden flag.
  The old id stays a member right after it, outside any group, as a stopped row. Nothing changes
  when the new id already is in a project.
- **After a resume** (`followResume`) the resumed session joins the tab's project through
  `addMember`, leaving any other project and its group there, and is shown. The session left stays
  where it was, stopped.

## On screen (trash and delete)

> Left on 2026-11-11: a sidebar row's menu trashes or deletes a session with no tab, its earlier conversations too if wanted, and projects.json forgets it (decision 1.66).
  keeps its bytes and mtime.

## Keeping it current

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
  while a scan runs schedules exactly one more scan after it. agent-tablet dropped that request and
  could miss a change until the next event.

## Menkar's `state.json`

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
**Only a user action writes it** (hiding a session). Reading never creates it, because a start
without `state.json` and `projects.json` is the first start that imports agent-tablet's data.

## A session that changes id in its tab, and trash and delete

> Left on 2026-11-12: groups lose their leader; a group is only visual (decision 1.76).
  place: its spot in the project's members, its group, the group's leader mark and its hidden flag.
    project's members, its group (and the leader mark), the hidden list, and every `earlier` list,

## On screen

> Left on 2026-11-16: details and export read through the session's agent catalog (plan 39, P0.4).
- **Details and export** read the whole transcript in main and use
  `src/core/sessions/transcript.ts`. Details' Tokens row is left out until it can come from the

## Remote Control, and the details' tokens

> Left on 2026-11-17: each agent's state rules and Remote Control reading are its kit's (plan 39, P0.5).
  - **How it is read** (`src/core/remote/live.ts`, `src/main/remote-live.ts`): the agent is found
    as the descendant of the pane's shell named `claude` (or a `node …/claude` script), by

## Sessions — how they are found, read and named

> Left on 2026-11-20: Codex's sessions are found, watched and followed (plan 39, P1a).
`src/core/sessions/` finds every Claude Code and Cursor session on the machine, reads what a row

## Reading a transcript

> Left on 2026-11-20: Codex's sessions are found, watched and followed (plan 39, P1a).
  `<id>.jsonl` or else its first `*.jsonl` by name. An agent contributes only when its CLI
  (`claude`, `cursor-agent`) is an executable on the `PATH` (`installed.ts`), checked on every
  scan. The list is newest modification first, ties by id.
  a rescan leave every transcript's bytes and mtime unchanged.

## Keeping it current

> Left on 2026-11-20: Codex's sessions are found, watched and followed (plan 39, P1a).
  it, and on `~/.cursor/projects/`, each folder in it and each `agent-transcripts/` in those. They
  are set again after every scan, so a folder created later is watched too. Not recursive:
  a running session's `subagents/` and `tool-results/` change constantly and hold no session.
  finds it (the refresh, or an event elsewhere).

## A session that changes id in its tab

> Left on 2026-11-20: Codex's sessions are found, watched and followed (plan 39, P1a).
  another id. A start Menkar made with `--resume` names the pane's own id, so nothing moves.

## On screen

> Left on 2026-11-20: Codex's sessions are found, watched and followed (plan 39, P1a).
- **Trash and delete** are the only writes under `~/.claude`, each confirmed in the renderer. Only

## Reading a transcript

> Left on 2026-11-20: main's agent commands pass the no-write test too (plan 39 P1b.4, task 165).
  names (`docs/agents.md`).

## Sessions — how they are found, read and named

> Left on 2026-11-21: OpenCode's sessions join the list (plan 39, P2.7, task 196).
`src/core/sessions/` finds every Claude Code, Cursor and Codex session on the machine, reads what a row
needs, and keeps the list current. `src/main/sessions.ts` gives the list to every window over IPC

## Reading a transcript

> Left on 2026-11-21: OpenCode's sessions join the list (plan 39, P2.7, task 196).
  "Codex: its sessions". An agent contributes only when its CLI (`claude`, `cursor-agent`,
  `codex`) is an executable on the `PATH` (`installed.ts`), checked on every scan. The list is

## Keeping it current

> Left on 2026-11-21: OpenCode's database folder is watched (plan 39, P2.7, task 196).
  since a resume appends to the day folder the thread began in. They are set again after every
