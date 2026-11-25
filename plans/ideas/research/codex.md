# Research: OpenAI's Codex CLI in Menkar (decision 1.127)

Date: 2026-11-14. Written by `codex` (the future Codex consultant) for `set`. Research before any
plan: nothing here is decided.

## Sources and how each fact is marked

- **Codex source**: github.com/openai/codex, shallow clone of `main` at `b1573f1`
  (2026-11-14 09:43 UTC), one day after release `rust-v0.169.0` (2026-11-13). Paths below are
  relative to `codex-rs/` unless they say otherwise.
- **Installed binary**: `codex-cli 0.169.0` at `~/.local/bin/codex`, installed by the human on
  2026-11-14. Only `--help` and `features list` were run, with `CODEX_HOME` pointing at an empty
  scratch folder. Codex wrote nothing there (the folder stayed empty). It printed only a warning
  that it would not create PATH helper binaries under `/tmp`. The human's `~/.codex` was not read
  or touched, and no session was started.
- **Docs**: learn.chatgpt.com (developers.openai.com/codex redirects there).
- **agent-deck** (github.com/asheshgoplani/agent-deck, MIT, `651e7fc`, 2026-11-14, release
  1.16.38). The human confirmed this is the "Agent Desk" of `docs/NOT_BUILT_YET.md`. Read as
  documentation, never copied.
- **tetriz-ai/agent-desk** (MIT, `41c9f75`, 2026-10-26): its Codex transcript extractor
  (`packages/local-session-extractor/src/extractors/codexExtractor.ts`), as a second reading of
  the format.
- **Markers**: **read** means read in source or docs, with the source. **measured** means run,
  with the command and version. **inferred** means not verified. Every *inferred* fact is a probe
  to run before a plan relies on it.

## 0. What changes the picture

1. **Codex has an official inbound channel that wakes an idle session without typing:
   `codex queue --thread <id|name> --message <text>`** (§2). It does not touch a pending approval.
   That gives 2.21 a third answer beside "end and resume" and "type".
2. **The TUI is a client of an app-server.** By default it is the **shared background daemon**:
   `daemon_auto_start` is stable and on (measured, `codex features list`, 0.169.0). Any `-c` that
   Menkar would pass, such as MCP or hooks, makes that TUI run an **embedded** app-server instead
   (§1.6). This decides how per-session settings, the queue and remote control combine.
3. **Codex's MCP servers do not inherit the terminal's environment.** `MENKAR_PANE` must be passed
   explicitly (§4).
4. **agent-deck integrates Codex by writing the user's `~/.codex/config.toml`** (the folder trust,
   the `notify` hook, MCP servers) **and by typing into tmux for every message**. Neither is open
   to Menkar under its rules. Its *knowledge* is still worth reading: screen strings, gotchas,
   transcript fields.

## Measured on codex-cli 0.169.0 (2026-11-14, a throwaway home, the human's login)

Setup:
- **Home:** a throwaway `CODEX_HOME` in the scratchpad, with a copy of the human's `auth.json`. The
  copy and the whole home were deleted afterwards.
- **Session:** the TUI ran in a private tmux server (`tmux -L codexprobe`) in a scratch git repo,
  with model `gpt-6.1-sol` (the default) at `model_reasoning_effort="low"`. 7 short turns.
- **Stubs:** a stdio MCP stub logged its environment and calls, and a `notify` script logged its
  argument.
- **Untouched:** the human's `~/.codex`, sessions and running daemon (PIDs 616540, 616708). My
  Codex process was stopped by PID after checking `/proc/<pid>/environ` named my `CODEX_HOME`.
- **No daemon** was started in the throwaway home. Codex refused to create its helper binaries
  under `/tmp`, so whether the daemon auto-starts in a normal home is still unmeasured.

The start command was `codex -C <repo> -c 'mcp_servers.menkar.command=…' -c
'mcp_servers.menkar.args=[…]' -c 'mcp_servers.menkar.default_tools_approval_mode="approve"' -c
'notify=[…]' -c 'projects."<repo>".trust_level="trusted"' "<prompt>"`.

1. **`codex queue` wakes an idle TUI that runs embedded.** The message was queued at 10:21:38.
   Its turn ran at about 10:21:43 and ended at 10:21:45 (from the `notify` log). The TUI showed it
   as an ordinary user message, `› [Menkar] probe: …`. `codex queue` without `-c`, against an
   embedded TUI, worked across processes through the home's SQLite (`queue_1.sqlite`).
2. **Pending approval:**
   - Codex showed its approval card for `touch b.txt` (`-s read-only -a on-request`; 0.169.0's
     `-a` takes only `on-request|never`).
   - A message was queued at 10:25:43, and **25 s later the card was untouched**: `b.txt` not
     created, the message not delivered.
   - After the approval was given by hand (`y`), the queued message ran as **the next turn, at
     once**: it was in the `notify` log within 2 s of the approved turn's end.
3. **A half-typed draft survives.** With "half typed draft" in the composer (no Enter), a queued
   message ran as its own turn, and the draft stayed in the composer, unsent.
4. **The folder trust prompt is not skipped by `-c projects."<dir>".trust_level="trusted"`.**
   "Folder access … Trust this folder? … Your trust decision will be saved." was shown anyway.
   Accepting it wrote `[projects."<dir>"] trust_level = "trusted"` into `$CODEX_HOME/config.toml`.
   So in the user's home, the first Codex session in a folder asks the human, and their answer
   writes their config. That is Codex's own write, started by the human.
5. **Any `-c` runs the TUI embedded.** Its warning (F2) read "Running without the shared
   background server: command-line configuration overrides (-c, --enable, --disable, or --search)
   requires embedded mode."
6. **MCP by `-c`:**
   - It loaded with no prompt.
   - The server's environment was only `HOME, LANG, LOGNAME, PATH, SHELL, TERM, USER`.
     `MENKAR_PANE` set on the pty did **not** reach it.
   - With `-c 'mcp_servers.menkar.env={MENKAR_PANE="cfg-pane"}'` the server saw `cfg-pane`.
   - **`env_vars` forwards names from Codex's own environment** (measured 2026-11-20, task 162):
     with `-c 'mcp_servers.menkar.env={ELECTRON_RUN_AS_NODE="1", MENKAR_PANE="p",
     MENKAR_AGENT="codex"}'` and a separate `-c 'mcp_servers.menkar.env_vars=["XDG_CACHE_HOME",
     "XDG_CONFIG_HOME","XDG_DATA_HOME"]'`, the server saw all three `env` keys plus
     `XDG_CACHE_HOME` and `XDG_CONFIG_HOME`; the unset `XDG_DATA_HOME` was absent, with no error.
     Each `-c` sets its own key, so the two do not overwrite each other (r:
     `config/src/overrides.rs:18-70`; unset names drop at `env::var_os` in
     `rmcp-client/src/utils.rs:16-26`).
   - With `default_tools_approval_mode="approve"`, the model's call to the tool ran **with no
     approval card**, even under `-s read-only`.
7. **`notify` by `-c`** fired at every turn's end, about 1 s after it, already on the first turn.
   Its argument was `{"type":"agent-turn-complete","thread-id","turn-id","cwd",
   "client":"codex-tui","input-messages":[…all user messages of the thread…],
   "last-assistant-message"}`.
8. **Resuming:** `codex resume <uuid> -C <repo> -c … "<prompt>"` kept the history and ran the
   prompt as the first turn. A saved trust meant no prompt this time.
9. **Files:**
   - The rollout `sessions/2026/11/14/rollout-2026-11-14T10-21-25-<uuid>.jsonl` existed after the
     first turn. Its name carries the time the trust prompt was accepted.
   - `session_index.jsonl` was **not** created: the session was never renamed.
   - `state_5.sqlite` `threads` had the row with `name` NULL, `title` = the first prompt,
     `source` `cli`, `thread_source` `user`, `originator` `codex-tui` and
     **`history_mode` `paginated`**.
   - The home also held `queue_1.sqlite`, `thread_history_1.sqlite`, `goals_1.sqlite`,
     `logs_2.sqlite`, `memories_1.sqlite`, `history.jsonl` and `shell_snapshots/`.
10. **The rollout format, as 0.169.0 writes it:**
    - **New threads are paginated, not legacy.** Records were `session_meta`, `turn_context`,
      `world_state`, `token_usage_record`, `response_item` (`message`, `function_call`,
      `custom_tool_call`, their outputs, `additional_tools`) and `event_msg` (`task_started`,
      `task_complete`, `token_count`, `thread_settings_applied`, `item_completed`).
    - **No `user_message` or `agent_message` events.** User text is in `item_completed` items of
      type `UserMessage`. The other item types were `AgentMessage`, `CommandExecution` and
      `McpToolCall`.
    - `task_complete` has `turn_id, started_at, completed_at, duration_ms,
      time_to_first_token_ms, last_agent_message, root_turn_id`.
    - `token_count.info` has `last_token_usage`, `total_token_usage`, `model_context_window` and
      `last_usage_includes_reasoning`. The usage fields are `input_tokens, cached_input_tokens,
      cache_write_input_tokens, output_tokens, reasoning_output_tokens, total_tokens`.
    - A queued message's `UserMessage` item carries a `client_id` and **nothing that marks it as
      queued**.
11. **zstd:** Node 22.21.1 (this machine) has `zlib.zstdDecompressSync`, measured with
    `node -e`.
