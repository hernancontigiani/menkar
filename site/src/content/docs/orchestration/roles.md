---
title: Give a session a role and skills
description: Label what a session is for, choose the skills it loads, and decide who works under the orchestrator.
sidebar:
  order: 7
---

## Know the four kinds of session

What a session is follows from two things you set: whether it works under the orchestrator, and
whether it has a role.

| Session | Under the orchestrator | Role | Use it for |
|---|---|---|---|
| The orchestrator | — | Optional | Talking to you, handing out the work, reviewing it |
| A worker | Yes | No | One task; it goes when the task closes |
| An expert | Yes | Yes | One part of the system it always implements, such as releases |
| A consultant | No | Yes | Answering anyone about an area it knows, often another repository |

Experts and consultants keep ordinary tabs and are never parked or counted among the workers. A
consultant's tab always takes keys.

## Give a session a role

1. Right-click the session in the sidebar, or click its `⋮`, and choose :ui[orch.configureRole].
2. Type a short :ui[orch.roleLabel], such as "API reviewer". An empty one removes it.
3. Tick the :ui[orch.roleSkills] it should load (below).
4. Click :ui[dialog.save].

![](shot:configure-role)

## Choose the skills

The list holds the skills the session can load: its own repository's (`.claude/skills/`) and yours
(`~/.claude/skills/`). Menkar's own skills are not in it: they follow from the session's place in
the team.

- Tick a skill to add it. It is :ui[orch.roleReadOnly]: the session loads it and never edits it.
- Switch it to :ui[orch.roleMaintainer] for the one session that keeps it up to date. A skill has
  one maintainer, so to move it, switch it back on the other session first.
- A stored skill the session can no longer find is listed first, struck through, until you remove
  it.

Only you set a session's skills, and a running session hears of a change at once.

## Hand a session to the orchestrator

Right-click the session and choose :ui[orch.handTo]. Nothing restarts: the orchestrator starts
giving it work, and its tab turns read only. :ui[orch.takeBack] undoes it. You can also ask the
orchestrator to take a session.

## Keep a session with you

Right-click a session under the orchestrator and choose :ui[orch.withYou], or click
:ui[orch.takeControl] on its tab. The orchestrator gives it no work until you clear the mark;
Menkar never sets or clears it by itself.
