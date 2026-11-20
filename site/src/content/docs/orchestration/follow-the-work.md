---
title: Follow the work
description: Read the sidebar in the orchestration mode, from what awaits you to what was done today.
sidebar:
  order: 3
---

## Read the counts

The three tiles at the top count the items awaiting you, the tasks in progress and the tasks
waiting on something. They and :ui[board.topics] stay in view however far you scroll.

## See what awaits you

:ui[board.topics] lists the items only you can answer, in the order to take them: the one being
discussed first, with a green dot, then those of the ★ task, then the blocking ones, with a red
mark, then the rest by number. Click an item to read its context, who raised it and its status.

![](shot:work-view-awaiting)

The list is read only: [answer an item](/menkar/orchestration/topics-and-tasks/) in the
orchestrator's tab.

## Follow each task

Under the items are the open tasks, the ★ one first. Each row shows the title, the session
that has it, a bar per step, and its latest note; a task waiting on something has a red edge and
says what it waits on.

![](shot:task-steps)

- Click a task to see its session.
- Right-click it to :ui[work.star] or :ui[work.unstar].
- Past three tasks, click the link under them to open [the Board](/menkar/orchestration/board/)
  with every task.

## Find a session in the team

Below the tasks is the team:

- the orchestrator, with the sessions it gives work to under it. Its group starts folded; folded,
  its row says how many are under it and shows the most urgent state among them, red when one
  waits at a permission prompt;
- :ui[orch.consultants], the sessions with a role outside the team;
- :ui[orch.others], every other session of the project.

Each row shows, under the name, the session's current task and step. Click the triangle beside a
group to fold or unfold it; Menkar keeps each fold per project.

## Look back at the day

At the foot of the list, a folded section holds the items closed and the tasks done since midnight.
Click it to unfold it.

## Know when to look

With the mode on, the sessions under the orchestrator make no sound, toast or desktop notice: the
orchestrator tells you what matters. The orchestrator itself, the sessions with you and the
sessions outside the team notify as usual. A new item notifies you too, and so does an item that
becomes blocking; while you discuss one, new ones arrive without sound.

To silence any session, right-click its row and choose :ui[row.mute].

When a worker waits at a permission prompt and its tab is not in view, Menkar adds a blocking item
for it. Click its notice, or :ui[toast.show] on it, to open that worker's tab and answer it there; the
item closes by itself once you have.
