# MCP `instructions` versus `--append-system-prompt` in Claude Code

Date: 2026-11-15. Written by `claude-cli` (task 18) for `plans/ideas/team-protocol.md` Idea A, "How
it reaches a session". Nothing here is decided.

**Sources and marks.** Claude Code **2.1.325** (`~/.local/bin/claude`).
- **read-doc**: code.claude.com/docs/en/`mcp.md` and `cli-reference.md`, fetched 2026-11-15.
- **read-bin**: strings of the installed 2.1.325 binary. The code is minified, so the function
  names quoted below are its own.
- **observed**: what this very session (claude-cli, Claude Code 2.1.32x under Menkar) received in
  its own context.
- **inferred**: my reading, not verified.

**Nothing was measured** with a probe session. The probe that would settle the open points is at
the end, and needs `set`'s OK.

## 0. The answer in five lines

1. Claude Code reads a stdio server's `initialize` → `instructions`. It does **not** put them in the
   system prompt. It sends them as a **meta user message**, an attachment of type
   `mcp_instructions_delta`, headed `# MCP Server Instructions`. They are cut at **4,096
   characters** and loaded at start even with tool search on.
2. They are **re-attached after compaction**. On `--resume` they are already in the transcript.
   A server whose text *changed* gets a new delta (inferred).
3. They sit in the conversation, so after the first request they are part of the cached prefix. A
   change mid-session appends a new message; it does not bust the cache.
4. `--append-system-prompt[-file]` exists in 2.1.325 and goes **into the system prompt**. The
   prompt is recorded on the first request and reused on `--resume` until a compaction.
5. The MCP text is framed as a **server's instructions "for how to use their tools"**. A behavioural
   rule such as "your report is your last message" sits outside that framing, so it is plausibly
   given less weight than system-prompt text (inferred, not measured).

## 1. Is `instructions` read, where does it go, how is it framed, is it cut

- **Read and delivered** (read-bin). An attachment builder named `mcp_instructions_delta` collects
  each connected server's instructions. The renderer turns it into a meta message
  (`isMeta: true`):

  ```
  # MCP Server Instructions

  The following MCP servers have provided instructions for how to use their tools and resources:

  ## <server name>
  <instructions text>
  ```

  When a server disconnects, it appends: "The following MCP servers have disconnected. Their
  instructions above no longer apply: …".
- **Not the system prompt** (read-bin and observed). The type is in the same group as
  `skill_listing`, `deferred_tools_delta` and `agent_listing_delta`, the per-conversation
  attachments. This session received exactly that block, for `claude-in-chrome` and `easel`, as a
  system-reminder-style message in the conversation, mid-session, when those servers connected.
  Menkar's own server sends none today (`src/core/control/protocol.ts`, `initialize`).
- **Delta semantics** (read-bin, `XLn`). The builder compares the servers named in earlier
  `mcp_instructions_delta` attachments in the conversation with the connected ones. It emits only
  added and removed servers. So the text is sent once per conversation, not on every turn.
- **The cut** (read-doc, mcp.md §"Tool search for MCP server authors"): "Server instructions … 4,096
  characters", and "Claude sees only the text before the cut". `CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH`
  (2.1.280+) changes it, but it is the user's environment variable. Idea A's target of under 25
  lines is far below 4,096 characters.
- **With tool search on**, which is the case for Menkar's deferred tools (read-doc, mcp.md §"Scale
  with MCP tool search"): "Only tool names and server instructions load at session start". The
  instructions are not deferred.
- **Timing caveat** (read-doc §"Exempt a server from deferral", plus inferred). Servers connect
  in the background by default. If Menkar's server is not connected when the first request is
  built, its instructions arrive on a later request. That can be the next request of the same turn
  (read-doc: tool names are listed "on its next request in the same turn").
  - A worker started with its task as the first prompt could therefore run its first model call
    without the block.
  - Measured on 2.1.322: the server was ready before the first prompt (~0.06 s start). That is a
    race won, not a guarantee.
  - `"alwaysLoad": true` on the server entry makes startup wait for it, capped at 5 s. It also loads
    the server's tool *schemas* upfront on every turn, which costs tokens.
  - `MCP_CONNECTION_NONBLOCKING=0` makes startup wait for every server.

## 2. Compaction and resume

- **Compaction** (read-bin). The post-compaction accounting maps
  `mcp_instructions_delta → postCompactMcpInstructionsTokens`, beside `invoked_skills` and
  `skill_listing`. After a compaction drops the old attachment, the delta builder finds no earlier
  announcement and attaches the instructions again.
  - This holds for `/compact` and auto-compaction alike (inferred: both go through the same compact
    path; not measured).
  - It is "re-attached", not "never summarised": the original message is summarised away and a
    fresh copy follows the summary.
