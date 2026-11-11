# Research: how an orchestrator's MCP server talks to the running app

Date: 2026-11-11. Sources read at: agent-deck `f701771` (2026-11-09), Backlog.md `52b4ea3`
(v1.55.3, 2026-11-11), both shallow clones of the public GitHub repos. Paths below are relative to
each repo root. Anything not read in source is marked **(inferred)**.

## 1. agent-deck (Go, tmux)

### How a conductor learns the state of other sessions: it runs the CLI, and gets pushed digests

- The conductor's instructions (`conductor/conductor-claude.md`, "Agent-Deck CLI Reference") list
  the commands it runs itself through Bash:
  `agent-deck -p P status --json` (counts), `list --json`, `session show --json <id>`,
  `session output <id>` ("Get the last response"), `session send <id> "msg"` (`--wait -q
  --timeout 300s`, `--no-wait`), `session approve`, `session start|stop|restart`, `add`, `launch
  <path> -t T -c claude -g G -m "prompt"` ("Create + start + send initial prompt in one command"),
  `session command --json --wait-idle 60s <s> '/compact'`, `conductor notify --tier urgent|info
  "<line>"` (reaches the human through Telegram/Slack/desktop). Core rule 5: "Never send messages
  to running sessions. Only respond to sessions in 'waiting' status."
- The CLI is a separate short-lived process. It reaches state through a **shared SQLite file** (WAL,
  `internal/statedb/statedb.go`, tables `instances`, `groups`, `instance_heartbeats`,
  `session_claims`, …, `withBusyRetry` "under heavy multi-writer load (multiple processes plus
  goroutines)") and **per-session hook files** written by Claude hooks
  (`hookStatusFilePath` → `<hooks>/<instanceID>.json`, `internal/session/transition_daemon.go:1577`).
  `session output` parses the Claude transcript (`internal/session/instance_transcript.go:45`).
- **No CLI→TUI channel.** `launch` creates the tmux session and the SQLite row from the CLI process
  itself (`cmd/agent-deck/launch_cmd.go:900`, `newInstance.StartWithMessage`). The TUI notices by
  polling: `internal/ui/storage_watcher.go` "observes committed material registry changes on a
  dedicated live SQLite connection", `pollInterval = 2 * time.Second`; `statedb.go:2316` labels the
  `last_modified` meta key "Change Detection (replaces fsnotify)". Several TUI processes coexist
  through `instance_heartbeats` + `ElectPrimary`.
- A second, older file channel exists: `internal/session/event_writer.go` writes
  `events/<instanceID>.json` "atomically … tmp file + rename to avoid partial reads by watchers",
  and `event_watcher.go` watches that dir with fsnotify. In this tree no caller of
  `WriteStatusEvent` remains outside its own file (grep), so it looks retired **(inferred)**.

### The transition notifier daemon and how it reaches the conductor

- `agent-deck notify-daemon` (`cmd/agent-deck/notify_daemon_cmd.go`) runs
  `session.NewTransitionDaemon()` (`internal/session/transition_daemon.go`): a **polling loop**,
  `notifyPollFast = 1s` while anything runs, `2s` if something waits, `3s` otherwise
  (`choosePollInterval`). Each pass refreshes statuses (tmux + hook files) and detects transitions.
- Delivery is **pull, through files**: `internal/session/inbox.go` — "Per-conductor inbox: a JSONL
  file at `<agent-deck-dir>/inboxes/<parent-session-id>.jsonl` — the durable per-parent outbox a
  conductor DRAINS at its own turn boundary (Stop hook) and on heartbeat". Records are
  `TransitionNotificationEvent{child_session_id, child_title, from_status, to_status, timestamp,
  substate, exit_code, last_output_hash}` (`transition_notifier.go:45`). Drain is "AT-LEAST-ONCE
  WITH DEDUP" via an in-flight WAL.
- **The Stop hook is the main injection path, not typing.** `internal/session/inbox_stophook.go`:
  "A conductor's Stop hook drains the durable outbox and returns `{decision:"block",reason}` so the
  completions are injected as the conductor's next turn input, at the moment it is provably free."
  Loop guard: `MaxStopHookBlocks = 3` consecutive blocks.
- **Typing is only a latency optimisation.** `inbox_nudge.go`: "this nudge is a pure latency
  optimization that wakes an IDLE parent sooner than its heartbeat by firing one debounced
  `send-keys` into its pane. It is gated on idle because a send-keys into a busy pane only queues the
  keystroke … Correctness never depends on the nudge landing." Confirmed in
  `inbox_nudge_wiring.go:233`: it shells out to `agent-deck session send <ref> <msg> --no-wait
  --no-tag -q`.
- **Heartbeat** = a shell script (`internal/session/conductor.go:1322`, `heartbeat.sh`, run by
  launchd/systemd timer **(inferred from the plist/teardown files)**) that asks
  `conductor heartbeat-tick` for a delta-only message and delivers it with `session send … --no-wait`
  (typing), only when the conductor is `idle|waiting`.

