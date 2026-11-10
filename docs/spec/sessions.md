# Sessions

Finding every session the installed agents have on disk (Claude Code's and Cursor's), the name a
session shows, the history browser and its rows (the **Existing** page of Add session), the
project list's rows as far as the session goes, a session's details, export as Markdown,
copy ID and reveal, hide / unhide, move to trash, delete permanently, select mode, the **New** page
of Add session, and the one-time import of agent-tablet's own data on Menkar's first start.
Index rows: **F1–F14** (F5 shared with `projects.md`; F14 replaced, see "First start"), **K1, K2,
K28, K32**, **M2, M7, M14, M26–M31, M33, M37–M45**. What a tab runs (commands, flags) is in
`terminal.md`; the agent states and the dot colors of a running session in `agent-state.md`; the
context ring in `context.md`; Remote Control in `remote-control.md`; projects, groups and windows
in `projects.md`; the Ghostty, fork and chat items of the history menu (M34–M36) in `chat.md` and
`terminal.md`.

## Behaviour

### Discovery (F1)

- Built and tested: `docs/sessions.md` describes how; `src/core/sessions/` and `src/renderer/addsession.ts`, `sessionmenus.ts` hold it.

### A session's name (F2)

- Built and tested: `docs/sessions.md` describes how; `src/core/sessions/` and `src/renderer/addsession.ts`, `sessionmenus.ts` hold it.

### Waiting and interrupted badges (F3)

- Built and tested: `docs/sessions.md` describes how; `src/core/sessions/` and `src/renderer/addsession.ts`, `sessionmenus.ts` hold it.

### The history browser (F4)

- Built and tested: `docs/sessions.md` describes how; `src/core/sessions/` and `src/renderer/addsession.ts`, `sessionmenus.ts` hold it.

### A history row

- Built and tested: `docs/sessions.md` describes how; `src/core/sessions/` and `src/renderer/addsession.ts`, `sessionmenus.ts` hold it.

### The history row menu (M33–M45)

- Built and tested: `docs/sessions.md` describes how; `src/core/sessions/` and `src/renderer/addsession.ts`, `sessionmenus.ts` hold it.

### Add session → Existing: Add, Added, Move from (F5)

- Built and tested: `docs/sessions.md` describes how; `src/core/sessions/` and `src/renderer/addsession.ts`, `sessionmenus.ts` hold it.

### Add session → New (F6, K1, K28, M7)

- Built and tested: `docs/sessions.md` describes how; `src/core/sessions/` and `src/renderer/addsession.ts`, `sessionmenus.ts` hold it.

### The project list's rows (the session's part)

- Built and tested: `docs/sessions.md` describes how; `src/core/sessions/` and `src/renderer/addsession.ts`, `sessionmenus.ts` hold it.

### Session details (F7, M27, M38)

- Built and tested: `docs/sessions.md` describes how; `src/core/sessions/` and `src/renderer/addsession.ts`, `sessionmenus.ts` hold it.

### Export as Markdown (F8, M30, M41)

- Built and tested: `docs/sessions.md` describes how; `src/core/sessions/` and `src/renderer/addsession.ts`, `sessionmenus.ts` hold it.

### Copy session ID and reveal transcript (F10, M14, M29, M31, M40, M42)

- Built and tested: `docs/sessions.md` describes how; `src/core/sessions/` and `src/renderer/addsession.ts`, `sessionmenus.ts` hold it.

### Hide and show hidden (F11, M2, M43)

- Built and tested: `docs/sessions.md` describes how; `src/core/sessions/` and `src/renderer/addsession.ts`, `sessionmenus.ts` hold it.

### Move to trash and delete permanently (F12, M44, M45)

- Built and tested: `docs/sessions.md` describes how; `src/core/sessions/` and `src/renderer/addsession.ts`, `sessionmenus.ts` hold it.

### Select mode (F13)

- Built and tested: `docs/sessions.md` describes how; `src/core/sessions/` and `src/renderer/addsession.ts`, `sessionmenus.ts` hold it.

### First start: importing agent-tablet's data (decision 1.8)

- Built and tested: `docs/sessions.md` describes how; `src/core/sessions/` and `src/renderer/addsession.ts`, `sessionmenus.ts` hold it.

## Data contracts

### Paths

- Built and tested: `docs/sessions.md` describes how; `src/core/sessions/` and `src/renderer/addsession.ts`, `sessionmenus.ts` hold it.

### Claude Code transcript lines

- Built and tested: `docs/sessions.md` describes how; `src/core/sessions/` and `src/renderer/addsession.ts`, `sessionmenus.ts` hold it.

### Cursor transcript lines

- Built and tested: `docs/sessions.md` describes how; `src/core/sessions/` and `src/renderer/addsession.ts`, `sessionmenus.ts` hold it.

### Formats shown

- Built and tested: `docs/sessions.md` describes how; `src/core/sessions/` and `src/renderer/addsession.ts`, `sessionmenus.ts` hold it.

### Menkar's `state.json` (this area's keys)

- Built and tested: `docs/sessions.md` describes how; `src/core/sessions/` and `src/renderer/addsession.ts`, `sessionmenus.ts` hold it.

### agent-tablet's `projects.json` (import source)

- Built and tested: `docs/sessions.md` describes how; `src/core/sessions/` and `src/renderer/addsession.ts`, `sessionmenus.ts` hold it.

### agent-tablet's `state.json` (import source)

- Built and tested: `docs/sessions.md` describes how; `src/core/sessions/` and `src/renderer/addsession.ts`, `sessionmenus.ts` hold it.

## Acceptance cases

Every case is built and tested; `e2e/sessions-cases.spec.ts`, `e2e/addsession.spec.ts`,
`e2e/projects.spec.ts`, `tests/core/sessions/` and `tests/core/projects/` carry the ids.

SES-44's path through the UI is unreachable by design: deleting a project closes its tabs, the new
session's with them, so it never joins; the fallback is tested in core (`joinTarget`).

Checked by hand (`plans/00-STATUS.md` §2): SES-64, SES-66, SES-68 (the desktop's trash).

## Look

- Built and tested: `docs/sessions.md` describes how; `src/core/sessions/` and `src/renderer/addsession.ts`, `sessionmenus.ts` hold it.
