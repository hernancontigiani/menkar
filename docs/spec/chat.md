# Chat, MCP servers, Ghostty

What the app offers besides the embedded terminal: native streaming chat tabs driven by the agent's
headless mode, with permission cards for Claude Code (F50, M11, M36, K40); the MCP servers browser
(F52, M3); and opening a session in the Ghostty terminal (F53, M34). The question card over the
terminal (F51) is **not carried over** (decision 1.7); its subsection says so and has no acceptance
cases.

## Behaviour

### Chat variants: which agent offers which chat

A chat variant is one way to start a chat with an agent. Each has a key, a transport, whether its
tools may write (`writeable`), whether each tool use is approved one by one (`gated`), and a mode
label for menus (empty when it is the agent's only variant). An agent offers its variants only when
its CLI is on the `PATH`; with the CLI missing it offers none, and no chat item appears for it.

| Agent | Key | Transport | Writeable | Gated | Mode label (menus) |
|---|---|---|---|---|---|
| Claude Code (`claude`) | `default` | one long-lived process fed over stdin ("stdin stream") | yes | yes | — (sole variant) |
| Cursor (`cursor-agent`) | `ask` | one process per turn, resuming the session ("spawn resume") | no | no | "ask, read-only" |
| Cursor (`cursor-agent`) | `trusted` | one process per turn, resuming the session | yes | no | "trusted, auto-run" |

Cursor's headless mode cannot pause a tool for approval, so it gets two explicit levels instead of
permission cards: a read-only one and one that runs edits and commands without asking.

### Starting a new chat (M11)

- The `+` split button's menu lists, after "Open file…" and before "New window", one item per chat
  variant of every installed agent: "New {name} chat…" for a sole variant (Claude Code: "New Claude
  Code chat…"), "New {name} chat ({mode})" otherwise (Cursor: "New Cursor chat (ask, read-only)",
  "New Cursor chat (trusted, auto-run)"). The mode label goes through t().
- Choosing one opens the system folder chooser titled "Choose project directory", starting in the
  remembered new-session folder (the `new_session_dir` setting, see `preferences.md`) when that is an
  existing directory.
- Cancelling the chooser does nothing.
- A location that is not on this computer (no local path) shows an error dialog, heading "Choose a
  local folder", body "This location is not on this computer. Choose a folder or file on a local
  disk.", button "OK"; no tab opens.
- A local folder is remembered as `new_session_dir` and a chat tab opens in the current project,
  selected, titled "Chat — {dir}" (the folder's base name), with the tooltip "{agent} chat — {full
  path}" (e.g. "Claude Code chat — /home/user/src/todo-api").
- For the Claude variant the process starts at once; for a Cursor variant nothing runs until the
  first message is sent.

### Continuing a session in chat (M36)

- The history row's menu (Add session → Existing, right-click) has, in its first section after
  "Open", "Open in Ghostty" and "Fork session", one item per chat variant of the row's agent:
  "Continue in chat" for a sole variant (Claude Code), "Continue in chat ({mode})" otherwise
  (Cursor: "Continue in chat (ask, read-only)", "Continue in chat (trusted, auto-run)").
- Choosing one opens a chat tab in the current project that resumes that session id, in the
  session's folder, titled "Chat — {name}" (the session's display name), tooltip "{agent} chat —
  {session id}".
- The chat shows, under its banner, the notice "Continuing the previous session — earlier messages
  aren't shown here." The earlier conversation is not drawn in the chat; only new turns are.
- A session that has disappeared from the store by the time the item is chosen: nothing happens.
- Continuing a session in chat does not check whether the same session is already running in a
  terminal tab: both run against the same session id.

### The chat tab

From top to bottom: a banner line, the conversation (scrolling), the compose row.

- **Banner** (dim text), by variant:
  - read-only: "Read-only chat with {name} — analyses and answers, never edits."
  - writeable and gated: "Chat with {name} — every file edit and command asks your permission
    first."
  - writeable, not gated: "Chat with {name} — ⚠ runs edits and commands automatically, without
    asking."
