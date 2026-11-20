---
title: Open your first sessions
description: Bring the sessions you already have into Menkar, start new ones, and run them in tabs.
sidebar:
  order: 2
---

The sidebar lists the sessions of the project the window shows. On the first start that project is
empty: fill it from the sessions your agents already have, or start new ones.

## Add a session you already have

1. Click :ui[sidebar.addSession] at the foot of the sidebar, or press `Ctrl+Shift+F`.
2. On :ui[add.existing], find the session: every Claude Code and Cursor session on this computer
   is listed by folder. Type in the search box to filter.
3. Click :ui[add.add]. A session another project holds offers to move it from that project
   instead: a session belongs to one project at most.

![](shot:add-session-existing)

## Start a new session

1. Choose :ui[menu.newSession] in the header's :ui[header.new] menu, or press `Ctrl+Shift+T`. :ui[sidebar.addSession] opens
   on :ui[add.new].
2. Pick the agent. One that is not installed is greyed out.
3. Pick the folder the session works in, or :ui[add.anotherFolder] for one not listed.
4. Give the session a name. Claude Code needs one: it is the session's own name, the one you see
   in Claude Code too.
5. Click :ui[newSession.start].

![](shot:add-session-new)

The new session opens in a tab and joins the project once you send it a first message.

## Open and close a session

A session runs only while it has a tab. Double-click its row in the sidebar, or choose
:ui[row.open] in its menu, to resume it in the real agent, in its own folder.

Closing its tab stops the agent, as closing a terminal does; its conversation stays with the agent,
and opening the row again resumes it. Before you close a session that is working, let it finish:
closing stops it mid-turn.

When you start Menkar again, the windows come back with the tabs they had.

## Next

- [Arrange sessions in tabs and panes](/menkar/sessions/tabs-and-panes/)
- [Group work into projects](/menkar/sessions/projects/)
- [Let one session run the team](/menkar/orchestration/)
