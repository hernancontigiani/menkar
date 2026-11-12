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

> Replaced 2026-11-11 by decision 1.68: Menkar stops naming its predecessor.
It is the multiplatform successor of agent-tablet (`~/git/agent-tablet`, a GTK app in Python),
**written from scratch** in Electron and TypeScript from agent-tablet's documents and observed
behaviour — `docs/spec/` — not by translating its files. The look follows agent-tablet's, which the
human likes; the features are all of agent-tablet's.
| `docs/spec/README.md` | Building any feature: the index of what agent-tablet does and how it looks |
  About, with no link; no code is carried over from it, and new text never names agent-tablet.

> Replaced 2026-11-11 by decision 1.68: the first-start import is gone.
| `docs/projects.md` | Projects, groups, membership, windows and tabs as data, `projects.json`, or the first-start import |
| `docs/usage.md` | Measuring time, tokens or cost, reading or writing the usage history, `menkar usage`, or the agent-tablet import |

> Replaced 2026-11-12: the row also names the skills plugin (plan 33).
| `docs/session-control.md` | Menkar's MCP server, renewing or starting a session from an agent, parents, or waking a session |