- **Compose row**: a one-line text entry with the placeholder "Ask {name}…" (e.g. "Ask Claude
  Code…"), a Stop button (tooltip "Stop", hidden unless a turn is running) and a Send button
  (tooltip "Send"). The entry has keyboard focus when the tab opens.
- **Sending** (K40: `Enter` without `Shift`, or Send): the entry's text, trimmed; empty text sends
  nothing. The entry clears, the message appears as a user bubble on the right, a typing indicator
  ("{name} is thinking…" with a spinner, in an assistant-style bubble) appears on the left, Send is
  disabled and Stop shown. The input is a single line; there is no multi-line compose.
  - Send is disabled while a turn runs, but `Enter` is not: a message typed and entered during a
    turn is sent too (Claude: written to the running process, which takes it after the current
    turn; Cursor: a second per-turn process starts beside the first). Found in the code; Menkar
    should decide whether `Enter` is held while busy.
- **Streaming text**: the agent's text arrives in pieces and grows one assistant bubble on the left
  as it arrives; the typing indicator goes when the first piece arrives. Thinking text is received
  but not shown.
- **Tool use**: when the agent starts a tool, the typing indicator goes and a tool chip "🔧 {tool}"
  is appended (Claude: the tool's name, e.g. "🔧 Bash"; Cursor: derived from its tool-call key,
  `editToolCall` → "Edit", `readToolCall` → "Read"). Text after a tool starts a new assistant
  bubble.
- **Turn end**: the typing indicator goes, Send is enabled, Stop hidden; the next text starts a new
  bubble. The turn's cost reported by Claude is not shown.
- **Stop**: interrupts the running turn (sends SIGINT to the agent's process). For Cursor the
  per-turn process ends and the chat is ready for the next message (an empty turn end unblocks the
  input). For Claude the signal goes to the long-lived process; what `claude -p` does with it is
  whatever the CLI does — if it exits, the chat ends as below.
- **Rate limit**: a rate-limit report whose status is anything other than `allowed` appends the
  notice "Rate limited — try again later."
- **Error**: an error result appends the notice "Error: {msg}", where `{msg}` is the CLI's own
  result text (or its API error status, or "error"); the typing indicator goes and Send is enabled.
  - The CLI missing from the `PATH` when a chat is about to open (it was there when the menu
    was built): no tab opens and nothing is shown. Missing when a process is started for an open
    chat (a Cursor turn): agent-tablet shows
    "`claude` not found in PATH" (not translated). The process failing to start: agent-tablet
    shows the operating system's error text. Menkar shows its own sentences through t() instead
    (rule: an error shown to the user is our own sentence), e.g. "Error: {cli} is not installed or
    not on the PATH." and "Error: {cli} could not be started."
- **Session ended** (Claude only: the long-lived process exited, for any reason): the notice
  "Session ended." appears once, the entry and Send are disabled for good. The tab stays open.
  Cursor never shows it: its processes are per turn.
- **Notices** are dim, wrapping lines in the conversation.
- **Scrolling**: the view follows the bottom while the user is within 48 px of it; scrolling up
  further stops following until they scroll back down. Following is applied at most every 60 ms.
- **Assistant text is rendered from Markdown**, a subset: fenced code blocks and inline code in a
  monospace font; a heading line (`#` to `######`) as bold text; `**bold**` as bold; a line starting
  with `-` or `*` as a bullet "• " keeping its indentation. Nothing else (no links, italics,
  tables). Text that cannot be rendered falls back to plain text. User bubbles are always plain
  text. All bubble text is selectable.

### The permission card (Claude only)

Every tool use of the Claude chat pauses for the user's approval (the process is started with the
permission prompt routed to the app; without it the default mode would silently deny every tool).

- When the agent asks, the typing indicator goes and a card is appended to the conversation:
  - header: "{name} wants to use {tool}" (e.g. "Claude Code wants to use Bash"), where `{tool}` is
    the request's display name, else its tool name;
  - body (dim, wrapping, selectable), when there is one: the request's description, else the first
    non-empty string among the tool input's `command`, `file_path`, `path`, `pattern`, `url`,
    `prompt` (trimmed); no body when none;
  - buttons, right-aligned, in this order: "Deny", "Always allow {tool}", "Allow once" (the
    suggested, accented one).
- **Allow once**: the tool runs with its input unchanged. **Always allow {tool}**: the same, and
  every later request for the same tool name in this chat tab is allowed without a card, appending
  the chip "🔧 Auto-allowed {tool}". The always-allowed list belongs to the tab: it is not saved and
  a new chat starts empty. **Deny**: the tool does not run and the agent is told "The user declined
  this action." (the sentence goes through t(), so the agent receives it in the UI's language).
- After any answer the card is removed (it cannot be clicked twice) and a chip records the outcome:
  "🔧 Allowed {tool}.", "🔧 Always allowing {tool}." or "🔧 Denied {tool}."; the typing indicator
  shows again.
- Several requests may stand at once; each card is answered on its own.
- Cursor chats have no cards: `ask` cannot edit, `trusted` runs everything (its banner says so).

### Chat tabs among the other tabs

- A chat tab belongs to the project that was current when it opened, like a terminal tab, but its
  session is not added to the project, it is not saved in the layout and does not reopen on start
  (agent-tablet decision 1.17).
- It is not a running session for the close-window and quit confirmations, nor for the blocked
  count: its tab's state dot is always idle and it has no context ring.
- Closing the tab (its ×, middle click, `Ctrl+Shift+W`, the tab menu's Close) closes it at once,
  without `/exit` and without asking: the Claude process's stdin is closed and it is terminated;
  a running Cursor turn is terminated.
- The chat's work is real: Claude and Cursor write their own transcript for it, so the session
  shows up in the history like any other once its transcript exists.

### MCP servers browser (F52, M3)

- Main menu → "MCP servers" opens a dialog titled "MCP Servers" with the subtitle "Read-only". It
  only reads; nothing can be changed from it.
- It reads Claude Code's user config file `~/.claude.json` once, when it opens.
- Sections:
  - "Global", description "Available to every project": the servers under the file's top-level
    `mcpServers`, sorted by name. Shown only when there is at least one.
  - One section per project that defines servers of its own (`projects.<path>.mcpServers`, non-empty),
    sorted by path: title the path's base name, description the full path; its servers sorted by
    name.
- Each server is a row: title its name, subtitle a summary (wrapping, never cut):
  - with a `url`: "{type} · {url}", `type` defaulting to `http`;
  - else with a `command`: "{type} · {command} {args joined by spaces}", `type` defaulting to
    `stdio`, trimmed;
  - else the `type`, or "—".
- No servers at all, a missing file, unreadable file, invalid JSON or JSON that is not an object:
  one row "No MCP servers configured".
- Not read: a project's `.mcp.json`, `~/.claude/settings.json`, plugin servers, Cursor's MCP
  configuration. (The same file also feeds the "MCP" section of Session details, in `sessions.md`.)

### Open in Ghostty (F53, M34)

- The history row's menu shows "Open in Ghostty" only when `ghostty` is on the `PATH` (agent-tablet
  checks once, at start).
- It starts, detached from the app (its own process session, outliving the app):
  `ghostty --working-directory=<cwd> -e <agent cli> --resume <session id>` — `<agent cli>` is the
  bare name (`claude` or `cursor-agent`), `<cwd>` the session's folder when it exists, else the
  home folder.
- Nothing happens when the agent's CLI is not on the `PATH`, or the session is no longer known.
  No `--settings` (so no app statusline), no Remote Control, no tab in the app; the session in
  Ghostty is not tracked by the app.

### The question card — not carried over (F51)

agent-tablet has it; Menkar does not, by decision 1.7. What it did: over a Claude terminal, when the
transcript showed an `AskUserQuestion` tool call, a card listed the question's options, and
clicking one typed the arrow-key and Enter keystrokes for that answer into the agent's terminal,
with "Answer in terminal" to dismiss it.

## Data contracts

### Claude chat process (stdin stream)

Started once per chat tab, in the chat's folder (the home folder when the folder does not exist),
stdin and stdout piped, stderr merged into stdout:

```
<path of claude> -p --input-format stream-json --output-format stream-json \
  --include-partial-messages --verbose --permission-mode default \
  --permission-prompt-tool stdio [--resume <session id>]
```

- `--verbose` is required by the CLI with `--output-format stream-json`.
- `--permission-prompt-tool stdio` routes each tool permission through the stdio control channel;
  without it `--permission-mode default` denies every tool silently.
- No `--settings`, no `-n`, no `--remote-control`: the chat carries none of the terminal session
  flags.

**Written to stdin**, one JSON object per line:

| When | Line |
|---|---|
| A message is sent | `{"type":"user","message":{"role":"user","content":[{"type":"text","text":"<text>"}]}}` |
| A permission is allowed | `{"type":"control_response","response":{"subtype":"success","request_id":"<id>","response":{"behavior":"allow","updatedInput":<the request's input, unchanged, {} if none>}}}` |
| A permission is denied | `{"type":"control_response","response":{"subtype":"success","request_id":"<id>","response":{"behavior":"deny","message":"The user declined this action."}}}` |

Writes to a process that has exited are dropped silently.

**Read from stdout**, one JSON object per line (a partial line waits for the rest; a line that is
blank, not JSON or not an object is skipped; bytes are decoded as UTF-8 with replacement):

| Line | Fields read | Meaning |
|---|---|---|
| `type: "system"`, `subtype: "init"` | `session_id` | The session's id; kept as the chat's id |
| `type: "stream_event"`, `event.type: "content_block_start"` | `event.index`, `event.content_block.type`, `.name` | A block starts; a `tool_use` block is a tool chip with `name` |
| `type: "stream_event"`, `event.type: "content_block_delta"` | `event.delta.type` = `text_delta` (`.text`) or `thinking_delta` (`.thinking`) | A piece of text (shown) or thinking (not shown) |
| `type: "control_request"`, `request.subtype: "can_use_tool"` | `request_id`; `request.display_name`, `.tool_name`, `.input`, `.description`, `.tool_use_id` | A permission request |
| `type: "rate_limit_event"` | `rate_limit_info.status`, `.resetsAt` (epoch seconds) | Rate-limit report; status other than `allowed` → notice |
| `type: "result"` | `is_error`; `result`; `api_error_status`; `total_cost_usd` | End of a turn, or an error |
| Anything else (including whole `assistant` / `user` messages) | — | Ignored: text comes only from the partial deltas |

Process exit (stdout closed) → "Session ended.".

### Cursor chat process (spawn resume)

One process per sent message, stdin from `/dev/null`, stdout piped, stderr merged:

```
<path of cursor-agent> -p --output-format stream-json --stream-partial-output --trust \
  [--resume <session id>] (--force | --mode ask) <message>
```

- `--trust` skips the workspace-trust prompt, required headless. `trusted` adds `--force` (runs
  edits and commands); `ask` adds `--mode ask` (read-only). The message is the last argument.
- The session id comes from the first turn's `init` line; later turns pass `--resume` with it.

| Line | Fields read | Meaning |
|---|---|---|
| `type: "system"`, `subtype: "init"` | `session_id` | The session's id |
| `type: "thinking"`, `subtype: "delta"` | `text` | Thinking (not shown) |
| `type: "assistant"` **with** `timestamp_ms` | `message.content[]` blocks of `type: "text"`, their `text` joined | A streamed piece of text |
| `type: "assistant"` **without** `timestamp_ms` | — | The final whole message repeating what streamed: skipped |
| `type: "tool_call"`, `subtype: "started"` | `tool_call`: the key ending in `ToolCall` | A tool chip; the name is the key without `ToolCall`, first letter upper-cased |
| `type: "result"` | `is_error`, `result` | End of the turn, or an error |

A per-turn process that exits without a `result` line (interrupted, crashed) ends the turn quietly:
the input unblocks, no notice.

### MCP config read

`~/.claude.json` (Claude Code's own file, read only, never written):

| Key | Type | Used as |
|---|---|---|
| `mcpServers` | object: name → server | Global servers |
| `projects` | object: absolute path → project | Projects |
| `projects.<path>.mcpServers` | object: name → server | That project's servers |
| server `.type` | string | Transport shown (`http` / `stdio` assumed when absent) |
| server `.url` | string | Remote server address |
| server `.command`, `.args` | string, array | Local server's command line |

### Ghostty

`ghostty` looked up on the `PATH`. Command as in Behaviour; started detached, its output not read,
its exit not watched.

## Acceptance cases

**Variants and menus**

- CHT-1. `claude` and `cursor-agent` both on the `PATH` → the `+` menu has, between "Open file…" and
  "New window", exactly: "New Claude Code chat…", "New Cursor chat (ask, read-only)", "New Cursor
  chat (trusted, auto-run)".
- CHT-2. Only `claude` on the `PATH` → the `+` menu has one chat item, "New Claude Code chat…"; a
  Claude history row's menu has "Continue in chat"; a Cursor history row (still listed from disk)
  has no chat item.
- CHT-3. A Cursor history row with `cursor-agent` installed → its menu has "Continue in chat (ask,
  read-only)" and "Continue in chat (trusted, auto-run)", after "Open" (and "Open in Ghostty" when
  installed), and no "Fork session".