12. **Through a running daemon** (second run after Menkar's restart, same conditions):
    - Setup: a daemon started by hand in the throwaway home (`codex app-server --listen unix://`,
      PID 813890), a TUI started with `-c` (so embedded), and `codex queue` with no `-c`.
    - `strace -e connect` showed the queue command connecting to the daemon's socket,
      `/tmp/codex-daemon-1000/<hash>`, with `$CODEX_HOME/app-server-control/app-server-control.sock`
      also present.
    - The message was queued at 10:31:42 and **ran in the embedded TUI by 10:31:50**. This is the
      setup Menkar would have in the user's home, where the shared daemon is often already running
      (the human's is).
    - `codex queue` **does not start a daemon**. It only probes the socket of one already running,
      and runs an embedded server otherwise (read, `tui/src/session_archive_commands.rs:283-294`).
      Only an interactive TUI launched with no `-c` auto-starts one (read,
      `tui/src/startup_orchestration.rs:571-575`).
13. **The first `notify` can belong to another thread.**
    - On the TUI's first turn, two `notify` lines came 1 s apart. **The first** (10:31:22)
      carried `thread-id` `01a1da41-635b…`, **with no rollout on disk**: Codex's ephemeral
      title-generation thread, the one agent-deck warns about. The second (10:31:23) carried the
      real thread's id, `01a1da41-5e6c…`, whose rollout exists.
    - `codex queue` to that id failed: "no rollout found for thread id …".
    - So Menkar binds a pane to the `thread-id` whose rollout exists (its file name ends in the
      id), and ignores the others.
    - Correction to item 7: run 1 showed only one line per turn. The extra line appears on the first
      turn of a new thread, when the title is generated.

**Third run, for plan 38's review** (2026-11-14 ~11:42–11:47, same conditions: a throwaway home
with the human's `auth.json` copied in and then deleted, `tmux -L codexprobe`, two sessions with
6 short turns in all, every process stopped by PID after checking its `CODEX_HOME`). The screens
are saved in the scratchpad at `probe/log/screen-*.txt`.

14. **MCP tools are deferred.**
    - Session A had an MCP stub with **18 tools**, each with a description and two string
      parameters; session B had none. Both ran the same first prompt.
    - The first turn's `token_count.last_token_usage.input_tokens` was **14,786 with the server
      and 14,779 without it: +7 tokens**.
    - The rollout's `additional_tools` item was the same size (38,139 bytes) in both. It holds
      `functions` (`exec`, `wait`, `request_user_input…`), `clock` and `collaboration`. None of
      the 18 schemas was in it.
    - The model saw the server only as one line, `- mcp__menkar`, in a `<tools>` list.
    - So the cost of Menkar's server per request is its name, whatever the number of tools.
      Codex sent `tools/list` once.
15. **Naming from outside the TUI works, but the open TUI does not see it.**
    - A separate `codex app-server` over stdio, with the same `CODEX_HOME`, was sent
      `initialize`, `initialized` and `thread/name/set {threadId, name:"menkar-t9"}`. It answered
      `{}` and emitted `thread/name/updated`.
    - It wrote two places: a line `{"id","thread_name":"menkar-t9","updated_at"}` appended to
      `session_index.jsonl`, and `threads.name` = `menkar-t9` in `state_5.sqlite`. The rollout got
      no line.
    - The embedded TUI holding that thread kept showing its old name in the footer.
    - **Correction to item 9:** session B had **a generated name before any rename**:
      `session_index.jsonl` held `"thread_name":"Reply with OK"`, and the footer showed
      "· Reply with OK". Session A, started a minute earlier in the same home, got no generated
      name. When Codex names a thread by itself: see item 25.
    - **Before the first turn:** the rollout file, whose name ends in the thread id, appears when
      the session starts (run 1: its timestamp was the trust acceptance). So the id could be learned
      from the folder before any turn, but that is a race with any other session starting in the
      same second (inferred).
16. **Screens, measured** (120×40, one blank line removed):
    - **Trust prompt:**
      `Folder access` / `<path>` / `Trust this folder? Codex can read, edit, and run files here,
      subject to your permission settings. …` / `› 1. Trust and continue` /
      `2. Back to Agent Command Center` / `enter continue · esc back`.
    - **Working:**
      - while MCP servers start: `• Starting MCP servers (2/3): codex_apps (0s • esc to interrupt)`;
      - in a turn: `• Working (5s • esc to interrupt)`.
      - **The composer `› Ask Codex to do anything` stays visible below the working line**, so the
        composer alone does not mean idle. A working line above it does.
    - **Approval:**
      - `• Running touch b.txt`, `Would you like to run the following command?`,
        `Environment: local`, `Reason: …`, `$ touch b.txt`;
      - `› 1. Yes, proceed (y)`, `2. Yes, and don't ask again for commands that start with …
        (p)`, `3. No, and tell Codex what to do differently (esc)`;
      - `Press enter to confirm or esc to cancel`.
      - The composer is replaced by the card.
    - **Idle:**
      - `• OK`, then `Worked for 3s • 11:43 AM`, then `› Ask Codex to do anything`;
      - the footer: `<model> <effort> · <cwd>`, then `· <thread name>` when there is one, then
        `← for agents · ? for shortcuts` (and `⚠ 1 warning · f2 to view` when embedded).
17. **`codex queue`'s store is `$CODEX_HOME/queue_1.sqlite`** (WAL, sqlx migrations).
    - Tables: `queued_items(id, thread_id, payload_json, queue_order, created_at_ms,
      updated_at_ms)` and `queued_thread_revisions(revision, thread_id UNIQUE)`.
    - Setup: a message queued while an approval card was pending.
    - **One wake wrote** one `queued_items` row: the message id, the thread id,
      `payload_json` = `{"UserInput":{"content":[{"type":"text","text":"[Menkar] …",
      "text_elements":[]}],"client_id":"…"}}`, and `queue_order` 0. It also bumped that thread's
      revision (3).
    - **On delivery the row was deleted** (`queued_items` count 0) and the revision bumped again
      (4). Nothing of the queue stays after delivery except the revision counter. The message
      itself goes into the rollout as a `UserMessage`.

**Fourth run, no login** (2026-11-20, for plan 39's id binding).
- A throwaway `CODEX_HOME` with no `auth.json`. The `config.toml` named a custom provider
  (`model_providers.stub`, `wire_api = "responses"`, `env_key`) pointing at a local stand-in that
  answered `POST /v1/responses` with three SSE events: `response.created`,
  `response.output_item.done`, `response.completed`.
- A real TUI turn completed this way, so **later probes need no login**.
- The scripted stand-in now lives in the tree: `scripts/agent-probes/codex/responses-standin.mjs`
  (its `README.md` holds the config and the script format; 2026-11-21).
- Every process was stopped by PID and the home deleted.

18. **The rollout file is created at the first user message, not at start.**
    - After start, the trust prompt and an idle composer, there was no file.
    - It appeared **66 ms after the first submit**.
    - **Its name carries the session-start time** (11-04-50), although the file was created at
      11:05:30 (r: `deferred_creation` for new threads).
    - With a positional first prompt the two coincide, which is why earlier runs looked like "at
      start".
19. **Thread ids are UUIDv7, minted when the thread is created.** Their first 48 bits decode to
    the session start (11:04:50.1), not to the first message.
    - Fork also mints a new id, with `session_meta.forked_from_id` set (r).
    - The title thread gets its own fresh id.
20. **The fd is not closed on `/new`.** After `/new` and a message, the codex process (one native
    binary, no node) held **both** rollouts open. `/new` first shows a worktree picker.
21. **notify's environment** is the Codex process's whole inherited environment (83 variables,
    `MENKAR_PANE` included, no `CODEX_THREAD_ID`).
    - Codex spawns it without waiting.
    - The configured argv comes first, and the JSON is appended last.
    - The title thread's notify (no rollout) fired on each new thread's first turn. It came
      **after** the real one here and before it on 2026-11-14, so the order is not fixed.
22. **Typed text followed by an immediate Enter is not submitted.** The paste-burst detector keeps
    it in the composer; an Enter about 1 s later submits it.
23. **Screens and the terminal title, per state** (2026-11-20, 120×40, the stand-in API, for plan
    39's state rules; plan 39's state rules record the strings):
    - **The title (OSC)** is the most reliable signal:
      - `⠧ work` while working, with a Braille spinner prefix;
      - **`[ ! ] Action Required | work`**, alternating with `[ . ] …` about every second, at an
        exec approval card and at a `request_user_input` question;
      - the bare cwd name (`work`) when idle.
    - **While a reply streams there is no "Working (…)" line**: only the growing `• <text>` and the
      composer. The `• Working (2s • esc to interrupt)` line shows only while no text streams,
      e.g. during a command.
    - **`■` at column 0 is not only an error**: an Esc interrupt prints
      `■ Conversation interrupted - use /feedback if something went wrong`. A failed stream prints
      `■ stream disconnected before completion: …`. Both are followed by the idle composer.
    - **`1 background terminal running · /ps to view · /stop to close` stays visible while idle.**
      While working, it joins the working line.
    - **A message sent while a turn streams is steered into that turn**, shown at once as
      `› <text>`; no "queued" marker was seen.
    - **`request_user_input` exists only in Plan mode** ("request_user_input is unavailable in
      Default mode").
    - **Pickers** (`/model` "Select Model and Effort", `/resume` "Resume a previous session", `/new`
      "Where should the new conversation run?") all end `enter select · esc back` or similar. The
      title then stays the bare name, with no Action Required.
    - **Not reached with the stand-in:** an apply-patch card (the stand-in's model was offered no
      `apply_patch` tool), a network approval, an MCP elicitation.
24. **`codex queue`, case by case** (2026-11-20, for plan 39's Waker, task 164; the stand-in API,
    no login).
    - **Setup:** a TUI started embedded (`-a on-request -s read-only -c …`). `codex queue --thread
      <uuid> --message <text>` was run with **no `-c`**, from a process with the same
      `CODEX_HOME`. Every call returned in **50–75 ms**.
    - **Accepted:** exit 0, stdout `Queued message <uuid7> for thread <uuid>.`, stderr empty apart
      from the PATH-aliases warning, which only a home under `/tmp` gets:
      - **(a) idle:** delivered as the next turn about 3.7 s later.
      - **(b) mid-turn** (the stand-in held its reply 25 s): delivered as its own turn, 5 ms after
        that turn's `task_complete`. While waiting, the TUI showed nothing about it.
      - **(c) at an exec approval card:** after 25 s the card was untouched, `b.txt` was not
        created and the message was not delivered. After a `y` by hand, the message ran as the
        next turn, 5 ms after the approved turn ended. That re-confirms item 2 on this version.
      - **(d) the TUI stopped:** the row stayed in `queue_1.sqlite` (`queued_items`, the
        `UserInput` payload).
        - `codex resume <uuid> -c …` with no prompt delivered it about 1 s after start, as the
          first turn.
        - `codex resume <uuid> -c … "<prompt>"` with a message queued put **both in one turn**:
          the queued `UserMessage` first, then the prompt's `UserMessage` 25 ms later, under one
          `task_started`/`task_complete`.
    - **Refused:** exit 1, stdout empty, one line on stderr:
      - **(e) a thread with no rollout yet** (started, `/status` showed its id, no message sent)
        and **(f) an unknown uuid** gave the same line: `Error: failed to queue session message:
        thread/queue/add failed: failed to read thread: invalid thread-store request: no rollout
        found for thread id <uuid> (code -32603)`. Nothing was queued. (r: `require_thread` →
        `thread_store.read_thread`, `app-server/src/request_processors/thread_queue_processor.rs:255-295`.)
      - A non-uuid name with no match: `Error: No active session found matching '<name>'.`
    - **Text:** a 2,071-character message with newlines, a blank line, tabs, quotes, backticks,
      `$HOME`, `ñ`, `⠧` and an emoji arrived **byte-exact**, both in the `item_completed`
      `UserMessage` and in the `response_item` user message.
    - **Two messages queued back to back ran as two turns**, in order, 4 ms apart.
    - **With a shared daemon running in that home** (`codex app-server --listen unix://`):
      - `codex queue` with no `-c` connected to the daemon's socket
        (`/tmp/codex-daemon-<uid>/<hash>`, strace). It was accepted the same way and reached the
        embedded TUI 2.6 s later.
      - An unknown uuid was refused with the same line.
      - **`codex queue -c …` was refused**, exit 1: `Error: cannot queue through an embedded app
        server while a local app-server daemon is running; remove configuration overrides or use
        --remote`. With no daemon, the same `-c` would have run embedded (r,
        `tui/src/session_queue_commands.rs:39-56`).
    - **Files written** (snapshot diffs in a home that exists; task 165):
      - **`codex queue` itself:**
        - `queue_1.sqlite-wal` and `-shm`, and `logs_2.sqlite` and `-shm`;
        - on some runs, a touched `state_5.sqlite-shm`, `goals_1.sqlite-shm` or
          `memories_1.sqlite-shm`;
        - its embedded server may also checkpoint into `queue_1.sqlite`, `logs_2.sqlite-wal` or
          `.sqlite-maintenance.lock` (inferred from the app-server's set, item 25).
      - **With no `-c`, `codex queue` also runs the plugin marketplace sync:**
        `git ls-remote https://github.com/openai/plugins.git`, a GitHub connection, and an empty
        `.tmp/git-XXXXXX/` left behind.
        - **`codex queue --disable plugins` does no sync** (no git, no network) and was accepted
          with no daemon running.
        - With a daemon running it would be refused like any override (see below); the daemon
          then does the work.
      - **Delivery, by the idle TUI that runs the message:**
        - `queue_1.sqlite-wal` and `-shm` (the row deleted);
        - the rollout;
        - `state_5.sqlite-wal` and `-shm`;
        - `thread_history_1.sqlite-wal` and `-shm`.
    - **The daemon starts `git ls-remote https://github.com/openai/plugins.git`** (the plugin
      marketplace) when it starts. That is Codex's own network use.
25. **Naming from outside: `thread/name/set`, and the TUI's generated name** (2026-11-20, for plan
    39's naming, task 165; the stand-in API answered the title request with `{"title":…}`).
    - **The call:** a separate `codex app-server` (stdio, the same `CODEX_HOME`). The client sends
      one JSON object per line:
      1. `{"id":1,"method":"initialize","params":{"clientInfo":{"name":…,"version":…}}}`.
         `clientInfo.name` and `version` are required (r, `app-server-protocol/src/protocol/v1.rs:29-41`).
      2. The answer is `{userAgent, codexHome, …}`, plus a `remoteControl/status/changed`
         notification.
      3. `{"method":"initialized"}`, then
         `{"id":2,"method":"thread/name/set","params":{"threadId","name"}}`.
      4. That answers `{}`, then `thread/name/updated {threadId, threadName}`.
      5. Closing stdin makes it exit 0. End to end it took **120–240 ms**.
      The name is trimmed, and an empty one is refused ("thread name must not be empty", r).
    - **The daemon:** `codex app-server` with a daemon running in that home ran on its own. strace
      showed no connection to the daemon's socket. It starts no daemon and leaves none. `-c` and
      `--disable` are accepted.
    - **By default it syncs the plugin marketplace**:
      - it runs `git ls-remote https://github.com/openai/plugins.git` (a connection to GitHub's
        443) and clones into `$CODEX_HOME/.tmp/plugins` (5,487 files, plus `plugins.sha` and
        `plugins.sync.lock`);
      - every run leaves an empty `.tmp/git-XXXXXX/` (`objects/`, `refs/`, `HEAD`). The sync
        removes these only once they are older than 10 minutes (r, `startup_sync.rs:40,400`).
      - **`codex app-server --disable plugins` does none of it**: no git, no network, no `.tmp`
        (measured; r, `plugins_enabled` gates it at `core-plugins/src/manager.rs:3000`).
    - **Accepted when:** as soon as the rollout exists, which is at the first user message (item 18).
      A call during the first turn, before it ended, answered `{}`.
    - **Refused, as the JSON-RPC error `-32600`
      `no rollout found for thread id <uuid>`:** a thread with no rollout yet (started, no
      message) and an unknown uuid. The process still exits 0 after stdin closes.
    - **Writes, in a home that already exists** (with `--disable plugins`):
      - always: one line appended to `session_index.jsonl`, plus `state_5.sqlite-wal` and
        `state_5.sqlite-shm`;
      - on some runs: `logs_2.sqlite` (and its `-wal`/`-shm`), `memories_1.sqlite-shm`, and an
        empty `.sqlite-maintenance.lock` created once.
      - **In an empty home**, initialize alone creates `installation_id`, `skills/.system/`, and
        `{state_5,logs_2,goals_1,memories_1,queue_1}.sqlite` each with `-wal` and `-shm`.
      - The rollout gets no line.
    - **The generated name** (r, `tui/src/app/thread_title.rs`, `tui/src/app/thread_routing.rs:2176-2210`,
      `tui/src/app_server_session.rs:436-455`; measured):
      - **The trigger:** the TUI starts it at **every completed user message while the TUI's own
        idea of the name is empty**. It runs a hidden temporary thread with a structured-output
        request (`text.format` = json_schema `codex_output_schema`, "Generate a concise,
        single-line task title of at most 36 characters…"). The model is `gpt-5.6-luna` on
        ChatGPT accounts, else the session's model.
      - **Before saving, it re-reads the thread and saves only if `name` is still empty.** With
        the title's answer held 6 s and `menkar-c` set 1.5 s into the first turn, the generated
        title was **not** written.
      - **It does not stop asking:** the TUI never sees an outside rename (item 15), so it asked
        again at the second message, and again skipped saving. That is one extra model request
        per user message. A `/rename` in the TUI sets its own name and stops it.
      - With no outside name, the generated one was saved 37 ms after the first message, mid-turn.
      - A race is left: if the outside set lands between that read and that write
        (milliseconds), the generated name wins (inferred from the code).
      - **No per-run switch turns it off** (r). There is no config key, no feature flag and no
        `--name` on `codex`. The generation is skipped only when:
        - the TUI already holds a name (for example, a resumed named thread);
        - the message is in a side chat;
        - the TUI runs in Cloud mode (`ThreadParamsMode::Cloud`;
          `tui/src/app_server_session.rs:488-492`).
        Embedded and `--remote` both generate.
      - **Why item 15's session A got none** (inferred): its title request failed or returned no
        title.
    - **A `/rename` cannot be told from a generated name.** Both go through `thread/name/set`,
      both append the same `{"id","thread_name","updated_at"}` line, and both set `threads.name`.
      `threads.title` stays the first prompt. The rollout records neither. A rename while a
      generated name is pending cancels it (r).
      - The TUI's `/rename` dialog opens prefilled with a fresh suggestion ("Suggested from this
        conversation"). Submitting it is the human's rename.
      - The TUI shows a name (footer `· <name>`) only if it set that name itself.
    - **Names are not unique.** Two threads set to `dupname` were both accepted.
      `codex resume dupname` then refused: `Error: Multiple sessions match 'dupname' (including
      <id> and <id>); use a session UUID to disambiguate.` `codex queue --thread <name>` uses the
      same lookup (r).

26. **Team block, resume, compaction, MCP exposure and skill reads** (2026-11-20, task 166; the
    stand-in API, request bodies saved; model `stub-model` (unknown to the catalog) and
    `gpt-6.1-sol` (the real catalog entry, with the stand-in as provider)).
    - **`-c developer_instructions` replaces the file's.**
      - Setup: `developer_instructions = "USERDEV-MARKER…"` in `config.toml`, plus a 5,487-byte
        `-c developer_instructions=<JSON string>`.
      - The request held only the `-c` text, **byte-exact**. `USERDEV` was nowhere.
      - It is the **first content item of the second developer message**. The order there is:
        block, `<skills_instructions>`, `<permissions instructions>`, `<collaboration_mode>`,
        `<tools>` (deferred list; real model only).
      - The first developer message is the base prompt. With `gpt-6.1-sol`, an
        `additional_tools` item comes first and `<multi_agent_role>`/`<multi_agent_mode>`
        developer messages follow.
      - `AGENTS.md` is a later **user** message ("# AGENTS.md instructions for <dir>"), then
        `<environment_context>`, then the prompt.
      - There was no truncation at 5.5 KB.
    - **Where it is recorded:** only as a `response_item` developer message at the thread's
      start. `session_meta` has no such field (`base_instructions` is the base prompt), and
      neither does `turn_context`.
    - **Resume** (`codex resume <id> -c developer_instructions=B`, then a turn): the request
      replays the recorded history, so **the model sees A only**. B was nowhere. With **no** `-c`
      on resume it was the same: A only, and the file's value not added.
    - **Compaction rebuilds the developer message from the running process's config**, not from
      the history:
      - **`/compact`** in a run resumed with no `-c` replaced A with the file's `USERDEV`.
      - An **automatic compaction** (`-c model_auto_compact_token_limit=50000`, the stand-in
        reporting 200,000 tokens) in a run resumed with `-c developer_instructions=DELTA`: the
        next request held **DELTA** and no A. It ran before the next turn and showed
        `• Context compacted`.
      - **So every resume must pass the block again**, or the next compaction drops it.
    - **The `compacted` rollout record is the same for both:** `{type:"compacted",
      payload:{message, replacement_history, replacement_history_metadata, retained_context,
      window_id, window_number, previous_window_id, first_window_id, compaction_response_id,
      latest_token_usage_record, resume_metadata}}`.
      - `message` is the summary prompt ("Another language model started to solve this
        problem…").
      - `replacement_history` holds the rebuilt `additional_tools`, the developer messages (with
        the new block), the user messages kept, and the summary.
      - `world_state` and `turn_context` records follow it.
    - **A turn opened by `codex queue`** sends the same request as any turn: the whole recorded
      context (block included), with the same tool exposure. Nothing is special about it.
    - **How MCP tools reach the model depends on the model** (r: `core/src/tools/spec_plan.rs`,
      `supports_search_tool` and `tool_mode` in `codex debug models`):
      - **Every catalog model** (gpt-6.x, gpt-5.6, daybreak) has `supports_search_tool: true`,
        and all but `gpt-5.5` have `tool_mode: code_mode_only`.
        - The request's only tools are an `additional_tools` item: `functions` (`exec`, `wait`,
          `request_user_input`…), `clock`, `collaboration`.
        - **Menkar's tools are deferred.** The developer message lists `- mcp__menkar:
          <server instructions>` under "Deferred tool namespaces". No schema is sent.
        - The model calls them **inside the `exec` JavaScript tool** as
          `await tools.mcp__menkar__task_review({task: 7})`. That worked on the **first** call,
          with no search first: the MCP stub got `tools/call task_review {task:7}`, and the TUI
          showed `• Called menkar.task_review`.
        - The schemas are found through `ALL_TOOLS`. Each entry is `{name:
          "mcp__menkar__task_review", description: "<desc>\n\n<server instructions>\n\nexec
          tool declaration: declare const tools: { mcp__menkar__task_review(args: { task:
          number; }): Promise<CallToolResult>; }"}`.
      - **A model unknown to the catalog** (`stub-model`) got plain function tools. `mcp__menkar`
        was a `namespace` tool with every function's full JSON schema; the server's
        `instructions` were its description.
      - **`-c 'features.code_mode.direct_only_tool_namespaces=["mcp__menkar"]'` makes Menkar's
        tools direct on the real models.**
        - `mcp__menkar` became a namespace in `additional_tools`, beside `functions`, with full
          schemas. It left the deferred list.
        - A top-level call `{type:"function_call", namespace:"mcp__menkar", name:"task_review"}`
          ran with no search.
        - The key is a feature config (`features/src/feature_configs.rs:55-60`). The spelling
          `code_mode.direct_only_tool_namespaces` is ignored with the warning "`code_mode` is
          ignored".
        - It is overridden only if the `code_mode_only_strict_3p_tools` feature is on (under
          development, off).
    - **Skill reads by absolute path:** `cat <abs>/SKILL.md` by `exec_command`, outside the cwd
      (one under `/tmp`, one in another repository), ran with **no approval card** under the
      default for a trusted folder (`workspace-write`, `on-request`; "The sandbox permits reading
      files"). The TUI showed `• Explored └ Read SKILL.md`. `read-only` says "only permits reading
      files" (r: `debug prompt-input`).
27. **With Menkar's MCP mounted by `-c`, the TUI generates no title** (2026-11-20, task 167;
    `gpt-6.1-sol` against the stand-in, with `-c mcp_servers.menkar.*` and
    `features.code_mode.direct_only_tool_namespaces`).
    - No title request reached the stand-in, at the first message (a long positional prompt
      after `--`) or the second. `session_index.jsonl` was never created.
    - Codex's own log (`logs_2.sqlite`, target `codex_tui::app::thread_title`) had, per message:
      `failed to start title-generation thread error=thread/start failed: failed to load
      configuration: invalid transport in \`mcp_servers.menkar\` (code -32600)`.
    - So the hidden title thread fails to start, before any model request. The TUI still tries
      at each message while it holds no name, but that costs no request. Item 25's titles came
      from a session with no MCP.
    - Why the transport is invalid there is not read. It looks like a Codex bug in how the
      temporary thread rebuilds the `-c` MCP table (inferred); a later version may fix it and
      bring the generated titles back.
    - Confirmed in task 167's run of Menkar itself: one such failure per message, across two
      threads. Each thread's only `session_index.jsonl` line was Menkar's name, written 0.13 to
      0.24 s after the first message.
    - `codex --version` prints `codex-cli 0.169.0` (the version is the **second** word). A
      `CODEX_HOME` under `/tmp` adds a PATH-aliases warning on stderr.
    - With `direct_only_tool_namespaces`, the namespace is also absent from `exec`'s `tools`
      object: `tools.mcp__menkar__list_sessions is not a function`. The model calls the tools
      directly instead.
28. **Menkar's Codex state rule across a turn** (2026-11-21, task 190; codex-cli 0.169.0,
    `gpt-6.1-sol` against the stand-in, 120×40).
    - Setup: a sampler applied `src/core/agents/codex/state.ts`'s rule (spinner title or "esc to
      interrupt)" in the last 8 lines, then working; "[ ! ] Action Required" or a card footer,
      then blocked) to the pane every 50 ms, and logged each change.
    - **A turn reads as one unbroken "working" span.** Every case gave exactly one
      idle→working→idle:
      - **slow:** 1.5 s model delay, then `sleep 2`; 1.2 s delay, then `echo`; 0.8 s plus 1 s
        after `response.created`, then a reply streamed in 20 deltas over 3 s. One 9.8 s span.
      - **fast:** three tool calls with no delay and a 1 s stream. One 1.6 s span.
      - **automatic compaction in the middle of a turn:** after a tool call (`-c
        model_auto_compact_token_limit=50000`, the stand-in reporting 200,000 tokens). No gap.
    - **The title spinner holds** across model latency, tool runs, compaction, and the start and
      end of streaming. "esc to interrupt)" was on screen throughout as well.
    - **At an approval card, the title alternates every 1.0 s** between `[ . ] Action Required |
      <name> | <cwd>` and `[ ! ] …`, with no plain title in between at 50 ms sampling. The card's
      footer "press enter to confirm or esc to cancel" stays drawn the whole time.
    - **The idle title carries the thread's name** once it has one (`<name> | <cwd>`); the
      working title is `<spinner> <name> | <cwd>`.
    - **Working with no turn:** while MCP servers start, the title shows the spinner (with no
      "esc to interrupt)").
      - A server answering `initialize` after 4 s gave a 4.0 s "working" span at TUI start.
      - An instant one gave about 50 ms. With no MCP there was none.
      - Menkar's own server (the worktree build under Electron-as-Node) answered `initialize`
        in 47–65 ms, so at start this is a span of about 0.1 s, under Menkar's 250 ms re-read.
    - 20 s idle gave no change.
29. **For the versions row** (2026-11-25, task 213; `gpt-6.1-sol` against the in-tree stand-in,
    which reported 100,000 tokens per reply; the TUI started with a bare environment).
    - **Context reading:** `token_count.info` had `last_token_usage.total_tokens` 100,000 and
      `model_context_window` 258,400. `/status` showed "64% left (100K used / 258K)". Menkar's
      reading, 100 − (100,000 − 12,000)/(258,400 − 12,000), is 36% used, so it agrees.
    - **Usage:** one `token_usage_record` per response, `{thread_id, turn_id, session_id,
      root_turn_id, response_id, usage:{input_tokens, cached_input_tokens, …}}`.
    - **`--add-dir <dir>`** under the default for a trusted folder (`workspace-write`,
      `on-request`): a command writing a file in that folder ran with no approval card.
    - **The environment a shell command gets** (measured, adding to §1.7, which was read):
      `CODEX_CI=1`, `CODEX_HOME`, `CODEX_PERMISSION_PROFILE=:workspace`,
      `CODEX_SANDBOX_NETWORK_DISABLED=1`, `CODEX_THREAD_ID`, `CODEX_TOOL_CALL_ID`,
      **`CODEX_SESSION_ID`** (the thread's id), **`CODEX_VERSION=0.169.0`**,
      **`CODEX_APPLY_PATCH_PRESERVE_LINE_ENDINGS=1`**, `NO_COLOR=1`, `PAGER=cat`.
      - The three in bold are not in §1.7, nor in Menkar's `src/core/agents/codex/env.ts`.
      - `TERM` was the pty's (`xterm-256color`), not `dumb` as §1.7 read.
      - Source (r): `CODEX_SESSION_ID` and `CODEX_VERSION` come from `inject_session_env`
        (`core/src/exec_env.rs:41-50`), always Codex's own. `CODEX_APPLY_PATCH_PRESERVE_LINE_ENDINGS`
        is a compatibility marker for old standalone `apply_patch` binaries
        (`apply-patch/src/lib.rs:54-57`). `CODEX_PLUGIN_METRICS_OUTPUT` is in the same runtime list
        (`process_manager.rs:141-157`).
      - `UNIFIED_EXEC_ENV` (`process_manager.rs:90-101`) forces `TERM=dumb` and
        `LANG`/`LC_CTYPE`/`LC_ALL=C.UTF-8`. `TERM` was not dumb with the default tty, and `LANG`
        was not measured.
## 1. The five facts

### 1.1 Starting and resuming

- **Start:** `codex [OPTIONS] [PROMPT]`. The positional prompt is "Optional user prompt to start
  the session" (measured, `codex --help`, 0.169.0).
  - Flags: `-m/--model`, `-C/--cd`, `--add-dir`, `-s/--sandbox`, `-a/--ask-for-approval`,
    `-p/--profile`, `-c key=value` (TOML), `--enable/--disable <feature>`, `--no-daemon`,
    `--no-alt-screen`, `--dangerously-bypass-hook-trust`, `--approve-for-me`, `--worktree`,
    `-i/--image` (measured).
- **No name at start.** No flag names a session (measured, the full option list of `codex --help`,
  0.169.0).
  - A name comes only from the TUI's `/rename` ("rename the current thread",
    `tui/src/slash_command.rs:102`) or the app-server's `thread/name/set`
    (`app-server-protocol/src/protocol/common.rs:640`).
  - The name is stored twice: appended to `$CODEX_HOME/session_index.jsonl` as `{id, thread_name,
    updated_at}` (`rollout/src/session_index.rs:35-66`), and as `threads.name` in
    `state_5.sqlite` (read, tetriz `codexExtractor.ts:200`).
  - Codex also generates a title, `threads.title` (read, tetriz CE:100-104).
  - agent-deck keeps the title only in its own env var `AGENTDECK_TITLE` (read,
    `internal/session/instance_cmd_build.go:1183`).
- **Resume:** `codex resume [SESSION_ID] [PROMPT]`. SESSION_ID is "Session id (UUID) or session
  name. UUIDs take precedence if it parses" (measured, `codex resume --help`, 0.169.0). `--last`
  takes the most recent session. A prompt makes it **resume with a first message**.
  - `codex fork <id>` forks a session (measured).
  - `codex archive|unarchive|delete <id|name>` also exist (measured).
- **The session id of a session Menkar starts is not printed.** agent-deck finds it in three ways
  (read, `internal/session/instance_codex_detect.go`):
  1. the rollout file the Codex process holds open (`/proc/<pid>/fd`, retried 3 times over 2 s);
  2. a walk of `sessions/` for rollouts newer than the start whose `cwd` matches;
  3. the `thread-id` of the turn-end `notify` (§1.3).

  For Menkar's own sessions, `notify` or a `SessionStart` hook would carry the id the way the
  SessionStart record does for Claude (inferred; see §1.3 for the trust cost of a hook).
- **Gotchas from agent-deck** (read, its CHANGELOG and comments):
  - Resuming an id whose rollout was never flushed loops; resume only when the rollout exists
    (#756).
  - Resuming a subagent or guardian thread fails with "turn/start failed in TUI": filter on
    `session_meta.thread_source` / `parent_thread_id`.
  - Codex 0.155 runs an ephemeral title-generation thread that fires turn-end notifies and writes
    no rollout.
  - A first prompt typed instead of passed is read as a paste and its Enter swallowed. This
    confirms that the positional prompt is the right way.
- **The folder trust prompt:** Codex asks to trust a project folder on first use. agent-deck
  avoids the prompt by writing `projects[dir].trust_level = "trusted"` into the user's
  `config.toml` (read, `internal/session/codex_trust.go:33-107`). Menkar must not do that.
  Passing the same key with `-c` does **not** skip the prompt (measured, item 4 above).

### 1.2 Transcripts

- **Where:** `$CODEX_HOME/sessions/YYYY/MM/DD/rollout-<YYYY-MM-DDTHH-MM-SS>-<thread uuid>.jsonl`
  (`rollout/src/lib.rs:88`, `rollout_file_name.rs`). Archived sessions move to
  `$CODEX_HOME/archived_sessions/` (`lib.rs:89`). `CODEX_HOME` defaults to `~/.codex`.
- **Compression:** rollouts older than 7 days are compressed to **`.jsonl.zst`** by a background
  job at start (`rollout/src/compression.rs:46`, `MIN_ROLLOUT_AGE` at :371). Readers must accept
  both (`compression.rs:63`). Menkar's reader needs zstd (inferred: Node 22's `zlib` has zstd only
  in recent minors; check before relying on it).
- **An index:** `$CODEX_HOME/state_5.sqlite` (`state/src/sqlite.rs:53`; `CODEX_SQLITE_HOME`
  overrides its folder). Its `threads` table has `id, rollout_path, source, model, cwd,
  git_branch, title, name, created_at, updated_at, tokens_used, first_user_message, …`. Parent
  links are in `thread_spawn_edges(child_thread_id, parent_thread_id)`.
  - Read in tetriz CE:202-228, which opens the file by its hardcoded name and falls back to
    walking the folders when it is missing.
  - agent-deck also reads `thread_history_1.sqlite`, read only (`internal/recall/reader/codex.go`).
  - Reading another program's SQLite read-only is allowed by the rule "read, never rewritten". But
    the file name carries a schema version, and the schema is undocumented.
- **Format:** JSONL, one `{timestamp, type, payload}` per line. The first line is
  `session_meta`. The types are `session_meta`, `turn_context`, `response_item`, `event_msg`,
  `compacted`, `token_usage_record` and others (`history/src/lib.rs:295-315`, `RolloutItem`).
- **Two history modes** (`rollout/src/policy.rs:128-160`):
  - **Legacy** is the protocol enum's default (`app-server-protocol/src/protocol/v2/thread_data.rs:79`),
    **but 0.169.0 creates new TUI threads as paginated** (measured, item 10 above); legacy ones
    are older sessions. It persists `event_msg`
    `user_message`, `agent_message`, `context_compacted`, …
  - **Paginated** is what `codex migrate-rollouts` converts to. It persists the same content as
    `event_msg` `item_completed` with `TurnItem`s instead.
  - Both persist `turn_started`, `turn_complete`, `turn_aborted` and `token_count`.
  - Readers must take both. tetriz and agent-deck do, keyed on `item_completed` with a
    `UserMessage` item ("Codex 0.118 on", tetriz CE:1362-1378).
- **What Menkar needs, by consumer:**
  - **Session list:** `session_meta.payload.cwd`, the id, start and last times, and the name from
    `session_index.jsonl` (the newest line per id wins) or `threads.name`. Subagent threads are
    filtered by `source` / `thread_source`. Codex runs its own subagents (`multi_agent_v2`).
  - **`last_reply`:** `event_msg` `task_complete`/`turn_complete`, field `last_agent_message`
    (read, agent-deck `internal/session/instance_transcript.go:284-306`; tetriz CE:1673-1702). A
    293 MiB rollout has been seen, with a turn's start more than 9 MiB from its end (agent-deck's
    `docs/codex-send-composer-framing.md`). Menkar's chunked tail read fits that.
  - **Usage's time and tokens per turn:**
    - turn start: `turn_started` (older name `task_started`);
    - turn end: `turn_complete` (or `task_complete`), or `turn_aborted`;
    - tokens: `token_count.info.last_token_usage.{input_tokens, cached_input_tokens,
      output_tokens, reasoning_output_tokens, total_tokens}`, where reasoning is a subset of
      output (tetriz CE:121-131);
    - context: `info.model_context_window`;
    - per-line `timestamp` (ISO).

    Cost is not in the transcript. Pricing is per model and would be Menkar's own table, as for
    Claude (inferred).
  - **The classifier's input:** the user text (`user_message.message`, or the `item_completed`
    `UserMessage` text) and the final reply (`last_agent_message`). Tool calls come from
    `response_item` `*_call` items.
- **Menkar writes nothing there.** `codex archive` / `delete` are Codex's own commands for the
  user-started trash and delete.

### 1.3 Running state in the terminal

- **Working:** the line "`Working (12s • esc to interrupt)`", sometimes followed by
  "`· 1 background terminal running`" (`tui/src/status_indicator_widget.rs:458`; agent-deck
  `internal/tmux/pane_status.go:32`). The pane title also shows a Braille spinner, and agent-deck
  hit a false positive on the home screen's Braille logo (#3037).
- **Approval:** an overlay "`Would you like to run the following command?`" with rows
  "`› 1. Yes, proceed (y)`" (`tui/src/bottom_pane/approval_overlay.rs:278,886`). Codex 0.167
  added a picker ending "`Press enter to confirm or esc to cancel`". Its `›` row reads as the
  composer unless the footer is checked (read, agent-deck `internal/tmux/substate.go:325-333`,
  #3085/#3088).
- **Idle:** the composer prompt "`› `" (U+203A), with the placeholder "`Ask Codex to do
  anything`" on an empty box (agent-deck `internal/tmux/detector.go:77-85`). A "`? 1 question`"
  queued above the composer counts as busy (agent-deck CHANGELOG:514).
- **Errors:** banners starting with `■` at column 0, such as a usage limit or not logged in
  (agent-deck `docs/status-detection.md`).
- **Signals that need no screen reading:**
  - **`notify`** (`-c notify=["prog", …]`): Codex runs the program at each turn's end with one
    JSON argument `{"type":"agent-turn-complete","thread-id","turn-id","cwd","client",
    "input-messages","last-assistant-message"}` (`hooks/src/legacy_notify.rs:13-41`). It needs
    **no hook trust**. It is **legacy**: "TODO: Remove this hook … when legacy `notify` support is
    removed" (:44).
  - **Hooks** (`Stop`, `PermissionRequest`, `SessionStart`, `UserPromptSubmit`, `Interrupt`, …;
    `protocol/src/protocol.rs:1824`, `app-server-protocol/src/protocol/v2/hook.rs:20`).
    - `Stop` receives `session_id, transcript_path, cwd, model, turn_id, stop_hook_active,
      last_assistant_message`.
    - `PermissionRequest` receives `tool_name, tool_input`, and **can answer** allow or deny,
      which Menkar must never do.
    - Hooks are on by default (`hooks` stable/true, measured, `codex features list`).
    - **Every non-managed hook must be trusted before it runs.** Hooks given with `-c` (the
      `SessionFlags` layer) count as non-managed (`hooks/src/engine/discovery.rs:1037`). The
      user trusts them in `/hooks`, which records the hook's hash in the user's config. The other
      way is `--dangerously-bypass-hook-trust` for that run (docs, learn.chatgpt.com/docs/hooks).
- **A third source:** the app-server publishes `AgentStatus` (`Running`, `Interrupted`,
  `Completed`, …) to its clients (`protocol/src/protocol.rs:2070`). Reading it means being a
  client of the daemon (inferred; not needed for a first version).

### 1.4 Status line and context reading

- The TUI's status line is **built in**. `tui.status_line` lists items such as `model-name`,
  `context-remaining`, `context-used`, `thread-name` and `status`
  (`tui/src/bottom_pane/status_line_setup.rs:58-121`; `config/src/types.rs:1015-1028`). It
  is not an external command like Claude Code's `statusLine`.
- `tui.status_line_provider` can name **an MCP server's tool** that renders the line
  (`config/src/types.rs:886-897`). What the tool receives (context? session id?) is **unknown**;
  `tui/src/app/status_line_settings.rs` only persists it.
- **Context for Menkar** can come from the transcript instead:
  `token_count.info.last_token_usage.total_tokens / info.model_context_window` (inferred from the
  fields above; tetriz uses `total_tokens` of the last request for its percentage).

### 1.5 Remote mode

- `codex remote-control [start|stop|pair]` is "[experimental] Manage the app-server daemon with
  remote control enabled". Pairing prints "a short-lived manual pairing code"
  (`cli/src/remote_control_cmd.rs`; measured, `codex --help`, 0.169.0). The feature flag
  `remote_control` reads `removed` (measured, `codex features list`): the CLI command replaced it.
- It is **daemon-wide, not per session**. A session reaches it only if its TUI runs on the shared
  daemon (inferred). A session Menkar starts with `-c` runs embedded (§1.6), so the two do not
  combine. Menkar's agent entry should declare **no remote mode for Codex** for now.

### 1.6 The shared daemon and what forces an embedded server

- The TUI uses the local daemon's socket when it can, and falls back to an embedded app-server
  (`tui/src/lib.rs:1101-1141`, `startup_orchestration.rs:223,363`).
- **It runs embedded** for (`tui/src/daemon_startup.rs:62-125`): `--no-daemon`, `--oss`,
  `--profile`, `--strict-config`, `--dangerously-bypass-hook-trust`, `CODEX_EXEC_SERVER_URL`, and
  **any `-c`** except `features.*` booleans and `tui.fullscreen_transcript`.
- So **every Menkar session that gets Menkar's MCP or a `notify` by `-c` runs embedded**: its own
  process, the user's `~/.codex`, no daemon. That is closer to how Menkar runs Claude Code, and it
  is what `--settings` is for there.

### 1.7 Environment variables a running Codex sets for its children

Read in source. The `sessionenv.ts` counterpart, so that a Menkar started from a terminal inside
Codex does not hand them on:

| Variable | Set where | Says |
|---|---|---|
| `CODEX_THREAD_ID` | every shell command (`protocol/src/shell_environment.rs:174`; `exec-server/src/local_process.rs:794`) | the parent thread |
| `CODEX_TOOL_CALL_ID` | shell commands (`shell_environment.rs:37-46`) | the tool call |
| `CODEX_CI=1` | the unified-exec shell tool (`core/src/unified_exec/process_manager.rs:100`) | "I run under an agent" |
| `CODEX_SANDBOX` (`seatbelt` on macOS) | sandboxed commands (`core/src/sandboxing/mod.rs:166`) | sandboxed |
| `CODEX_SANDBOX_NETWORK_DISABLED` | sandboxed commands (`core/src/spawn.rs`) | network off |
| `CODEX_NETWORK_PROXY_ACTIVE`, `CODEX_NETWORK_PROXY_ATTRIBUTION`, `CODEX_NETWORK_PROXY_CREDENTIAL_BROKER_ACTIVE`, `CODEX_NETWORK_ALLOW_LOCAL_BINDING`, `CODEX_NETWORK_PROXY_SNAPSHOT_BROKERED_*` | the network proxy (`network-proxy`) | Codex's proxy, which is not the user's |
| `CODEX_PERMISSION_PROFILE` | commands run under a permission profile (`core/src/exec_env.rs:61-67`) | the parent's profile |
| `PLUGIN_ROOT`, `PLUGIN_DATA`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` | plugin hooks (docs) | a plugin's folders |

- The shell tool also forces `NO_COLOR=1`, `TERM=dumb`, `LANG/LC_*=C.UTF-8`, `PAGER=cat` and
  `COLORTERM=` (`process_manager.rs:90-101`). A Menkar started from Codex's shell tool would run
  its terminals with them. They look like the user's own settings, so stripping them is a
  decision, not a list entry.
- The variables that are configuration and are kept: `CODEX_HOME`, `CODEX_SQLITE_HOME`,
  `OPENAI_API_KEY`, `CODEX_API_KEY`, `CODEX_CA_CERTIFICATE`.
- **The reverse direction:** Codex started by Menkar must not get Claude Code's variables. Menkar
  already strips them from every pty through `withoutSessionEnv` (`src/main/terminal.ts`), so
  nothing new is needed.

## 2. Messages: waking a Codex session, and sending and receiving

**`codex queue` (official CLI; read and help measured)**

- `codex queue --thread <uuid|exact name> --message <text> [--resume]` sends
  `thread/queue/add` to an app-server (`tui/src/session_queue_commands.rs:33-140`).
- The queue is **durable, in SQLite under `CODEX_HOME`** (`ext/queue/src/service.rs`).
- **Every app-server**, daemon or embedded, installs the queue service
  (`app-server/src/message_processor.rs:371`, `ext/queue/src/lib.rs:14-21`). It does two things:
  - It **drains the queue when a thread goes idle**, except after an interrupt
    (`on_thread_idle`, `service.rs:588-605`).
  - It **polls SQLite every 10 s** for messages other processes queued, and wakes a loaded thread
    whose status is not `Running`/`Interrupted` (`watch_external_messages`, `service.rs:90-245`;
    `wake_if_loaded`, :511-522). **An idle session is woken within about 10 s.**
- **While an approval is pending**, the turn is `Running`, so nothing is delivered and nothing is
  approved. The message waits for the turn's end. That is the same guarantee as Claude Code's
  inbox (inferred from the status check; **probe it**).
- After an Esc interrupt (`Interrupted`), the queue waits for the human's next action (read,
  `service.rs:516,590`).
- The text arrives as **user input**. Nothing marks it as coming from another session, so the
  frame must say so: "[Menkar] …", as today.
- `--no-daemon` is refused for `codex queue`. If a daemon is running and the queue command would
  go embedded (because of its own `-c`), it refuses ("cannot queue through an embedded app server
  while a local app-server daemon is running"). So Menkar runs it with no `-c` (read,
  `session_queue_commands.rs:39-56`).
- **Measured** (items 1–3 of "Measured on codex-cli 0.169.0"):
  - an idle embedded TUI is woken in about 5 s;
  - a pending approval is left alone, and the message runs right after that turn ends;
  - a half-typed draft is kept.
- **Also measured** (item 12): a message queued through a running shared daemon reaches an
  embedded TUI within about 8 s. `codex queue` never starts a daemon itself (read).

**The ways to wake a Codex session, against the rule that nothing is typed (2.21)**

| Way | Keeps the rule | Notes |
|---|---|---|
| **`codex queue`** | **Yes**: no keystrokes, no input box | Official CLI; idle wake ≤ ~10 s; waits behind approvals; arrives as user input; needs probes above |
| End and `codex resume <id> "<event>"` | Yes | Verified syntax (measured help). Costs as in `wake-orchestrator.md` §5: draft lost, background terminals cut, restart time. Fallback only |
| A `Stop` hook returning `{"decision":"block","reason":…}` | Yes | Only extends a turn in progress, cannot wake an idle one; needs hook trust or `--dangerously-bypass-hook-trust` |
| Typing into the pty (agent-deck: bracketed paste + Enter, composer-draft guard) | **No**, amends the rule | agent-deck needed a turn "fence", acceptance locks and a submit retry to make it reliable |
| `codex app-server` / `exec` | n/a | Other modes: Menkar runs the TUI. `app-server` could carry a future Codex chat tab (inferred) |
| Codex's agent message board (`agent_message_board`, `wake_on_agent_messages`) | — | "under development", off (measured, `codex features list`) |

**Recommendation for 2.21, for the human:** for Codex, `codex queue` keeps the rule and makes
typing unnecessary. Use end-and-resume only when the queue is refused (an old Codex, no
daemon).

## 3. Mixed teams

- **Nothing in the transport stops one orchestration mixing Claude Code and Codex.**
  - Menkar's `wake(session, text)` is per agent (1.72): a post to the socket for Claude,
    `codex queue` for Codex.
  - Reports are read with `last_reply` from the transcript, per agent (§1.2).
  - Menkar's own tools are MCP, and Codex takes them (§4).
  - agent-deck's conductors manage children of any tool (read, its
    `internal/session/conductor_templates.go:51`, "claude, codex, hermes or pi; default to this
    conductor's own tool").
- **What each direction needs:**

| Direction | Wake / report | What Menkar adds |
|---|---|---|
| Claude parent → Codex child | Menkar sees the child's state (screen + `notify`) and posts to the Claude parent's socket, as today | Codex state detection; `last_reply` for Codex rollouts |
| Codex parent → Claude child | Menkar runs `codex queue --thread <parent id>` with the event | the Codex `wake`; the parent's thread id |
| Codex ↔ Codex | as above, both sides | — |
| Any session → a named session ("send the report by name") | Claude Code's `SendMessage` reaches **only Claude Code sessions** with a registry entry; a Codex session has no `~/.claude/sessions/<pid>.json` and cannot be listed or sent to; Codex has no counterpart to `SendMessage` at all | **a Menkar MCP tool `send_message { name, text }`** that routes through the receiver's agent's `wake`, so the skills say one thing for every agent |

- **The skills' "send the report by name to `set`"** therefore needs the Menkar tool once one side
  is Codex (inferred).
- **`start_session` and Menkar's CLI should take `agent`**:
  - values: Menkar's agent keys (`claude`, `cursor`, `codex`);
  - **default: the caller's own agent**, as agent-deck does;
  - an unknown or not-installed agent is refused with Menkar's own sentence;
  - `model` is passed as `codex -m`;
  - `remote_control` is refused for an agent without a remote mode.

  `resume_session` takes the agent from the session's record.

## 4. Menkar's MCP server and skills in a Codex session

- **MCP per session, without touching `~/.codex`:** `-c` adds a `SessionFlags` layer for that run
  only (measured, `codex --help`: "Override a configuration value that would otherwise be loaded
  from `~/.codex/config.toml`"). For example:
  `-c 'mcp_servers.menkar.command="<electron>"' -c 'mcp_servers.menkar.args=["<script>"]'
  -c 'mcp_servers.menkar.env={ELECTRON_RUN_AS_NODE="1", MENKAR_PANE="<pane>"}'`.
  - The server keys are `command, args, env, env_vars, cwd, startup_timeout_sec,
    tool_timeout_sec, enabled, required, enabled_tools, default_tools_approval_mode, tools`
    (`config/src/mcp_types.rs:397-430`).
  - **The pty's environment does not reach the server.** A stdio server gets only
    `HOME, LOGNAME, PATH, SHELL, USER, LANG, LC_ALL, TERM, TMPDIR, TZ`, plus `env` and the names
    in `env_vars` (`rmcp-client/src/utils.rs:16-47,163-175`). So `MENKAR_PANE` goes in `env`,
    and the server's check that refuses calls without it stays as it is.
  - **No permission prompt:** `default_tools_approval_mode = "approve"` (`AppToolApproval`:
    `auto|prompt|writes|approve`, `mcp_types.rs:29`) is the counterpart of
    `permissions.allow: ["mcp__menkar"]` (inferred; probe it).
  - The `-c` makes the session run embedded (§1.6), which Menkar wants anyway.
  - agent-deck instead writes `[mcp_servers.*]` into the user's `config.toml` (read,
    `internal/session/codex_mcp.go`). That is not open to Menkar.
- **The turn's end per session:** `-c 'notify=["<electron>","<script>","--pane","<pane>"]'` with
  no trust needed, but legacy (§1.3). Or a `-c hooks…` `Stop` hook, which needs trust. Codex's
  `notify` is a single key, so a `-c` value replaces the user's own `notify` for that run
  (inferred). That is a cost to weigh: the user's notifier would not fire in Menkar's Codex
  sessions.
- **Skills:**
  - Codex reads `SKILL.md` folders from the repository's `.agents/skills` (cwd up to the root),
    `$HOME/.agents/skills`, the deprecated `$CODEX_HOME/skills`, the system cache, and plugins'
    skills (`ext/skills/src/host_roots.rs:95-180,247`).
  - **No CLI flag or `-c` key adds a skills folder.** Extra roots exist only as the app-server
    request `skills/extraRoots/set` (`app-server-protocol/src/protocol/v2/plugin.rs:42`), which a
    TUI does not expose.
  - Plugins come from marketplaces (`codex plugin`, `marketplace_add`); none loads from a folder
    for one run (read, docs; `-c` for plugins is unverified).
  - So the per-session ways are:
    - (a) **serve the skill through Menkar's MCP**: a tool that returns a skill's text
      (`load_skill { name }`), which a short `developer_instructions` line tells the agent to
      call;
    - (b) `-c developer_instructions="…"`, which agent-deck uses for its identity block. It adds
      to the base prompt rather than replacing it (read, agent-deck
      `internal/session/identity_injection.go:21`; `model_instructions_file` would replace it).
  - Both keep the user's repository untouched. Copying into `.agents/skills` (agent-deck's way)
    writes into it.
  - The skills' text names Claude Code tools in places (`SendMessage`, `--plugin-dir`). It would
    need an agent-neutral wording or a Codex variant (inferred).

