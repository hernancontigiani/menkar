# Chat, MCP servers, Ghostty

What the app offers besides the embedded terminal: native streaming chat tabs driven by the agent's
headless mode, with permission cards for Claude Code (F50, M11, M36, K40); the MCP servers browser
(F52, M3); and opening a session in the Ghostty terminal (F53, M34). The question card over the
terminal (F51) is **not carried over** (decision 1.7); its subsection says so and has no acceptance
cases.

## Behaviour

### Chat variants: which agent offers which chat

- Built: `docs/chat.md` describes how; plan 14 built it.

### Starting a new chat (M11)

- Built: `docs/chat.md` describes how; plan 14 built it.

### Continuing a session in chat (M36)

- Built: `docs/chat.md` describes how; plan 14 built it.

### The chat tab

- Built: `docs/chat.md` describes how; plan 14 built it.

### The permission card (Claude only)

- Built: `docs/chat.md` describes how; plan 14 built it.

### Chat tabs among the other tabs

- Built: `docs/chat.md` describes how; plan 14 built it.

### MCP servers browser (F52, M3)

- Built: `docs/chat.md` describes how; plan 14 built it.

### Open in Ghostty (F53, M34)

- Built: `docs/chat.md` describes how; plan 14 built it.

### The question card — not carried over (F51)

- Decided against: decision 1.7.

## Data contracts

### Claude chat process (stdin stream)

- Built: `docs/chat.md` describes how; plan 14 built it.

### Cursor chat process (spawn resume)

- Built: `docs/chat.md` describes how; plan 14 built it.

### MCP config read

- Built: `docs/chat.md` describes how; plan 14 built it.

### Ghostty

- Built: `docs/chat.md` describes how; plan 14 built it.

## Acceptance cases

- Built and tested: the tests in `tests/core/chat/` and `e2e/chat.spec.ts` carry the CHT ids.
- Decided against: CHT-7 (a chosen location with no local path): Electron's folder chooser returns local paths only.

## Look

- Built: `src/renderer/chat.css` and `src/renderer/mcp.ts`; "the chat look" in `e2e/chat.spec.ts` asserts the bubbles, the tool chip and the permission card.