**New chat**

- CHT-4. `new_session_dir` = `/home/user/src/todo-api` (exists); choose "New Claude Code chat…" →
  the folder chooser titled "Choose project directory" opens in that folder.
- CHT-5. Cancel the chooser → no tab opens, `new_session_dir` unchanged.
- CHT-6. Choose `/home/user/src/shop` → a tab "Chat — shop" opens in the current project, selected,
  tooltip "Claude Code chat — /home/user/src/shop"; `new_session_dir` becomes `/home/user/src/shop`;
  the process started is exactly the argv of Data contracts, with no `--resume`, its working
  directory `/home/user/src/shop`.
- CHT-7. The chooser returns a remote location with no local path → error dialog "Choose a local
  folder" / "This location is not on this computer. Choose a folder or file on a local disk."; no
  tab.
- CHT-8. New Cursor chat (ask) → the tab opens and no process exists until the first message is
  sent.

**Continue in chat**

- CHT-9. "Continue in chat" on a Claude session named "JWT auth", id `1b2c…` → tab "Chat — JWT auth",
  tooltip "Claude Code chat — 1b2c…", notice "Continuing the previous session — earlier messages
  aren't shown here.", process argv ending `--resume 1b2c…`, working directory the session's
  folder.
- CHT-10. Same, but the session's folder no longer exists → the process runs in the home folder.
- CHT-11. "Continue in chat (trusted, auto-run)" on Cursor session `9f8e…`, then send "hi" → one
  process `cursor-agent -p --output-format stream-json --stream-partial-output --trust --resume
  9f8e… --force hi`.
