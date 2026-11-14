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
