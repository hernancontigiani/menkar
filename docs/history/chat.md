# History of `docs/chat.md`

> Replaced 2026-11-10: the MCP servers browser became a section of the Settings window. It was:
- **The MCP servers browser** is a modal child window (`openMcpServers`, `src/renderer/mcp.ts`). It
  reads `~/.claude.json` once, when it opens, and never writes it.

## Why

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
- **`Enter` still sends while a turn runs**, as agent-tablet's did: Claude queues the message after

> Replaced 2026-11-17: the variants come from the descriptors and each agent's chat is its kit's (plan 39, P0.7).
  - `variants.ts`: which agent offers which chat. Claude Code has one, a long-lived process fed over
    stdin, gated (every tool use asks). Cursor has `ask` (read-only) and `trusted` (runs edits and
    commands), one process per message.
  - `processes.ts`: the processes, Node only. A Claude chat starts at once; a Cursor chat starts a
    process per message, resuming the session id its first `init` line gave. Closing a tab hangs its
    process up; quitting closes them all.