- CHT-12. Cursor `ask`, new chat, first message "list files" → argv ends `--trust --mode ask "list
  files"` with no `--resume`; its `init` line carries `session_id` `aa11…`; the second message's argv
  contains `--resume aa11…`.

**Chat tab**

- CHT-13. Banners: Claude → "Chat with Claude Code — every file edit and command asks your
  permission first."; Cursor ask → "Read-only chat with Cursor — analyses and answers, never
  edits."; Cursor trusted → "Chat with Cursor — ⚠ runs edits and commands automatically, without
  asking."
- CHT-14. Entry "   " and `Enter` → nothing is sent, nothing appended.
- CHT-15. Entry "  what is this repo?  " and `Enter` → stdin receives
  `{"type":"user","message":{"role":"user","content":[{"type":"text","text":"what is this repo?"}]}}`;
  a right-aligned user bubble "what is this repo?"; "Claude Code is thinking…" shown; Send disabled;
  Stop visible; entry empty.
- CHT-16. Stdout lines `content_block_delta` text_delta "Hel", then "lo **there**" → one assistant
  bubble whose text is "Hello there" with "there" bold; the thinking indicator is gone.
- CHT-17. A `content_block_delta` with `thinking_delta` only → nothing appended; the indicator
  stays.
- CHT-18. A `content_block_start` with `content_block: {"type":"tool_use","name":"Read"}` then a
  text delta "Done" → a chip "🔧 Read" followed by a new assistant bubble "Done" (not appended to
  the previous bubble).
