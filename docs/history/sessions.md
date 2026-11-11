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
