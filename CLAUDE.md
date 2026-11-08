# CLAUDE.md — Menkar

Menkar is a desktop app for working with several Claude Code (and Cursor) sessions at once: a
session list on the left, the real agent running in an embedded terminal on the right, with
projects, tabs, split panes, several windows, usage tracking and file tabs. It runs the real
`claude` CLI; it does not reimplement the agent. **Linux first (Ubuntu), then Windows and macOS.**

It is the multiplatform successor of agent-tablet (`~/git/agent-tablet`, a GTK app in Python),
**written from scratch** in Electron and TypeScript from agent-tablet's documents and observed
behaviour — `docs/spec/` — not by translating its files. The look follows agent-tablet's, which the
human likes; the features are all of agent-tablet's.

**Design decisions that constrain code are recorded here, as rules.** If a decision is not written
in this file, in `docs/` or in `plans/00-STATUS.md`, it is not decided anywhere a session can
read: ask rather than re-derive it.

## Where each thing lives

The axis is **how long each thing lives**. That decides which file a paragraph goes to, and keeps
what matters from being lost when a plan is deleted.

| Layer | Dies when | Lives in |
|---|---|---|
| What the app is, how to install and use it | Never | `README.md` |
| What the app must do, feature by feature, with the look to match | When the feature is built and its doc says it | `docs/spec/` |
| Rules that constrain code not written yet | When the code makes them obvious | This file |
| How a subsystem is built and why that way | With the code it describes | `docs/<subsystem>.md`, one row in the table below |
| What is deliberately deferred, with its trigger | When the trigger fires | `docs/NOT_BUILT_YET.md` |
| What is decided, open, and in flight | Kept current, never a narrative | `plans/00-STATUS.md` |
| Text that stopped being true: a previous rule, a closing note | Never; it only grows | `docs/history/`, never loaded |
| How something will be built | **When it is executed** | `plans/NN-*.md` |
| How a plan is written, executed and closed | Never | `plans/README.md`, `plans/ROLE-*.md` |

`docs/` is internal: it is not a published site.

**Subsystem docs** (one row each, with *when* to open it):

| Doc | Open it when |
|---|---|
| `docs/spec/README.md` | Building any feature: the index of what agent-tablet does and how it looks |
| `docs/toolchain.md` | Changing the build, the checks in `npm run ci` or `npm run ui-check`, or adding a dev dependency |
| `docs/foundations.md` | Logging, writing the app's JSON state, adding a user-visible string, or opening a SQLite database |
| `docs/packaging.md` | Changing the .deb, its post-install, the sandbox profile, or anything installed outside `/opt/Menkar` |
| `docs/sessions.md` | Finding, reading or naming sessions, watching the agents' folders, or the sessions' keys of `state.json` |
| `docs/projects.md` | Projects, groups, membership, windows and tabs as data, `projects.json`, or the first-start import |
| `docs/usage.md` | Measuring time, tokens or cost, reading or writing the usage history, `menkar usage`, or the agent-tablet import |

## Product rules the code must hold

Each one is broken by an ordinary-looking line of code.

- **The agents' data is read, never rewritten.** No code edits a transcript, `~/.claude.json` or
  anything else an agent owns. The only writes under `~/.claude` are the ones the user starts and
  confirms (moving a transcript to the trash, deleting it). **Any new write there is a decision for
  the human, recorded in `plans/00-STATUS.md` before the code** that does it exists.
- **What the app adds to Claude's settings (`~/.claude/settings.json`) goes through one integrations
  menu**: nothing is installed by default or as a side effect, each piece is accepted on its own and
  removable on its own, leaving the rest of the file as the user had it. **What the app needs in the
  sessions it starts goes with `--settings`**, never into that file.
- **The app's own state lives in its own directories** — on Linux `$XDG_CONFIG_HOME/menkar/`,
  `$XDG_CACHE_HOME/menkar/`, `$XDG_DATA_HOME/menkar/`; on Windows and macOS Electron's
  `app.getPath()` equivalents — never next to an agent's files. Paths are resolved through one module.
- **A session's name is the one Claude has** (`claude -n`, `/rename`). The app never keeps a second
  name for a session that Claude already named.
- **A session belongs to one project at most, runs if and only if it has a tab, and is in at most
  one tab across every window; a project is open in at most one window.**
- **The app's own state is JSON** (`state.json`, `projects.json`), written whole through a temporary
  file and a rename. **The one exception is the usage history**, SQLite in the data directory: a
  file from a newer app is left untouched and an unreadable one is moved aside, never deleted.
- **Nothing is encoded into a session's name**: categories, projects and status are the app's own
  data.
- **Nothing leaves the machine.** No telemetry, no update check, no crash reporting, no remote
  font or script in the UI. The app makes no network connections of its own; only the agents it runs
  do. The renderer's Content-Security-Policy allows nothing remote.
- **Every user-visible string goes through `t()`** (the i18n module), and an error shown to the user
  is our own sentence, never an exception's message.
- **Nothing is typed into a running agent's terminal on the user's behalf**: at a permission prompt
  an Enter approves the highlighted choice, and a half-written message would be sent.
- **License: GPL-3.0-or-later.** Credit to agent-tablet and its origin, Agent Session Manager, is a
  line in `README.md`; no code is carried over from either.

## TypeScript and Electron

- **TypeScript `strict`, no `any`** (an unavoidable one is line-scoped with its reason). `tsc` stays at
  zero errors; Biome lints and formats.
- **Node 22 LTS and npm.** A runtime dependency is justified in the plan that adds it: it ships in
  every installer. Native modules (node-pty, better-sqlite3) are rebuilt for Electron.