- CHT-19. A `result` line with `is_error: false`, `result: "Done"`, `total_cost_usd: 0.03` → turn
  ends: indicator gone, Send enabled, Stop hidden; no cost shown.
- CHT-20. A `result` line with `is_error: true`, `result: "Prompt is too long"` → notice "Error:
  Prompt is too long"; Send enabled.
- CHT-21. A `result` with `is_error: true`, no `result`, `api_error_status: 529` → notice "Error:
  529".
- CHT-22. A `rate_limit_event` with status `allowed` → nothing; with status `rejected` → notice
  "Rate limited — try again later."
- CHT-23. The Claude process exits → notice "Session ended." once; entry and Send disabled; typing
  `Enter` sends nothing.
- CHT-24. A Cursor chat open, `cursor-agent` removed from the `PATH`, then a message sent → an
  error notice in the app's own words (not an exception's text, not "not found in PATH"
  untranslated); no process. `claude` removed after the `+` menu was built, then "New Claude Code
  chat…" and a folder chosen → no tab opens and nothing is shown (agent-tablet's behaviour).
- CHT-25. A stdout line split across two reads (`{"type":"res` + `ult",...}\n`) → parsed once as a
  whole line; a line `not json` → ignored, nothing shown.
- CHT-26. Markdown: assistant text "# Plan\n- one\n  * two\n`x`\n```\ncode\n```" → "Plan" bold, "•
  one", "  • two", `x` and `code` in monospace. Text "a < b & c" shows literally.
