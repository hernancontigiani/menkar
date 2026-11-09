# Remote Control

Remote Control lets a Claude Code session be driven from the phone and claude.ai/code, as one
started with `claude --remote-control`. The app turns it on **per session, off by default**: a
switch on Add session → New's name step, and a "Remote control" check in the session's row menu and
its tab menu; the choice is kept in `state.json` and passed as `--remote-control=<name>` every time
the app starts or resumes that session. A phone icon on the session's row shows it. Nothing is ever
typed into a running session to connect or disconnect it. Index rows: **F49**, menu items **M17**
(tab menu) and **M21** (session row menu). Decision source: agent-tablet 1.26 (2026-11-07); Menkar
1.8 imports agent-tablet's Remote Control list on first start. How the command line is built and
typed is `terminal.md`; the New page around the switch is `sessions.md`.

## Behaviour

### Who can have it

- Built and tested: `docs/sessions.md` describes how; `src/core/remote.ts` and `src/main/workspace.ts` hold it.

### On from New (the switch)

- Built and tested: `docs/sessions.md` describes how; `src/core/remote.ts` and `src/main/workspace.ts` hold it.

### On or off from a menu (M17, M21)

- Built and tested: `docs/sessions.md` describes how; `src/core/remote.ts` and `src/main/workspace.ts` hold it.

### The name it connects under

- Built and tested: `docs/sessions.md` describes how; `src/core/remote.ts` and `src/main/workspace.ts` hold it.

### The phone icon on the row

- Built and tested: `docs/sessions.md` describes how; `src/core/remote.ts` and `src/main/workspace.ts` hold it.

### What it does not do

- Built and tested: `docs/sessions.md` describes how; `src/core/remote.ts` and `src/main/workspace.ts` hold it.

## Data contracts

### The CLI flag

- Built and tested: `docs/sessions.md` describes how; `src/core/remote.ts` and `src/main/workspace.ts` hold it.

### `state.json`

- Built and tested: `docs/sessions.md` describes how; `src/core/remote.ts` and `src/main/workspace.ts` hold it.

### Per running pane

- Built and tested: `docs/sessions.md` describes how; `src/core/remote.ts` and `src/main/workspace.ts` hold it.

## Acceptance cases

Every case is built and tested; `e2e/remote.spec.ts` and `tests/core/remote.test.ts`
carry the ids.

## Look

- Built and tested: `docs/sessions.md` describes how; `src/core/remote.ts` and `src/main/workspace.ts` hold it.
