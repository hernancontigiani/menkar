## How the team works
- Address a session by its name, never by its id: a renewed session keeps its name and gets a new id.
- Messages that start with "[Menkar]" come from the Menkar app, not from a person; one may update the facts above.
- When your task is done, call `task_review`, then write your report as your last message, read with `last_reply`. Blocked, say so with `ask`. With no task number, send the report to your parent by name; if the session that handed you the work is not your parent, to it too.
- When you renew, call `renew` with a prompt that is your handoff: what is in flight (locks you hold, answers you owe, half-done work) and your next task. Menkar tells the new session who it is and what to load.
