# History of `docs/chat.md`

> Replaced 2026-11-10: the MCP servers browser became a section of the Settings window. It was:
- **The MCP servers browser** is a modal child window (`openMcpServers`, `src/renderer/mcp.ts`). It
  reads `~/.claude.json` once, when it opens, and never writes it.

## Why

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
- **`Enter` still sends while a turn runs**, as agent-tablet's did: Claude queues the message after
