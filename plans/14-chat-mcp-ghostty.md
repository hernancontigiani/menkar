# Plan 14 — chat tabs, the MCP servers browser, Open in Ghostty

> **Status:** written 2026-11-08, ready to execute. Executed by `b2`, beside plan 13 (`b1`).
>
> **Exit, when executed:** `docs/chat.md` (new) with its row in `CLAUDE.md`'s docs table; the built
> parts of `docs/spec/chat.md` trimmed to pointers, removed lines to `docs/history/spec/`; `README.md`
> updated; the rest → `git log`.

## Goal

The last of agent-tablet's features: native chat tabs (Claude Code's stdin stream with its
permission card; Cursor's ask and trusted variants, one process per turn), starting a chat and
continuing a session in chat, the MCP servers browser, and Open in Ghostty — everything `chat.md`
specifies except the question card, which Menkar does not carry (decision 1.7).

## What it builds, from the spec

Read whole first: `docs/spec/README.md` (with its overriding decisions) and `docs/spec/chat.md`.
Every acceptance case of the carried features becomes a test (Vitest for the protocols and logic,
recorded and scrubbed replies in `tests/data/`; e2e under `xvfb-run` with a stand-in `claude` and
`cursor-agent`), named after its id, before the code, seen red. The permission card is not a terminal
keystroke: it answers through the chat process's own protocol, which the user drives by clicking —
decision 1.9's rule is about typing into a terminal.

## The design and the seam with plan 13 (`b1`)

- `src/core/chat/`: the variants, the two transports, the message model, the permission card's
  protocol; `src/main/chat.ts`: the processes, off the UI path, hung up on close.
- `src/renderer/chat.ts`: a chat view that renders into a container it is given, with its own CSS
  using `b1`'s look variables read-only.
- **Tabs are `b1`'s.** Mounting a chat view as a tab (the `+` menu items, "Continue in chat" in the
  history menu, the tab strip, closing) needs a hook in `b1`'s tab system. Build your view and core
  first; then name to `set` the one call you need (for example `openChatTab(variant, sessionId?)`
  creating a tab whose body is your view) and `set` arranges it with `b1`, who is adding file tabs
  and may expose a shared way to add a tab kind.
- **MCP servers** (F52, M3): a dialog of your own, opened from the ⚙ menu through an entry point you
  name (as Preferences was); `~/.claude.json` read only.
- **Open in Ghostty** (F53, M34): a main-side function; the menu item is `b1`'s, wired to your entry.

## Do not touch

`src/renderer/app.ts`, `look.ts`, `terminals.ts`, `addsession.ts`, `sessionmenus.ts`, the file-tab
modules, `src/main/workspace.ts`, `src/main/terminal.ts`, `src/main/files.ts` (`b1`); for those, ask
`set`.

## Execution blocks

### B1 — Chat core and the view
- [ ] Variants, transports, messages, the permission card's protocol; the view; tests.
- **Verification:** `npm run ci`.

### B2 — Tabs (with `b1`'s hook)
- [ ] Name the call to `set`; once the hook exists, the `+` items, Continue in chat, closing.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B3 — MCP servers and Ghostty
- [ ] The dialog and the Ghostty function with their entry points.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B4 — Exit
- [ ] The exit's files.
- **Verification:** `npm run ci`.

## Execution log

(Written by the session that executes it.)
