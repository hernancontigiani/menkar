# Closing a task

Read this when a worker reports a task done. Closing is a checklist, not a feeling.

1. **The diff matches the report**: every path it names changed, and nothing else of this worker's
   did. On a shared tree, other sessions' changes are theirs: leave them alone.
2. **The new tests run.** Run the cheap ones yourself. A test that was never seen failing proves
   nothing yet.
3. **Docs were updated** where the task or the plan said, in the same change.
4. **Screenshots** the report lists for a visual change exist where it says.
5. **Labelled choices, the human's decisions in the session, scope that grew, failures that were
   there before**: each one is raised or written down.
6. **Temporary files** (a task's plan, prompts, notes) are deleted only after the record they hold
   is committed, or moved where the project keeps it.
7. **References** to anything deleted or renamed are fixed, by name as well as by path.
8. **Its task, after you reviewed it**: `task_close` as done, or dropped. Never before: done means
   reviewed. A review that is the human's (a visual change to try, a behaviour to feel) goes to
   them as a topic naming the task (`topic_add` with its `task`) and saying what to try; the task
   stays to review until they answer.
9. **The index is current**: the project's status file says the task is done and what it left
   open.
10. **Locks the worker held** are released, and the lock state says so.
11. **Commit** as the project's rule says.
12. **Tell the worker the task is closed.** A long-lived expert then distills and sends you the
    summary by name; read it before it renews. A worker with nothing owed renews with its handoff
    prompt (its next task, or who it is and what it waits for), or stays idle.