### How `session send` delivers

- Two transports (`cmd/agent-deck/session_send_transport.go`): `tmux` (default) and `socket`
  (opt-in, `send_transport = "auto"`). tmux = `send-keys -l` for short text, paste buffers for long
  text, then a lot of verification (`internal/send/send.go`: paste-marker counting, composer-ready
  checks, busy guards).
- `socket` is **Claude Code's own messaging socket** (`internal/send/claudesocket.go`, issue #2089):
  Claude publishes `~/.claude/sessions/<pid>.json` with `messagingSocketPath` and `peerProtocol`;
  agent-deck writes one JSON line `{msgV, msg_id, type, session_id, message:{role:"user",content},
  priority:"next"}` and closes. "The server NEVER writes anything back." It was reverse-engineered
  from the 2.1.259 binary by offsets, gated on `peerProtocol == 1` exactly, and falls back to tmux
  on any pre-write doubt. Undocumented interface.

### MCP Socket Pool

- `internal/mcppool/`: `SocketProxy` "wraps a stdio MCP process with a Unix socket" so many sessions
  share one MCP server process (JSON-RPC id rewriting per client, health monitor every 3s). Socket
  dir is user-private 0700. **Data plane for third-party MCPs only, never control.**
- agent-deck's only MCP server of its own is `agent-deck recall mcp` (`internal/recall/mcp/mcp.go`):
  stdio, three read-only tools (`recall_search`, `recall_show`, `recall_context`) over its own index.
  It has no session-control tools. A separate `agent-deck web` HTTP server (token-protected,
  `internal/web/`) serves a browser UI, not agents.

### Conductor files and who writes them

| File | Writer | Content |
|---|---|---|
| `conductor/<name>/meta.json` | agent-deck setup (`SaveConductorMeta`, atomic) | name, profile, heartbeat on/interval, `clear_on_compact`, env |
| `state.json` | the conductor (Claude) itself | per-session summaries, counters; "Read state.json at the start of each interaction" |
| `task-log.md` | the conductor | append-only action log |
| `ORDERS.md` | human or conductor | standing orders: a shell `check:` run on a schedule "with no AI"; on change the conductor is woken once (`internal/orders/orders.go`) |
| `HEARTBEAT_RULES.md` | human | text appended to heartbeats |
| `inboxes/<id>.jsonl` | notify daemon | transition records, drained by the Stop hook |

## 2. Backlog.md (TypeScript/Bun)

- **Transport: stdio only.** `src/mcp/server.ts` imports `StdioServerTransport` and nothing else;
  no `fetch`/HTTP in `src/mcp`. `McpServer extends Core` with `{ enableWatchers: true }`: the MCP
  process **is** a full in-process backlog engine over the Markdown files. It talks to no running
  process (not the board, no daemon). It sends `tools/resources/prompts listChanged` only when the
  project root changes (MCP roots), plus `sendLoggingMessage`.
- **Consistency between processes = the files + fs.watch.** `src/core/content-store.ts` watches the
  tasks, drafts, decisions and docs dirs with `fs.watch` (lines 1090–2036) and reloads per file. The
  web board (`src/server/index.ts`) uses the same `Core({enableWatchers:true})`, subscribes to the
  store and pushes changes to the browser over a WebSocket. CLI commands default to no watchers.
