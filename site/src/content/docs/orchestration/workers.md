---
title: Run a worker per task
description: Let the orchestrator start a worker for each task, look at one when you need to, and talk to it yourself.
sidebar:
  order: 6
---

## Let the orchestrator start the workers

For each task the orchestrator starts a new session, a worker, named after the project and the task
(`atlas-app-t2` for task 2 of Atlas app). While the mode is on and the project has an orchestrator,
only the orchestrator starts sessions; ask it rather than another session.

Workers run in the background: they have no tab in the strip, and their rows in the sidebar say
what each one is doing.

![](shot:background-workers)

## Look at a worker

Click a worker's row or its task's card on the Board. It opens in the peek tab, the last one in the
strip, its name in italics. Clicking another worker replaces it there.

![](shot:peek-tab)

To keep it as an ordinary tab, click the pin on the peek tab, double-click the tab or the row, or
choose :ui[row.open] in the row's menu. Its name in the sidebar turns bold, with a pin.

Closing a worker's tab sends it back to the background, still running. A worker stops when you
choose :ui[row.stop], when the orchestrator parks it or closes its task, when you remove it, close
its window or quit Menkar.

## Answer a worker's permission prompt

A worker in the background waiting at a permission prompt shows a red pill with its name at the
right of the tab strip. Click it to open the worker in the peek tab, and answer the prompt there:
its tab takes keys while it waits.

## Talk to a worker yourself

A worker's tab is read only, under a yellow banner: :ui[orch.bannerReports]

1. Click :ui[orch.takeControl]. The banner turns blue, the tab takes keys, and the orchestrator
   gives the worker no work while it is with you.
2. Talk to the worker. Before you hand it back, ask it to tell the orchestrator what came out.
3. Click :ui[orch.handBack].

The orchestrator hears both times.

## Let a worker wait parked

When a task will wait long, for a pull request's review say, the orchestrator parks its worker:
Menkar stops it once its turn is over and keeps its conversation. Parked workers are folded in a
row of their own under the orchestrator, each with what it waits on. When the wait ends, tell the
orchestrator what came back; it resumes the same worker, with its whole conversation.

## Limit the workers at once

:ui[orch.workersCap] caps the workers running at the same time; at the limit, the orchestrator
leaves the next task queued until a worker finishes. Experts, consultants and parked workers don't
count, and a worker in the background does. Set the limit on the card when you
[choose an orchestrator](/menkar/orchestration/set-up/), in the project's orchestration settings,
or by asking the orchestrator.

## Work in several repositories

The orchestrator can start a worker in any of the project's folders: every folder its sessions work
in, and the ones you add under :ui[orch.folders] in the project's orchestration settings. A change
that spans two repositories becomes one task per repository.

## Clear up after a task

When the orchestrator closes a task, its worker stops and its row leaves the sidebar. After
reviewing it, the orchestrator moves the worker's files, such as screenshots and logs, from the
project's files folder to the system's trash, where you can restore them.
