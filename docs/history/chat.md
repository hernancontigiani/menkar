# History of `docs/chat.md`

> Replaced 2026-11-10: the MCP servers browser became a section of the Settings window. It was:
- **The MCP servers browser** is a modal child window (`openMcpServers`, `src/renderer/mcp.ts`). It
  reads `~/.claude.json` once, when it opens, and never writes it.