- **`task list --json --watch`** (`src/commands/watch-json.ts`): `fs.watch` on the backlog dir
  (recursive) and the config dir as hints, **plus** a `setInterval` every 1000 ms comparing a cheap
  `size/mtime/ctime` signature of the inputs ("Notifications are hints; a periodic stat pass repairs
  missed events"), 50 ms coalescing, one full JSON value per change.
- **Writes between agents** use `proper-lockfile` (`src/file-system/operations.ts:716–860`): a
  global create lock for ID allocation in `<git-common-dir>/backlog.md/locks` (so all worktrees
  share it), per-task file locks for edits, stale-lock recovery, and `writeFile(…, {flag:"wx"})`.
- **Coordinating agents is convention, not mechanism**: no claim/lease. Guidelines say set
  `-s "In Progress" -a @{myself}` when starting (`src/guidelines/agent-guidelines.md:322`);
  `checkActiveBranches` reads tasks on other branches/worktrees so an ID or a status is seen across
  them.
- **Tools** (24 distinct `name:` entries under `src/mcp/tools/`): `get_backlog_instructions`;
  `task_create|list|search|edit|view|archive|delete|restore`;
  `document_list|view|create|update|archive|restore|delete|search`;
  `milestone_list|add|rename|remove|archive`; `definition_of_done_defaults_get|upsert`. All are
  plain reads/writes of the backlog files; none waits for another process. **Resources**: `backlog://workflow/overview`,
  `…/task-creation`, `…/task-execution`, `…/task-finalization`, and `backlog://init-required` when
  the folder is not a project.

## 3. What this means for Menkar

What both projects share: **neither has a control channel into its running UI.** agent-deck's CLI
writes SQLite and drives tmux directly, and the TUI polls every 2 s; Backlog's MCP process owns the
files and the board watches them. Menkar differs in one way that matters: the ptys live **inside**
the app, so starting or renewing a session can only be done by the app — the MCP process must ask.

| Operation | Needs an answer? | C (files) enough? | Precedent |
|---|---|---|---|
| List sessions with state, context %, project, group, tab | Read only | **Yes**: app publishes a snapshot file (tmp+rename) on every state change; MCP reads it. Freshness = app's own detection latency. | agent-deck CLI reads SQLite + hook files; Backlog MCP reads the files |
| Show one session's last answer / report | Read only | **Yes**: read the transcript (Menkar's core already parses them) or a report file the worker writes | `session output` parses the Claude transcript |
| Start a session (name, project, prompt file, group) | Yes: ok / refused (not own project, project not open, name taken) + its id | **Yes, as request/response files**: MCP writes `req-<uuid>.json`, app writes `res-<uuid>.json`; MCP waits with fs.watch + a stat poll and a timeout | agent-deck `launch` is synchronous because the CLI does the work itself; Menkar cannot |
| Renew itself | Ack only; takes effect after the turn ends | **Yes**: fire-and-forget request; the app acts when the pane's state turns idle | agent-deck `clear_on_compact` / `session command /clear` |
| Post a topic/question for the human; read the human's answer | No | **Yes**: append to a file the app shows; answer comes back as a file (or as the next user turn) | `conductor notify --tier`; `state.json`, `task-log.md` |
| Be told a worker became idle / blocked / done | Push into a Claude turn | Files can carry it; **the hard part is waking the orchestrator, not the transport** | Stop hook `{decision:"block",reason}` drains a JSONL inbox; heartbeat + idle-gated `send-keys` |

On the last row, three ways that never type into a pane:
1. **Stop hook drain** (agent-deck's correctness path): Menkar's `--settings` gives the orchestrator a
   Stop hook that reads its inbox file and returns `{"decision":"block","reason":…}`. Works while
   the orchestrator is in a turn; with a loop cap.
2. **A blocking MCP tool** `wait_for_event(timeout)` that returns when the snapshot/inbox changes
   (long poll). Lets an idle orchestrator choose to wait. Implementable on files (the MCP process
   watches) **(inferred; neither project does this)**. Bounded by Claude Code's MCP tool timeout
   **(not verified)**.
3. Claude Code's messaging socket (`priority:"next"` user frame): no typing hazards, but
   reverse-engineered, version-pinned and unacknowledged; and it is still a message sent on the
   user's behalf. A decision for the human if ever considered.
An idle orchestrator with nothing in a turn cannot be woken by any of 1–2; only the human, a
heartbeat-like sender, or option 3 can. That is a product decision, independent of C vs A.

### C vs A, on the evidence

- **No operation needs a sub-second synchronous answer.** The only request/response ones (start,
  renew ack) tolerate 50–1000 ms, and files emulate RPC with a request/response pair.
- **What A buys:** immediate "app not running" (connection refused) instead of a timeout; no stale
  request files to sweep; caller identity through the connection (peer credentials on Linux;
  agent-deck has `internal/send/peerpid_linux.go`, `peerPIDOfFd`, used around its socket sends) rather than trusting `MENKAR_PANE` from the environment.
- **What C buys:** no server in main, nothing listening, debuggable with `ls`/`cat`, same shape on
  all three OSes; Menkar already writes JSON state through tmp+rename and watches the agents' folders.
- **Risks of C to design for:** `fs.watch` misses (Backlog adds a 1 s stat pass "to repair missed
  events"; agent-deck replaced fsnotify on the DB with a polled stamp); partial reads (write tmp +
  rename, as `event_writer.go` does); several Menkar processes (only one owns the requests folder —
  agent-deck's primary election shows the problem exists); app absent (MCP checks a `pid`/heartbeat
  file before writing a request, mirroring `instance_heartbeats`).
- **B (loopback HTTP + token)** has no precedent for agent control in either project (agent-deck's
  `web` is for browsers) and is the only option that opens a port; weakest fit for "nothing leaves
  the machine" in spirit **(inferred)**.

Recommendation **(inferred, for the human to decide)**: C — a published snapshot file, an inbox
JSONL per orchestrator, and request/response file pairs for `start_session`/`renew`, with fs.watch
plus a ~1 s stat pass and an app-alive file; wake the orchestrator by the Stop-hook drain, plus a
`wait_for_event` tool if the MCP timeout allows it. Move to A only if caller identity must be
proven by the kernel rather than by the environment.