## 5. AGENTS.md (the Codex side only; `claude-cli` covers Claude Code)

Read in `core/src/agents_md.rs:1-49,270-300` and `config/src/config_toml.rs:76,337-341`.

- **Global:** `$CODEX_HOME/AGENTS.md` (or `AGENTS.override.md`) as user instructions, placed
  before the project's under a separator `--- project-doc ---` (`agents_md.rs:47-49`).
- **Project:** Codex finds the root by walking up to a `project_root_markers` entry (default
  `.git`; none found means the cwd only). It then **concatenates every `AGENTS.md` from the root
  down to the cwd**, in that order. It never walks past the root, and **does not read files below
  the cwd** at start.
- **Per folder:** `AGENTS.override.md` is checked first, then `AGENTS.md`, then each
  `project_doc_fallback_filenames` entry (`agents_md.rs:279-300`), so a folder can keep
  `CLAUDE.md` and name it as a fallback.
- **Size:** `project_doc_max_bytes`, default **32 KiB** (`DEFAULT_PROJECT_DOC_MAX_BYTES`). Above
  it Codex says "Trim your project instructions to fit the budget". This repository's `CLAUDE.md`
  is 14,476 bytes (measured, `wc -c`).
- **Not read:** `.claude/rules/*.md` (this repository's `ts-tests.md`), `@`-imports, and
  path-scoped rules. Codex has `.codex/rules/` of its own (read, tetriz
  `harness-discovery/src/codex.ts:343`).
- **For the move:**
  - The smallest change that serves both is `AGENTS.md` holding the text and `CLAUDE.md` holding
    `@AGENTS.md`, if Claude Code still follows that import (`claude-cli`'s answer).
  - Or keep `CLAUDE.md` and pass `-c project_doc_fallback_filenames=["CLAUDE.md"]` to the Codex
    sessions Menkar starts. That would only be for Menkar's own sessions, and it is again a `-c`.

## 5b. Team block delivery (decision 1.150; task 23, 2026-11-15)

The question: which route puts Menkar's per-session team block (~25 lines) into a Codex
session's instructions, with nothing written in the user's config.

**Setup:**
- Source: `openai/codex` at tag `rust-v0.169.0` (`d32063f`). The binary: codex-cli 0.169.0.
- Measured 10:58–11:03 in a throwaway `CODEX_HOME`, with the human's `auth.json` copied in and
  deleted after, in a private tmux (`-L tbprobe`).
- Three markers, each in one place:
  - a 25-line, 1,846-byte block holding `TEAMBLOCK-ALPHA`, passed by `-c developer_instructions`;
  - an MCP stub whose `initialize` returned `instructions: "MCPINSTR-BRAVO: …"`;
  - an `AGENTS.md` in the repository holding `AGENTSMD-CHARLIE`.
- The question asked of the model each time: "Without using any tool: list every capitalised
  marker of the form WORD-WORD … with where you saw it".
- Two sessions, 8 short turns in all. Every process was stopped by PID after checking its
  `CODEX_HOME`, and the home deleted.

### The routes

| Route | Where it lands | Cap | Before the first answer | After compaction | On resume, a changed text | Cost per request | With the user's `AGENTS.md` |
|---|---|---|---|---|---|---|---|
| **`-c developer_instructions`** | **the first text of the developer message** of the initial context, before the permissions, skills and tools blocks; no wrapper (m: rollout line 4, `role: developer`) | none in Codex (r); only the OS limit on one argument, 128 KiB on Linux (r) | **yes** (m: the first answer named `TEAMBLOCK-ALPHA` as "developer instructions") | **yes**: the `compacted` record's `replacement_history` carries the developer message again, and the model named the marker after `/compact` (m) | **not seen**: resumed with the block changed to `TEAMBLOCK-DELTA`, the model still answered `ALPHA` and "no marker changed", and `DELTA` was nowhere in the rollout (m). **After the next compaction** the rebuilt context held `DELTA` (m, rollout) | its own size, in the cached prefix: ~1,846 bytes ≈ 450 tokens (i; the token totals of two sessions differ by other context, so the difference was not isolable) | **added**: `AGENTS.md` stays a separate user message ("user-provided AGENTS.md instructions") (m) |
| MCP server `instructions` (`initialize`) | one line, `- mcp__menkar: <text>`, in the deferred-tools `<tools>` list of the developer message (m) | **250 characters**, inside a tools fragment of at most 4 KiB (r, `core/src/context/world_state/tools.rs:29-30`) | yes, if short (m) | yes (m) | fixed per server start | small | added |
| `-c instructions` / `-c model_instructions_file` | **replace Codex's base instructions** (the system prompt) (r, `core/src/config/mod.rs:4253-4262`) | — | — | — | — | — | — |
| `project_doc_fallback_filenames`, `AGENTS.override.md` | a file in the repository, root to cwd (r, §5) | 32 KiB for all project docs | yes | yes | read at start | its size | joins the user's |
| `$CODEX_HOME/AGENTS.md` | user instructions | — | — | — | — | — | — |
| A skill (`.agents/skills`, plugins) | only its description is listed; the body loads when the model picks it (r, §4) | — | the description only | — | — | — | — |

**Why each is out:**
- **Replacing the base instructions** throws away Codex's own system prompt.
- **A file in the repository, or `$CODEX_HOME/AGENTS.md`,** is a write into the user's repository
  or the user's config.
- **A skill** is not loaded until the model chooses it.
- **MCP `instructions`** are cut at 250 characters, and framed as a tool namespace's description.

**The cost of `-c developer_instructions`:**
- **It replaces the user's own `developer_instructions`** from `config.toml` for that run: it is a
  single key, and `-c` wins (r, `config/mod.rs:4266`). Menkar can read the user's value, read-only,
  and pass both, the user's first. agent-deck merges the same way (its
  `identity_injection.go`).
- Like every `-c`, it makes the TUI run embedded, which Menkar's sessions already do for the MCP
  and `notify`.

**Correction (item 26, 2026-11-20):** compaction rebuilds the developer message from the
running process's `-c`, not from the thread. "Survives compaction" holds only when the run passes
the block again: a resume without it loses the block at the next compaction.

### Recommendation

1. **Best: `-c developer_instructions`**, holding the user's own value (if any) followed by the team
   block.
   - It is there before the first answer and survives compaction.
   - It costs its own size in the cached prefix.
   - It sits as developer-message weight, the nearest Codex has to Claude's
     `--append-system-prompt`.
   - **A change reaches a running or resumed session only through a `[Menkar]` post (or at its next
     compaction)**, as for a resumed Claude session (1.152).
2. **Second: none per session is good.** The nearest is a short **MCP `instructions` pointer**
   (≤250 characters): "You are in a Menkar team; call `menkar.team_block` for your role and
   protocol", served by a tool. It costs a tool call, the model may skip it, and it is weaker.

## 6. agent-deck on Codex, in short

Read at `651e7fc`. Section by section, what it does and what Menkar may take:

| Area | agent-deck | Takeable by Menkar |
|---|---|---|
| Start | positional prompt; `-c developer_instructions`; `--model`; `--yolo` | yes: the prompt and `-c` |
| Folder trust | writes `trust_level` into the user's `config.toml` | **no** |
| Session id | `/proc/<pid>/fd` of the open rollout; disk walk by cwd; `notify` thread id | yes, as knowledge |
| State | screen strings (§1.3) + global `notify` installed into the user's `config.toml` | strings yes; the install **no** (per-session `-c` instead) |
| Messages | tmux bracketed paste + Enter, composer-draft guard, turn fence, acceptance lock | **no** (typing); `codex queue` replaces it |
| Approvals | sends a digit key (`session approve`) | **no** (Menkar never answers a prompt) |
| MCP | writes `[mcp_servers.*]` into the user's `config.toml` | **no** (`-c` instead) |
| Skills | copies into `<project>/.agents/skills` | no (the user's repository) |
| Conductor | `AGENTS.md` written into its own conductor folder | n/a |
| Mixed teams | yes; Codex parents get typed wakes plus a heartbeat drain | the idea, with `codex queue` |

## What Menkar would need to build

1. **An agent entry for Codex** in `src/core/agents.ts`. It declares: command `codex`; no remote
   mode; enabled on Linux; no name at start; resume `codex resume <id> [prompt]`; how to wake.
2. **The command builder for Codex:**
   - the positional first prompt (`"$(cat …)"`) and `-m`;
   - `-c mcp_servers.menkar.{command,args,env}` with `MENKAR_PANE` and `ELECTRON_RUN_AS_NODE` in
     `env`, and `default_tools_approval_mode="approve"`;
   - a turn-end signal (`-c notify=[…]` or a trusted hook);
   - possibly `-c projects."<dir>".trust_level` and `developer_instructions`. All of it per
     session, nothing in `~/.codex`.
3. **The session's id:** taken from `notify`'s `thread-id` (or a `SessionStart` hook) for the
   pane, the way Claude's SessionStart record is.
4. **A Codex transcript reader** in `src/core/`:
   - finds `sessions/**/rollout-*.jsonl[.zst]` and `archived_sessions/`;
   - reads `session_meta`, `turn_context`, `event_msg` (both history modes) and `token_count`;
   - takes the name from `session_index.jsonl`, and possibly `state_5.sqlite` read only;
   - filters subagent and guardian threads;
   - feeds the session list, `last_reply`, Usage (time and tokens per turn) and the classifier;
   - decompresses zstd.
5. **Codex agent-state detection** from the screen (§1.3 strings), plus the `notify` record for the
   turn's end.
6. **Context reading** from `token_count` (no status line command to hook).
7. **`wake` for Codex = `codex queue --thread <id> --message "[Menkar] …"`**, run without `-c`.
   End-and-resume is the fallback when the queue refuses.
8. **`start_session { agent? }`** (default: the caller's agent), `resume_session` by the
   session's agent, and Menkar's CLI likewise.
9. **A Menkar MCP tool to message a session by name** (`send_message`), routed through `wake`, so
   that the skills' "send the report by name" works across agents.
10. **Skills for Codex sessions** served through Menkar's MCP (`load_skill`) or
    `developer_instructions`, with an agent-neutral text.
11. **`sessionenv.ts` for Codex:** the variables in §1.7.
12. **What stays the human's (topics for `set`):**
    - adopting `codex queue` for 2.21;
    - per-session `notify` replacing the user's own `notify` in Menkar's Codex sessions;
    - `--dangerously-bypass-hook-trust` versus trusting Menkar's hook once in `/hooks`, which
      writes the user's config;
    - naming: Codex has no start-time name, and Menkar's rule "the name is the one the agent
      has" means either the human `/rename`s, or Menkar calls `thread/name/set`. The second is a
      write into the agent's data through its official API.

## Still unknown

Probes 1–5 of the first list were run on 2026-11-14; see "Measured on codex-cli 0.169.0". Still
open, each asked of `set` first:

1. (Answered in item 12: through a running daemon it works, and `codex queue` starts none.)
2. What the MCP status-line provider tool receives.
3. Windows and macOS: the daemon socket, `codex queue`, zstd.
4. Whether the folder trust prompt can be avoided at all without writing the user's config, for
   example in a folder already trusted through a parent.

The first list, kept for the record:

Each runs with a throwaway `CODEX_HOME` and a stand-in, never the human's login or sessions. A
stand-in model provider may be needed: Codex's `model_providers` can point at a local
OpenAI-compatible stub (inferred).

1. Does `codex queue` wake an idle embedded TUI (started with `-c`) within about 10 s? Does it
   wait behind an approval without touching it? What does the TUI show? Does it start or leave a
   daemon?
2. Does `-c mcp_servers.menkar…` load with no prompt, and does `default_tools_approval_mode =
   "approve"` skip the approval card?
3. Does `-c notify=[…]` fire per turn in an embedded TUI, and with which `thread-id` on the first
   turn?
4. Does `-c 'projects."<dir>".trust_level="trusted"'` skip the folder trust prompt without
   writing `config.toml`?
5. Does Codex write `session_index.jsonl` or `state_5.sqlite` before the first turn, and when
   does the rollout file appear (agent-deck's #756)?
6. What the MCP status-line provider tool receives.
7. Windows and macOS: the daemon socket, `codex queue`, zstd.
