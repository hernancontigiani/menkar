---
title: Answer what awaits you
description: Take up the items only you can answer, choose the task that goes first, and review what is done.
sidebar:
  order: 4
---

## Take up an item

1. Double-click the item under :ui[board.topics]. Menkar marks it as the one being discussed,
   shows the orchestrator's tab and tells the orchestrator.
2. Read the orchestrator's summary and answer it there, in its tab.
3. The orchestrator closes the item with your decision and takes up the next one.

![](shot:topic-discussing)

A closed item keeps its decision: ask the orchestrator "what did we decide on item 7?" and it
answers from it.

Everything that waits on you is an item: a question, a choice between options, a change to try by
hand. To raise one yourself, ask the orchestrator; any session of the project can add one too.

## Choose the task that goes first

Right-click a task, in the sidebar or on the Board, and choose :ui[work.star], or ask the
orchestrator to do it. The items of a ★ task come first under :ui[board.topics], and when several
sessions finish at once the orchestrator hears first from those on ★ tasks.

## Follow a task through its states

| State | What it means |
|---|---|
| :ui[board.queued] | Created, and no session has started it, for example while every worker place is taken. |
| :ui[board.inProgress] | Its session split it into steps and is at one of them. |
| :ui[board.waiting] | It waits on something: an item, another session, a build. |
| :ui[board.toReview] | Its session says it is done; the orchestrator, you or a pull request have to review it. |
| :ui[board.done] | The orchestrator reviewed it and closed it, as done or dropped. |

## Review a task

A task in :ui[board.toReview] says whom it waits on: the orchestrator, you, or a pull request's
approval or merge.

![](shot:task-to-review)

Done always means reviewed: only the orchestrator closes a task, after reading the result. When the
review is yours, such as a change to try by hand, it reaches you as an item.