- CHT-27. A user message "**not bold**" → shown with the asterisks, plain.
- CHT-28. Scrolled 200 px above the bottom while text streams → the view does not move; scrolled
  back to within 48 px → it follows again.
- CHT-29. Cursor, Stop during a turn → the turn's process receives SIGINT; when it exits without a
  `result` line, the input unblocks with no notice.
- CHT-30. Cursor stdout: an `assistant` line with `timestamp_ms` and text "Hi" then an `assistant`
  line without `timestamp_ms` and text "Hi" → the bubble shows "Hi" once.
- CHT-31. Cursor `tool_call` started with key `editToolCall` → chip "🔧 Edit".

**Permission card**

- CHT-32. A `control_request` `can_use_tool` with `request_id` `r1`, `tool_name` `Bash`, input
  `{"command":"npm test"}`, no description → card "Claude Code wants to use Bash", body "npm test",
  buttons "Deny", "Always allow Bash", "Allow once" in that order.
- CHT-33. Same with `display_name` "Run shell command" and `description` "Runs the tests" → header
  "Claude Code wants to use Run shell command", body "Runs the tests".
- CHT-34. Input `{"file_path":"  ","path":"src/a.ts"}` → body "src/a.ts"; input `{"old":"x"}` →
  no body.
- CHT-35. "Allow once" on `r1` → stdin receives the allow `control_response` for `r1` with
  `updatedInput` `{"command":"npm test"}`; the card is gone; chip "🔧 Allowed Bash."; indicator
  shown.
- CHT-36. "Deny" → stdin receives the deny response for `r1` with message "The user declined this
  action." (in Spanish UI: its Spanish translation); chip "🔧 Denied Bash.".
- CHT-37. "Always allow Bash", then a second `can_use_tool` for `Bash` (`r2`) → no card; stdin gets
  the allow response for `r2` at once; chip "🔧 Auto-allowed Bash". A request for `Edit` still
  shows a card.
- CHT-38. "Always allow Bash" in one chat tab, then a new chat tab asks for `Bash` → a card is shown.

**Chat tabs in the window**

- CHT-39. A chat tab open, the app quit and restarted with "Reopen tabs on start" on → the chat tab
  does not come back; the project's members are unchanged.
- CHT-40. A window with only a chat tab (turn running) closed → no confirmation lists it; the
  process is terminated.
- CHT-41. Close a chat tab → closes at once, no `/exit` typed, the Claude process's stdin is closed
  and the process terminated.

**MCP servers**

- CHT-42. `~/.claude.json` = `{"mcpServers":{"web":{"type":"http","url":"https://mcp.example.com"},"fs":{"command":"npx","args":["-y","fs-server","/tmp/x"]}},"projects":{"/home/user/src/shop":{"mcpServers":{"db":{"type":"stdio","command":"db-mcp"}}},"/home/user/src/blog":{}}}`
  → section "Global" / "Available to every project" with rows "fs" ("stdio · npx -y fs-server
  /tmp/x") then "web" ("http · https://mcp.example.com"); section "shop" / "/home/user/src/shop"
  with "db" ("stdio · db-mcp"); no section for "blog".
- CHT-43. A server `{"type":"sse"}` with no url or command → subtitle "sse"; a server `{}` → "—".
- CHT-44. `~/.claude.json` missing, or containing `[1,2]`, or `{"mcpServers":` (truncated) → one row
  "No MCP servers configured"; no error dialog.
- CHT-45. Only project servers, no global → no "Global" section.
- CHT-46. The dialog open, then `~/.claude.json` changes → the dialog does not change; reopening it
  shows the new content. The file's bytes and mtime are unchanged by opening the dialog.

**Ghostty**

- CHT-47. `ghostty` not on the `PATH` at start → no "Open in Ghostty" in any history row menu.
- CHT-48. `ghostty` on the `PATH`; "Open in Ghostty" on Claude session `1b2c…` with folder
  `/home/user/src/shop` → a process `ghostty --working-directory=/home/user/src/shop -e claude
  --resume 1b2c…`, detached; no tab opens in the app.
- CHT-49. Same with a Cursor session whose folder is gone → `ghostty --working-directory=<home> -e
  cursor-agent --resume <id>`.
- CHT-50. "Open in Ghostty" on a Claude session with `claude` not on the `PATH` → no process, no
  message.

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
