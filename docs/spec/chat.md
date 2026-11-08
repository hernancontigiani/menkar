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

agent-tablet has it; Menkar does not, by decision 1.7. What it did: over a Claude terminal, when the
transcript showed an `AskUserQuestion` tool call, a card listed the question's options, and
clicking one typed the arrow-key and Enter keystrokes for that answer into the agent's terminal,
with "Answer in terminal" to dismiss it.

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

- CHT cases not listed below: built; the tests in `tests/core/chat/` and `e2e/chat.spec.ts` carry their ids.

**New chat**

- CHT-4. `new_session_dir` = `/home/user/src/todo-api` (exists); choose "New Claude Code chat…" →
  the folder chooser titled "Choose project directory" opens in that folder.
- CHT-7. The chooser returns a remote location with no local path → error dialog "Choose a local
  folder" / "This location is not on this computer. Choose a folder or file on a local disk."; no
  tab.

**Chat tab**

- CHT-13. Banners: Claude → "Chat with Claude Code — every file edit and command asks your
  permission first."; Cursor ask → "Read-only chat with Cursor — analyses and answers, never
  edits."; Cursor trusted → "Chat with Cursor — ⚠ runs edits and commands automatically, without
  asking."
- CHT-27. A user message "**not bold**" → shown with the asterisks, plain.
- CHT-28. Scrolled 200 px above the bottom while text streams → the view does not move; scrolled
  back to within 48 px → it follows again.

## Look

There is no reference screenshot of a chat tab or of the MCP servers dialog. Measurements from the
code; the colors named `@window_bg_color` etc. are theme tokens defined in `look.md`.

**Chat tab**

| Element | Detail |
|---|---|
| Banner | dim label, left-aligned; margins top 6 px, start and end 12 px |
| Conversation | vertical list, 8 px between items; margins 10 px top and bottom, 12 px start and end; scrolls vertically only |
| Compose row | horizontal, 6 px spacing; margins start 12, end 12, top 6, bottom 12 px; entry expands; then Stop, then Send |
| Send button | icon "document-send-symbolic" (a paper plane); accented (suggested action) |
| Stop button | icon "process-stop-symbolic" (a stop sign); plain; visible only while a turn runs |
| Bubble (both) | padding 8 px 12 px; corner radius 14 px; wraps at word or character; at most 64 characters wide; selectable |
| User bubble | right-aligned; background `#D97757`; text white |
| Assistant bubble | left-aligned; background the current text color at 8 % alpha |
| Typing indicator | an assistant bubble holding a spinner and "{name} is thinking…", 8 px apart |
| Tool chip | "🔧 " + text, left-aligned, wrapping; font size 0.85 em; opacity 0.6; padding 2 px 4 px |
| Notice | dim label, wrapping, left-aligned |
| Permission card | vertical, 8 px spacing; background `@window_bg_color`; border 1 px `#D97757` at 60 % alpha; radius 12 px; padding 12 px; shadow 0 2 px 12 px black at 35 % alpha |
| Card header | color `#D97757`, bold, 0.85 em |
| Card body | dim label, wrapping, at most 64 characters wide, selectable |
| Card buttons | right-aligned row, 8 px spacing: Deny (plain), Always allow (plain), Allow once (accented) |

**MCP Servers dialog**: a dialog 540 × 600 px with a header bar (title "MCP Servers", subtitle
"Read-only") over a preferences page; each section a titled group with a description; each server
a two-line row (title the name; subtitle the summary, shown in full on as many lines as it needs,
in the "property" style: the subtitle in the regular text color and the title dimmed).

**Tab strip**: a chat tab shows its title with the idle state dot and no context ring (see
`projects.md` and `look.md` for the tab's look).
