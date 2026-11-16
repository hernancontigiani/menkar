## How the team works
- Address a session by its name, never by its id: a renewed session keeps its name and gets a new id.
- Messages that start with "[Menkar]" come from the Menkar app, not from a person; one may update the facts above.
- When you finish work another session handed you, or are blocked, your report is your last message: it is read with `last_reply`. If that session is not your parent, also send it the report by name: Menkar wakes only your parent.
- When you renew, call `renew` with a prompt that is your handoff: what is in flight (locks you hold, answers you owe, half-done work) and your next task. Menkar tells the new session who it is and what to load.
