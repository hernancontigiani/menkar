# Chat tabs, the MCP servers browser, Open in Ghostty — how they are built

The code says what each part does. This file keeps why it is shaped this way.

## The shape

- **`src/core/chat/`**, tested on plain Node:
  - `variants.ts`: which agent offers which chat. Claude Code has one, a long-lived process fed over
    stdin, gated (every tool use asks). Cursor has `ask` (read-only) and `trusted` (runs edits and
    commands), one process per message.
  - `protocol.ts`: each process's argv, the lines written to Claude's stdin (a message, a
    permission's allow or deny), and what each stdout line means, as `ChatEvent`s. `LineSplitter`
    keeps a partial line until the rest arrives.
  - `model.ts`: a chat tab's conversation as data (bubbles, tool chips, permission cards and their
    outcomes, notices), the "always allow" list of the tab, and the reply a card's answer sends. It
    translates nothing; the view says each item in the UI's language.
  - `markdown.ts`: the subset an assistant bubble renders, as blocks and spans. The view builds DOM
    nodes from them and never parses HTML.
  - `processes.ts`: the processes, Node only. A Claude chat starts at once; a Cursor chat starts a
    process per message, resuming the session id its first `init` line gave. Closing a tab hangs its
    process up; quitting closes them all.
  - `mcp.ts`: `~/.claude.json`'s servers as sections. `ghostty.ts`: Ghostty's arguments.
- **`src/main/chat.ts`**: Electron's part. It holds the folder chooser (remembered as
  `new_session_dir` through `sessions.updateState()`), sends a chat's events to the windows
  (`chat:event`), and the IPC the view uses (`chat:info`, `:send`, `:reply`, `:stop`,
  `mcp:sections`).
- **`src/renderer/chat.ts`**, `mountChat(container, chatId)`: the view a chat tab's body mounts. It
  keeps the model, sends messages, and answers cards through `chat:reply` with the denial sentence
  in the UI's language. b1's tab system owns the tab: `openChatTab` creates it, its body calls
  `mountChat`, and closing it calls `closeChat`.
- **The MCP servers browser** is a section of the Settings window (2026-11-10;
  `src/renderer/mcp.ts`). It reads `~/.claude.json` each time the section is shown, and never
  writes it.

## Why

- **The permission card answers through the chat process's own protocol** (a `control_response`
  on stdin), driven by the user's click. Nothing is typed into a terminal, so decision 1.9's rule
  does not apply. The question card, which did type into a terminal, is not carried (decision 1.7).
- **The model lives in the view, the processes in main.** The always-allowed list belongs to the
  tab and is never saved. When a tool is always allowed, the view answers at once through
  `chat:reply`, so main never needs to know about cards.
- **The processes are in core, not in main**, so Vitest drives them with the stand-ins in
  `tests/data/chat/` (`claude`, `cursor-agent`, `ghostty`; ES modules, since the repository's
  `"type": "module"` makes Node read an extensionless script as one). The real CLIs never run in a
  test.
- **Errors are our sentences**: a missing or failing CLI says so through `t()`, not with an
  exception's text.
- **`Enter` still sends while a turn runs**: Claude queues the message after
  the current turn, and Cursor starts a second process beside the first. Only the Send button is
  disabled.
