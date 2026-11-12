# Session control: Menkar's MCP server, renewing, starting, waking

Decisions 1.70, 1.72, 1.73 and 1.74 (the human, 2026-11-11). A session renews itself when its task
is done (a `/clear` nobody types), an orchestrator starts its workers in Menkar tabs, a worker's
last reply is read by name, and a parent session is woken when a worker it started needs it or
ends a turn. The skills that use these tools are not part of this subsystem.

## The shape

- **The server** (`src/core/control/server.ts`) is a program of its own, built to
  `out/main/mcp-server.js` by a main entry in `electron.vite.config.ts`, as the statusline is. It
  imports nothing from Electron or the DOM.
  - **How Claude Code starts it:** every Claude command Menkar runs carries `--mcp-config` with
    inline JSON (`mcpConfig` in `src/core/command.ts`): the command is Electron's binary, the
    argument the script, and `env: {"ELECTRON_RUN_AS_NODE": "1"}`. The config is not run through
    a shell, which is why the variable goes in `env`. Claude Code adds it to the pane's environment.
  - **Who is calling:** the server reads `MENKAR_PANE` from that environment and refuses every
    call without one.
  - **The protocol** (`protocol.ts`) is newline-delimited JSON-RPC written by hand:
    - `initialize` echoes the client's protocol version and offers `tools`; `ping` gets `{}`.
    - `tools/list` names four tools; `tools/call` runs one.
    - Anything else with an id gets -32601, which is what Claude Code's first `server/discover`
      receives.
    - A failed call is `{content: [{type: "text", text}], isError: true}` with Menkar's own English
      sentence: it goes to the agent, not to the user.
- **The four tools.** A session is always named by its name, never by its id: a renew or a `/clear`
  gives it a new id, and an id an agent kept would name nothing.
  - **`renew { prompt? }`:** once this turn ends, the session is hung up as closing a tab does, and
    a fresh session starts in the same tab with the same name and the optional first prompt.
  - **`start_session { name, prompt? | prompt_file?, remote_control?, group? }`:** a new Claude
    session in the caller's project, in a tab right after the caller's, not selected. The caller
    becomes its parent.
    - A name another session of the project already uses in a tab is refused, and so is a group
      the project does not have.
    - The session starts in the caller's folder.
  - **`list_sessions {}`:** the caller's project, name first, then the id, the shown state, the
    context percentage, the parent's name, and whether the session has a tab. Earlier
    conversations are left out.
  - **`last_reply { name }`:** the last text a session of the caller's project replied. It is read
    from the end of its transcript (`src/core/sessions/lastreply.ts`, read only, in chunks, never
    the whole file) and cut to its first `REPLY_MAX_CHARS` with a note.
- **The files between the server and main** live in `<cache>/control/` (`controlPaths` in
  `src/core/control/files.ts`). There is no socket and no port. Every file is written in `tmp/`
  and renamed into place, so nothing ever reads half of one.
  - **`alive.json`:** main's pid, written at start and removed at quit. Missing, or naming a pid
    that is gone, the server answers "Menkar is not running" at once.
  - **`requests/<id>.json` and `responses/<id>.json`:**
    - The server writes a request and waits up to `RESPONSE_WAIT_MS` for its response, through
      `fs.watch` and a short poll. Unanswered, it takes the request back, so main never acts after
      the agent was told it failed.
    - Main (`src/main/control.ts`, `RequestQueue`) passes over `requests/` on every change and once
      a second, and takes each id once. A request older than `REQUEST_MAX_AGE_MS` is dropped (Menkar
      was closed); a malformed one gets a refusal.
  - **`snapshot/<project>.json`:** written by main, debounced, whenever a project's sessions change
    state, context, tab or membership. `list_sessions` reads the snapshot that lists its own pane,
    without asking main.
  - **`turn-ends/<pane>.json`:** written by the Stop hook (`docs/context.md`) at each turn's end,
    with the session id.
  - **`prompts/<id>.md`:** the first prompt of a session Menkar starts. A `prompt_file` an agent
    names is read in main and copied here: an absolute path, a regular file, at most
    `PROMPT_MAX_BYTES`, UTF-8 with no NUL. Copies older than `PROMPT_KEEP_MS` are swept.
