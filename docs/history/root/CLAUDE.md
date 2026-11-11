# History of `CLAUDE.md`

> Replaced 2026-11-09: the credit names Agent Session Manager only (decision 1.10).
- **License: GPL-3.0-or-later.** Credit to agent-tablet and its origin, Agent Session Manager, is a
  line in `README.md`; no code is carried over from either.

> Replaced 2026-11-09 by decision 1.32: a saved tab may wait unstarted until its project is shown.
- **A session belongs to one project at most, runs if and only if it has a tab, and is in at most
  one tab across every window; a project is open in at most one window.**

> Replaced 2026-11-11 by decision 1.55: `set` runs from this repository and decides who executes what.
- **Roles:** the `set` session (in `~/git/agent-tablet`) designs the plans, writes their launch
  prompts in `prompts/`, reviews what is built and commits it; the sessions `b1` and `b2` execute the
  plans they are given. Who executes what is the human's call.
