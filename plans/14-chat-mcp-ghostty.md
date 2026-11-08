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
- [x] Variants, transports, messages, the permission card's protocol; the view; tests.
- **Verification:** `npm run ci`.

### B2 — Tabs (with `b1`'s hook)
- [x] Name the call to `set`; once the hook exists, the `+` items, Continue in chat, closing.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B3 — MCP servers and Ghostty
- [x] The dialog and the Ghostty function with their entry points.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B4 — Exit
- [x] The exit's files.
- **Verification:** `npm run ci`.

## Execution log

Executed by `b2`, 2026-11-08.

**B1 — core and view.** `src/core/chat/{variants,protocol,model,markdown,mcp,ghostty,processes}.ts`,
`src/main/chat.ts` (Electron's side: the folder chooser, `chat:event`, the IPC), `src/renderer/chat.ts`
and `chat.css` (`mountChat`). IPC in my blocks of `src/shared/ipc.ts` and `src/preload/index.ts`;
strings in both catalogs. Tests: `tests/core/chat/{chat,processes}.test.ts`, with the stand-ins in
`tests/data/chat/` (`claude`, `cursor-agent`, `ghostty`).

**B2 — tabs.** The hook named to `set` and built by `b1`: `openChatTab` in `src/main/workspace.ts`, the
`.chat-host` body that calls `mountChat`, closing by any path calling `closeChat`, and the `+` and
history menu items. Tests: `e2e/chat.spec.ts` (a new Claude chat with its folder, message and
permission card; Continue in chat, with the chat not saved, not reopened and not asked about when
the window closes; a Cursor `ask` chat).

**B3 — MCP servers and Ghostty.** `openMcpServers` in `src/main/windows.ts`, `src/renderer/mcp.{html,ts}`,
the renderer input in `electron.vite.config.ts`, `mcp:sections`; `openInGhostty` and
`ghosttyInstalled` in core. Tests: core, and `e2e/chat.spec.ts` (MCP's sections, read only;
Ghostty's arguments).

**B4 — exit.** `docs/chat.md` and its `CLAUDE.md` row, "Chat, MCP servers and Ghostty" in
`README.md`; `docs/spec/chat.md` trimmed (left: the question card, not carried, and CHT-4, CHT-7,
CHT-13's trusted banner, CHT-27, CHT-28), removed lines verbatim in `docs/history/spec/chat.md`.

Also in this plan, at `set`'s request: **CTX-22 was flaky under load**, because it raced the
statusline's real 2-second limit on its chained command. `runStatusline` and `chainedBar` now take
the limit (default `CHAINED_TIMEOUT_MS`, 2 s). CTX-22 runs in-process with a generous limit; the
over-the-limit case uses a tiny one and a sleeping command; and a test holds the constant at 2 s.

Deviations and what the plan did not anticipate:
- **The processes moved from main into core** (`processes.ts`, Node only), so Vitest drives them with
  stand-ins. Main keeps only Electron's part.
- **The stand-ins are ES modules**: the repository's `"type": "module"` makes Node read an
  extensionless script as ESM.
- **My registration in `src/main/index.ts` (`registerChatIpc`, `closeAllChats` on quit) was lost once**
  to a concurrent rewrite of that file. The chat e2e tests caught it (no view, no MCP sections), and it
  is restored. Every other line of mine in the shared files was checked present.
- **`Enter` still sends while a turn runs**, as agent-tablet's did (the spec left it to Menkar).
- **Mutations**: about 20 on the core and process tests, all caught. Two were first missed (the
  permission body's field order, Ghostty without the agent's CLI) and their tests strengthened.