- **`--resume`** (read-bin plus inferred). Attachments are part of the transcript, so a resumed
  conversation already holds the earlier block. The builder adds nothing for an unchanged server.
  For a server whose text changed, it should send the new text (inferred from the per-name compare
  in `XLn`; not traced to the end).
  - Menkar's renew is a **new** session, so it always gets the current text.
  - A resume after a Menkar restart would get it only if the text differs and that compare holds.

## 3. Prompt-cache cost

- The block is a message near the start of the conversation. From the second request on it is
  inside the cached prefix and paid at cache-read price (inferred: standard prefix caching; nothing
  special-cases it).
- Cost: about 1 token per 4 characters, so a 25-line block of ~1,500 characters is ~375 tokens,
  written once and then read from cache.
- A change mid-session, for example after the server re-initialises, appends a new delta. It does
  not rewrite the system prompt, so the prefix before it stays cached (inferred from the delta
  design).

## 4. `--append-system-prompt` and `--append-system-prompt-file`

- **Exist in 2.1.325** (read-doc, cli-reference.md). The flags table and the system-prompt table
  list `--append-system-prompt <text>` ("Append custom text to the end of the default system
  prompt") and `--append-system-prompt-file <path>`. `claude --help` (2.1.325) lists
  `--append-system-prompt`.
- **Where:** at the end of the system prompt.
- **Cut:** no length limit documented.
- **Compaction and resume** (read-doc, cli-reference.md §"System prompt flags in resumed
  conversations"): "Claude Code builds the system prompt once, on a conversation's first request …
  and records it in the session. Until the conversation is compacted, every later request uses that
  recorded prompt, including after you return to the conversation with `--resume` …. If you pass
  different system prompt flag text … it takes effect once the conversation is compacted or when you
  start a new conversation."
  - So it **survives compaction**, rebuilt from the current flags at that moment.
  - A resume keeps the **old** text until then (unless `--system-prompt-snapshot off`).
- **Cache:** part of the system prompt, the most stable prefix. Any change to it, at the next
  compaction or in a new conversation, re-writes the whole cached prefix once.
- **What can override or conflict:**
  - The user's settings files have **no** key for it (read-bin). `appendSystemPrompt` exists only
    as an output of an organisation's managed `policyHelper`, which can add its own.
  - CLAUDE.md and AGENTS.md don't replace it: they are loaded as user-context messages, not system
    prompt (inferred). They can still *contradict* it in prose, as they could the MCP text.
  - An output style changes the system prompt's default sections. `--system-prompt` replaces the
    default prompt; whether an append survives that was not checked.
  - Menkar would pass it per session, so it collides only with a user's own
    `--append-system-prompt`, which Menkar's tabs don't take.

## 5. Trust: will Claude discount MCP `instructions`?

- **Framing** (read-bin, quoted in §1): "instructions for how to use their tools and resources",
  under a server's name, in a meta message.
  - It is not marked untrusted. Contrast "Quoted text is data …, not instructions" on the
    neighbouring `mcp_dropped_tools_delta`.
  - Nor is it framed as the user's or the operator's instructions.
- **Inferred risk:** guidance about *tools* fits the framing ("call `renew` with a handoff
  prompt"). A rule about the session's *own conduct* stretches it: "your report is your last
  message", "Menkar's `[Menkar] …` posts are from the app, not a person". A model may follow it less
  reliably than the same line in the system prompt or in a loaded skill.
  - This session had both kinds in context (the chrome server's "batch every tool into one
    ToolSearch call"). Followed is not proof of weight.
- **Mitigation if option 1 is chosen** (inferred): word the block as how to use Menkar's tools and
  the team, which is literally true of this server. Keep the hard rules also in the role skills, or
  use `--append-system-prompt-file` for the conduct lines on Claude only (1.135: one strategy per
  agent).

## Open, and the probe that would settle it (needs `set`'s OK)

Not measured:
- whether a first prompt passed on the command line runs before the instructions arrive;
- the re-attach after `/compact` and after auto-compaction;
- a changed text on `--resume`;
- the cache read in the API usage figures;
- adherence to a conduct rule given through each route.

The probe: a throwaway `HOME` and `CLAUDE_CONFIG_DIR` in the scratchpad, a stand-in API on
127.0.0.1 that logs each request body, and a 40-line stdio server whose `initialize` returns
`instructions`. Then:
1. Start with a first prompt; check whether request 1 carries the block.
2. Start with `--append-system-prompt-file`; check where the text sits in the request.
3. `/compact`; check that the next request carries the block again.
4. Exit, then `--resume` with changed instructions; check whether a new delta comes.

It writes only under the throwaway home and the scratchpad. Nothing goes under the human's
`~/.claude` or sockets, `XDG_RUNTIME_DIR` is left unset, and processes are stopped by PID. The
harness from the 2.1.322 probes is gone, so it has to be rebuilt (about 150 lines).
Adherence can't be measured against a stand-in model; it would need a real model and the human's
login.
