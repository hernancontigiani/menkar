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

> Replaced 2026-11-12 by decision 1.85: set also pushes.
- **Execution sessions do not commit, branch, tag or push**; `set` commits after reviewing, when the
  human has asked it to. Stage **by path**, never `git add -A` or `.`.

> Left on 2026-11-13: the orchestration doc's row names tasks, the Work view and the Board (plan 36).
| `docs/orchestration.md` | The orchestration mode: its marks and topics, the sidebar in the mode, the first-time card and its guide, `Ctrl+\`` in the orchestrator's tab |

> Left on 2026-11-13: workers are per task, capped at two (1.118 amends 1.55).
- **Roles:** the `set` session (at this repository's root) designs the plans, writes their launch
  prompts in `prompts/`, reviews what is built and commits it; the sessions `b1` and `b2` execute the
  plans they are given. **`set` decides who executes what** (1.55); two workers, no third.

> Moved 2026-11-14 by decision 1.143: the rules file is `AGENTS.md`, and `CLAUDE.md` holds only
> `@AGENTS.md`; this history continues here, its first entries written while it was `CLAUDE.md`'s.
# CLAUDE.md — Menkar

> Replaced 2026-11-15: the cap is three (1.153).
(`menkar-t<N>`, 1.118) executes it, at most two at once (the project's cap): the sessions' work
  overlaps too much for more.
  overlaps too much for more. **`set` decides who executes what** (1.55).

> Replaced 2026-11-17: the files folder reaches Claude through --settings, not --add-dir (task 57).
| `docs/project-files.md` | The per-project files folder, the sidebar's Files section, bringing a file in, or `--add-dir` |

> Replaced 2026-11-17: the per-agent rule names its check (plan 39, P0.7).
  cannot break another's (1.135). How it is organised is the multi-agent architecture's to decide.

> Replaced 2026-11-18 by decision 1.176 (Q1, the human): a worker's tab may be in the background or the peek.
- **A session belongs to one project at most, runs only while it has a tab, and is in at most one
  tab across every window; a project is open in at most one window.** A saved tab of a project not
  yet shown since start waits, unstarted, until its project is shown (decision 1.32).

> Replaced 2026-11-18 by decision 1.177: the sidebar in the mode is one view.
| `docs/orchestration.md` | The orchestration mode: its marks, topics and tasks, the Work and Team views, the Board, the first-time card and its guide, `Ctrl+\`` in the orchestrator's tab |

> Replaced 2026-11-19 by decision 1.190: no native Windows; Linux, with macOS not decided.
`claude` CLI; it does not reimplement the agent. **Linux first (Ubuntu), then Windows and macOS.**
