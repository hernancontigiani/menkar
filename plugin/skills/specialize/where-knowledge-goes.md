# Where each piece of knowledge goes

Read this at step 1. Four destinations, and each item goes to exactly one.

| What it is | Where it goes | Test |
|---|---|---|
| A fact about the project: how a part works, where a value is decided, a trap in the code, a failure's symptom and fix, why a design is the way it is | **The repository's docs** (or the `CLAUDE.md` beside that code) | Anyone touching that code needs it, whatever their role |
| How the human likes to work: language, what they want asked, how they want things shown, what not to do without asking | **The user's memory** | It holds for every session the human works with, in any role |
| The role: its boundaries, authority, what it does per kind of request, its self-checks, whom to ask, its own tools and logins | **The skill** | Only a session in this role needs it |
| Today's state: open branches, a deployed version, locks held, who waits for what | **The handoff**: the prompt of your next renew (or the system of record that already holds it) | It will be false in a week |

## Writing into the repository's docs

- **Which doc**: the one the project's map of topics names (its `CLAUDE.md` or docs index usually
  says which file owns which topic). When the map names none, prefer the `CLAUDE.md` kept beside
  the code to a prose document that may be merged or deleted.
- **Propose it to the human first**, then write it on the branch the human says, following the
  project's rules for a doc in use (for example, replaced text moved to a history file). Don't
  commit unless the project's rule says you do.
- **Write the reason** (why it is so, which case showed it) into the doc before the skill points to
  it. Many reasons live only in a conversation, and die with it.
- **The code wins over a doc.** When a doc says something the code contradicts, the doc is
  corrected (with the human's agreement), and the skill never copies the wrong line.

## Pointing instead of copying

- Point to a doc by **file and section**, never by line number: a section moves less.
- **A command that answers beats a pointer to a doc that asserts.** If a value can be listed by
  running something (a `--list`, a query, a status command), the skill names the command, not the
  value. A copied table goes stale silently.
- Don't repeat what a `CLAUDE.md` already says; point there.
