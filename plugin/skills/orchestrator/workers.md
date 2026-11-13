# Workers per task, parking, experts with several tasks

Read this when you hand out work, when a task will wait long, and when a task closes.

## A worker per task

- **A new generalist worker for each task**, never one reused for the next. Create the task first
  (`task_add` with no assignee), then start its worker with `start_session` and the task's
  number (`task`): Menkar names it `<project>-t<number>` and assigns it the task. Names are unique
  across the machine, which is why the project is in them; address it by that name.
- A task already assigned to another session is refused: that session holds its context, even
  parked. Resume it instead.
- **The cap** on workers running at once is the project's (the first-time card, the project's
  orchestration settings, or `set_workers_cap`). At the cap, `start_session` and
  `resume_session` of a worker are refused: leave the task queued and start it when one finishes.
  Experts, consultants and parked workers don't count.
- **`set_workers_cap` only when the human asks for it explicitly**, with the number they gave.
  Never to make room for a worker of your own.

## Parking and resuming

- **When a task will wait long** (a PR under review, an answer that takes days), have its worker
  report it waiting (`task_progress` with `waiting_on`), then `park_session` it: Menkar hangs it up
  after its turn, keeping its transcript. It shows under "Parked" in the Team view.
- **When the wait ends** (the human tells you the PR got feedback), `resume_session` it by name,
  with a prompt saying what came back. It resumes its own conversation, not a new one.
- Only a worker you started, with no role, is parked. Experts, consultants and sessions the human
  started are never parked.
- **Closing a task hangs up and hides its worker** (`task_close`, after its turn), when it is the
  worker started for that task. Read its report first: it is gone from the sidebar after.

## Experts with several tasks

- An expert may hold several tasks, **one in progress**; Menkar refuses a second one in progress.
- Give an expert another task **only while its current one waits on something outside** (a long
  build), naming the task's number in every message. **Never a third.**
- **Parallel work in an expert's area**: start a per-task worker that loads the expert's skill
  **read only**, and say so in its task. Never a second session of the expert.
- **A skill has one keeper**, the named expert: only it distills its skill. A worker's lesson for
  that skill comes in its report; hand it to the expert, by name.
