---
title: Choose an orchestrator
description: Turn on the orchestration mode in a project, pick the session you will talk to, and hand it the others.
sidebar:
  order: 2
---

## Turn on the orchestration mode

1. Open the project in the window.
2. Click :ui[orch.switch] in the header. The project list's team icon does the same for any
   project.

While the project has no orchestrator, a card asks who orchestrates.

![](shot:first-time-card)

## Fill in the card

1. Under :ui[orch.cardWho], pick one of the project's sessions, or :ui[orch.cardNew] with its name
   and the folder to start it in.
2. Under :ui[orch.cardManaged], leave checked the sessions the orchestrator will give work to.
   Uncheck the ones still in the middle of something with you, and any session you want to keep
   outside the team: a checked session's tab turns read only.
3. In :ui[orch.workersCap], type how many workers may run at the same time, or leave it empty for
   any number.
4. Click :ui[orch.cardStart].

:ui[orch.cardNotNow] leaves the mode off. :ui[orch.cardGuide] opens the guide the orchestrator
reads, in a tab; close the tab to come back to the card as you left it.
:ui[orch.cardCopy] copies a prompt that points another session at that guide.

A new orchestrator reads the guide first, then walks you through the rest: which sessions to give
it, what role each one has, and how the project works.

## Tell the orchestrator how the project works

Write in the project's own instructions (its `CLAUDE.md`), or ask the orchestrator to write it
there:

- whether the sessions share one working tree, and who commits and pushes;
- which checks a worker runs before it reports;
- where the project keeps its decisions;
- the experts and consultants, and the area of each;
- the model workers run on.

A few lines are enough. The orchestrator never guesses what is missing: it asks you.

## Change the orchestrator

Right-click another session in the sidebar, or click its `⋮`, and choose :ui[orch.orchestrator].
A project has one orchestrator, so the mark leaves the previous one.

## Change the settings later

While the mode is on, open the project list and click the gear beside the project's team icon.
There you change
:ui[orch.workersCap] and the :ui[orch.folders] where the orchestrator may start workers, with
:ui[orch.folderAdd] for a repository no session works in yet.

## Turn the mode off

Click :ui[orch.switch] again. The orchestrator, the roles, the tasks and the items are kept for the
next time; the sidebar shows the ordinary list, every tab takes keys, and the Board closes.