- **Three layers, and the line between them is the architecture:**
  - `src/core/` — the logic (sessions, transcripts, projects, usage, providers, agent state):
    **imports nothing from Electron and nothing from the DOM**, tested with Vitest on plain Node.
  - `src/main/` — Electron's main process: windows, ptys (node-pty), files, the IPC handlers; thin,
    calling `core`.
  - `src/renderer/` — the UI: plain TypeScript and DOM with xterm.js, no UI framework unless a plan
    justifies one. It talks to main only through the preload's typed API.
- **IPC is typed once**: one module declares every channel and its payload, imported by main,
  preload and renderer. `contextIsolation` on, `nodeIntegration` off, `sandbox` on for the renderer.
- **Never block the main process or the renderer.** Reading transcripts, scanning folders and SQLite
  work run off the UI path (async I/O, a worker or a utility process); the renderer only renders.
- **Paths are resolved when called, not at import**, through the paths module, so a test points
  them at a temporary directory.
- **Time is read only through `src/core/clock.ts`**, or passed in: idle timers and cost windows must
  be testable at 23:59 and across midnight. A test fails on `Date.now()` / `new Date()` elsewhere.
- **Errors are handled at the boundary they come from, once**: no empty `catch`; a broad one names
  what it expects and logs what it swallows.
- **Usage numbers come only from `src/core/usage/`**: the window, the CLI and anything later read
  them there, so one definition of a turn holds everywhere.
- **Logging goes through one module**; identifiers go in structured fields, not in the message.
- **xterm.js calls a custom key handler for keydown and keypress alike**: a key the app handles is
  blocked for every event type, or the terminal still receives it.
- **A rule about the shape of the code** is enforced by a test that reads the source (the TypeScript
  compiler API or a parse), not by `grep`.
- Writing a test: `.claude/rules/ts-tests.md` loads on its own when a test file is touched.

## Local CI

**There is no hosted CI: `npm run ci` is the gate**, and a change is not done until it passes:
Biome (lint and format check), `tsc --noEmit`, Vitest, and the history check (no line left a decision
document without reaching its history). Report the result with its output when a change is reported
done; a skipped step is said to be skipped. Outside the gate: `npm run ui-check` (Playwright on the
real Electron app under `xvfb-run`) for anything the user sees.

## How work moves: design → plan → execute → review

Work larger than a single change goes through `plans/`. The method is `plans/README.md`. Each role
is loaded with a skill:

| Skill | When |
|---|---|
| `/design-plan` | Writing a plan another session can execute without rethinking it |
| `/execute-plan` | Building a written plan, block by block |
| `/orchestrate` | Deciding what goes next and what runs in parallel, writing a launch prompt, closing a plan |
| `/audit-architecture` | Asking whether a subsystem can change or grow without touching everything |
| `/review-branch` | Reviewing changes for regressions before they are committed |
| `/compact-safe` | Before a context compaction, and right after one |

- **Roles:** the `set` session (in `~/git/agent-tablet`) designs the plans, writes their launch
  prompts in `prompts/`, reviews what is built and commits it; the sessions `b1` and `b2` execute the
  plans they are given. Who executes what is the human's call.
- **Decisions belong to the human.** When a choice is theirs, ask with concrete options and **one
  recommendation**, with the case in view (a screenshot, the real volume), then record it with its
  date in the file that owns it. Where something goes in the UI is a decision, not a deduction.
- **Verify against the tree before asserting.** Not the old plan, not memory, not a subagent's
  report.
- **No abstraction without a consumer.** Defer it with its trigger in `docs/NOT_BUILT_YET.md`.
- **See a test fail before trusting it**: run a new check once against an injected defect.
- **A number written in prose is asserted by a test or not written.**
- **An enum that crosses a boundary has a parity test** — between what the statusline writes and what
  the app reads, between main and renderer.
- **A session sees its own UI change through Playwright on the real Electron app under `xvfb-run`**,
  never on the human's display and never with the human's running instance.
- **The human tests by hand, with their own data.** Their config, their sessions and their
  `~/.claude` are not touched to set up a test or a demo; ask first.

## Git and the shared tree

Several sessions work on this tree at once.

- **Execution sessions do not commit, branch, tag or push**; `set` commits after reviewing, when the
  human has asked it to. Stage **by path**, never `git add -A` or `.`.
- **No command that moves someone else's tree**: no `stash`, `checkout`, `reset`, `clean`.
- **Stop a process by PID, never by pattern** — the human's own instances run too. Format and lint-fix
  your own paths, never the tree.
- **A file you created as new that `git status` shows as modified was not new**: look first.

## Comment conventions

- **The default is no comment.** A comment is earned only when deleting it would lose something the
  identifier, the value and the surrounding code cannot express — almost always a footgun.
- **Never cite a document by name or section in a code comment**; inline the *why*.
- **A comment carries the WHY, never a restatement of the line below it.** Say it once.
- **Verify a factual claim before leaving it in a comment.**
- **Don't hedge a permanent decision as if it were temporary.**
- **Don't describe the other side of a boundary.**

## What earns a document

**The code is the source of truth for anything the code can answer.** A markdown file earns its
place only when it records what the code cannot: intent and why-not, what is deliberately unbuilt,
work planned but not built.

- **A plan for shipped work is deleted** once each part has moved to the file its header declares.
- **A doc never cites a plan by path**: plan paths die on delivery.
- **Decisions are written as current state with a date.** The sequence — what was decided first and
  later reversed — goes verbatim to `docs/history/` in the same change; the history check enforces
  it.
- **This file holds only what constrains code that doesn't exist yet, and stays under 300 lines.**

## `CHANGELOG.md`

None until the first tagged release; from then on written only with the human's approval.

## Language

**Everything in this repository is in English**: code, comments, docs, plans, commit messages. The
conversation with the human may be in Spanish. User-visible strings are English in the code and
translated through the i18n catalogs.
