# Agent state

What each running agent is doing — **working**, **blocked** (waiting on an approval or a question),
**idle** (ready for input) or **done** (finished while nobody was looking) — read from the terminal's
title and screen for Claude Code and from the prompts for Cursor (a simplified port of herdr's
agent-detection rules, herdr.dev, Apache-2.0); how a state rolls up to a tab, to the session's row
and to the blocked count on the project dropdown; the notifications and sound when an agent nobody
is watching finishes or needs the user; and the two jump dialogs, the quick switcher and Go to agent.
Index rows: **F30–F34**; keys **K10, K35, K41, K42**.

## Behaviour

### When the state is read (F30)

- Built: `docs/agent-state.md` describes how; `src/core/` holds it.

### Claude Code's rules

- Built: `docs/agent-state.md` describes how; `src/core/` holds it.

### Cursor's rules

- Built: `docs/agent-state.md` describes how; `src/core/` holds it.

### From raw state to shown state: done and seen

- Built: `docs/agent-state.md` describes how; `src/core/` holds it.

### Roll-up (F30)

- Built and tested: `docs/agent-state.md` describes how; `src/core/agentstate/` and `src/renderer/app.ts` hold it.

### Blocked count (F31)

- Built and tested: `docs/agent-state.md` describes how; `src/core/agentstate/` and `src/renderer/app.ts` hold it.

### Notifications and sound (F32)

- Built: `docs/agent-state.md` describes how; `src/core/` holds it.

### Quick switcher — `Ctrl+Shift+K` (F33, K10, K41, K42)

- Built and tested: `docs/window.md` describes how; `src/renderer/switcher.ts` and `src/renderer/app.ts` hold it.

### Go to agent — `Ctrl+B g` (F34, K35)

- Built and tested: `docs/window.md` describes how; `src/renderer/switcher.ts` and `src/renderer/app.ts` hold it.

## Data contracts

- Built and tested: `docs/agent-state.md` describes how; `src/core/agentstate/` and `src/renderer/app.ts` hold it.

## Acceptance cases

Every case is built and tested; `e2e/agent-panes.spec.ts`, `e2e/switcher.spec.ts` and
`tests/core/agentstate/` carry the ids.

Checked by hand (`plans/00-STATUS.md` §2): AST-28's desktop notification click, and AST-38 (need
real working or blocked agents).

## Look

- Built and tested: `docs/agent-state.md` describes how; `src/core/agentstate/` and `src/renderer/app.ts` hold it.
