# Plan 37: a worker per task, parking and resuming, the cap

> **Status:** stub, taken 2026-11-13 by `set`; being designed with the human. Not executable yet.
> Decision 1.118 (`plans/00-STATUS.md` §1). Builds on plan 36's tasks.

## Asked by the human (2026-11-13)

In ccai a worker's task can wait days on a PR review, and the worker holds the context to apply the
review's feedback. Fixed workers then block; workers that close lose that context. So: a worker per
task, parked while it waits and resumed with its context, hidden when its task closes, with a
per-project cap on workers running at once.

## Still to decide

Kept as topics in Menkar's Topics section, then recorded in STATUS §1.