- **The command line** reads the prompt as `"$(cat '<copy>')"`, right after the session's identity
  (`buildCommand`'s `promptFile`). The prompt itself is never put on the line, so it needs no
  quoting.
- **Renewing** (`renew` in `src/main/workspace.ts`):
  1. The renew is noted.
  2. At the turn's end, from the Stop hook's record whose session id is the pane's, the tab is
     re-keyed to a new id first. This is `followClear`, the same function a followed `/clear` runs:
     project place, group, hidden flag, parents, Remote Control, and the old id as an
     earlier conversation.
  3. The pane is hung up. Its exit leaves the tab in place.
  4. The new session starts in that tab.

  Starting it first would race its own SessionStart record. When no record comes within
  `RENEW_FALLBACK_MS`, the pane's shown state turning idle or done stands in.
- **Parents** are on the project in `projects.json` (`docs/projects.md`). They are re-keyed by every
  follow, so a wake reaches a parent that renewed.
- **Waking a parent:**
  - **The event:** a child's shown state entering `blocked` ("‹name› is waiting at a permission
    prompt"), or leaving `working` for `idle` or `done` ("‹name› finished its turn"). It comes from
    `onShownChange` in `src/main/agentstate.ts`.
  - **Batching** (`WakeBatcher`, `src/core/control/events.ts`): per parent, events wait until no
    new one has come for `WAKE_DELAY_MS`, a child keeps only its latest, and all go in one message.
  - **The post** (`postToSession`, `post.ts`):
    - Main finds the parent's process in Claude Code's registry, `~/.claude/sessions/<pid>.json`,
      read only, by `sessionId`, and requires `peerProtocol` 1.
    - It connects to the registry's `messagingSocketPath`, writes one line
      `{"type":"user","message":{"content":"[Menkar] …"},"from":"menkar","msg_id":"…"}`, and
      closes.
    - A parent with no Claude tab, or no entry in the registry, is logged and not woken.
  - Nothing is typed into a terminal.

## Measured on Claude Code 2.1.322 (2026-11-11, a throwaway home, a local stand-in for the API)

- **`--mcp-config` adds Menkar's server to the user's own.** `/mcp` lists it under "Built-in MCPs".
  Nothing about it is written under `~/.claude`, and there is no trust prompt. `mcpServers` in the
  `--settings` file is ignored, so it cannot carry the server.
- **The server inherits the pty's environment,** `MENKAR_PANE` included, also when the config gives
  an `env` of its own.
- **`--add-dir` and `--mcp-config` take every word that follows,** up to the next option. A prompt
  placed after them reached the session as one more folder. The prompt goes before them.
- **Menkar's own `--settings` removes the permission prompt.** With `permissions.allow:
  ["mcp__menkar"]` the tools ran without a prompt in both auto and manual modes. Without it, manual
  mode showed a permission card and auto mode sent the call to its server-side check.
- **The Stop hook** fires at the turn's end, after the tool call, with `MENKAR_PANE` and
  `session_id`.
- **A post to the messaging socket** from a process that is not the session's child behaves as
  follows:
  - It wakes an idle session into a new turn. The model reads "Another Claude session sent a
    message: …" with Claude Code's note that it is not the user.
  - It leaves a permission card as it was: nothing is approved, and the message is delivered when
    the card closes.
  - In bypass mode it is held behind a card, unless `crossSessionInbound` is `accept`.
  - Linux needs no auth line, and nothing is read back.
- **Claude Code's registry entries depend on the environment.** A claude started with
  `CLAUDE_CODE_CHILD_SESSION` (inherited from a Claude Code session that started Menkar) writes no
  `sessions/<pid>.json`, so it cannot be woken. A Menkar started from the desktop does not carry
  that variable.
- **The real check, end to end:**
  - A parent called `start_session`. The child opened in a tab after the parent's, not selected,
    and stopped at its Bash card.
  - The idle parent was woken once `WAKE_DELAY_MS` had passed, with "[Menkar] child is waiting at a
    permission prompt".
  - The parent called `renew`. A fresh session started in its tab with the given first prompt, and
    the child's parent moved to the fresh id.

## Rejected

- **A Unix socket or named pipe owned by main:** needed only for synchronous answers, which no tool
  needs. The files reuse the pattern of the SessionStart records.
- **A loopback HTTP server:** it is the only option that opens a port.
- **SQLite for the shared state:** it cannot tell another process that something changed, and a
  second SQLite file would amend the rule that the app's state is JSON.
- **Typing into the parent's terminal to wake it:** against the rule that nothing is typed into a
  running agent. For agents without a message channel this is an open decision.
- **A long-blocking `wait_for_event` tool:** the orchestrator would show as working, the human's
  own messages would queue behind it, and Claude Code moves such a call to the background after a
  while.
- **A plugin monitor as the wake:** it works, but a running monitor makes the registry say
  `shell` and `claude agents --json` say `busy` while the session is idle. That hides the very
  state Menkar reads, and the monitor outlives a killed agent.
- **`@modelcontextprotocol/sdk`:** a web framework, a schema library and more ship with it, for
  four tools.
- **`--strict-mcp-config`:** it would drop the user's own MCP servers from Menkar's sessions.
