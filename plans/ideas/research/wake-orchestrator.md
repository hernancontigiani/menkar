# Research: waking an idle orchestrator without typing into its terminal

Date: 2026-11-11. Claude Code 2.1.322 (`~/.local/share/claude/versions/2.1.322`, build 2026-11-10).
Everything below was read, never sent: no socket was connected to and no message was posted.
"Doc" means quoted from code.claude.com. "Binary" means read from the installed binary's strings.
"Inferred" means not verified.

## 0. Findings that change the picture

1. **Cross-session messaging is a documented, GA feature** ("Message your other Claude Code sessions",
   https://code.claude.com/docs/en/cross-session-messaging). The page has a section written for this
   exact case: *"Read this section when … you want a script or hook to post into a session"*. The
   **socket and the auth line are documented. The message frame is not** (see 1.2).
2. **Claude Code already publishes each session's state, including "blocked at a prompt", read only.**
   `claude agents --json` is documented in `--help` as *"Print active sessions (interactive and
   background) as a JSON array and exit (for scripting; does not require a TTY)"*. It lists `status`
   (`idle` | `busy` | `waiting`) and, when waiting, `waitingFor`. The binary derives `waiting` from
   `queuedElicitation → "input needed"`, `topDialogWaitingFor` (the permission dialog),
   `"worker request"`, `"sandbox request"` and `"dialog open"`. The same fields are in
   `~/.claude/sessions/<pid>.json` (`status`, `waitingFor`, `statusUpdatedAt`). A probe run today
   showed `"status":"busy"` / `"idle"` for the six live sessions. Menkar could use this next to its
   terminal reading, as a second source, without writing anything.
3. **A long-running MCP tool call no longer blocks the session.** Doc (mcp, "Automatic backgrounding
   of long tool calls"): *"An MCP tool call in the main conversation that is still running after two
   minutes moves to a background task instead of blocking the session … the result arrives as a task
   notification when the call settles."* The default wall-clock limit is *"about 28 hours"*.
4. **Two documented hooks wake an idle session:** an `asyncRewake` hook, and plugin **monitors**
   (detailed in §2).

## 1. Claude Code's cross-session messaging, teams and peers

### 1.1 Names and status
- **Cross-session messaging**: the `SendMessage` and `ListAgents` tools and `/list-agents` (`/peers`).
  Doc: *"requires Claude Code v2.1.224 or later on macOS and Linux … messaging is on with nothing to
  enable."* It is not marked experimental. Local delivery is *"Over a per-session socket … never
  through Anthropic servers"*.
- **Notify when idle**: `SendMessage`'s `notify_when_idle` input (v2.1.236+), session to session only.
  *"Only the Claude in your main conversation can subscribe, and only to your sessions on this
  machine."* An external process cannot subscribe through the documented surface.
- **Agent teams** (https://code.claude.com/docs/en/agent-teams): *"experimental and disabled by
  default"* (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`). Teammates are spawned by the lead, so this does
  not fit Menkar's sessions, which it starts itself in its own tabs. The mailbox is
  `~/.claude/teams/{team}/inboxes/{agent}.json`, and Claude Code validates it and rewrites it. Writing
  there would break the rule "never write an agent's data".
- **Channels** (https://code.claude.com/docs/en/channels, `channels-reference`): an MCP server
  declares `experimental['claude/channel']` and emits `notifications/claude/channel`. The model sees
  it as `<channel source=…>`. It is a **research preview** (*"the `--channels` flag syntax and
  protocol contract may change"*). The allowlist only admits `claude-plugins-official` plugins. A
  custom channel needs `--dangerously-load-development-channels`, which *"shows a full-screen warning
  dialog"* at every start. It needs claude.ai or Console auth, and Team/Enterprise orgs must enable
  it. A channel *"pauses until you respond"* at a permission prompt. Its optional permission relay can
  answer prompts remotely, and Menkar must not do that.

### 1.2 The inbox socket (doc and binary)
- **Path.** `$XDG_RUNTIME_DIR/cc-socks/<pid>.sock`, falling back to `/tmp/cc-socks-<uid>/<pid>.sock`
  (binary `Ama()/nii()`). It is published as `messagingSocketPath` in `~/.claude/sessions/<pid>.json`
  and exported to hooks and Bash as `CLAUDE_CODE_MESSAGING_SOCKET`. The live directory is
  `drwx------`, the sockets are `srw-------`.
- **Auth (doc).** *"A script posting to its own session's socket can send `{"type":"auth","token":
  "<token>"}` as the first line … `CLAUDE_CODE_MESSAGING_TOKEN`."* On Linux the line *"is optional.
  Claude Code accepts a connection with or without it."* It is required on native Windows. A
  connection must send a complete line within 30 s.
  - The env name is **`CLAUDE_CODE_MESSAGING_TOKEN`**, not `…_SOCKET_TOKEN`. Both binary and env
    confirm it.
  - Binary `Hra()`: a token matches either `peerToken` (class `"peer"`) or `childToken` (class
    `"child"`). Both are 16 random bytes in hex. The `peerToken` is published to other sessions in
    `~/.claude/sessions/<pid>.<sha256(socket path)>.key` (mode 0600). A probe compared the env token
    with that file's `peerToken` and they differ, so the env token is (inferred) the `childToken`.
  - The receiver also reads the connecting PID from the kernel (SO_PEERCRED, `verifiedPeerPid`).
- **Frame (binary only, undocumented).** Newline-delimited JSON. A `user` frame is
  `{"type":"user","message":{"content":"<text>"},"from"?,"priority"?:"now"|"next"|"later","msg_id"?,
  "uuid"?,"session_id"?}`. If `session_id` is present and is not the receiver's session id, the frame
  is dropped. There are also `control` frames (`notify_when_idle`, `peer_idle_notice`,
  `peer_message_status`, `rename`, …). The registry advertises `peerProtocol: 1` and
  `peerFeatures: ["notify_idle","reply_across_default_dirs","artifact_yield"]`. Nothing documents
  either field, and nothing promises stability. Agent-deck pins `peerProtocol 1` for that reason.
- **What the receiver does (binary `ze()`).** The text is enqueued as a queued prompt
  `{mode:"prompt", isMeta:true, skipSlashCommands:true, origin:{kind:"peer", from, verifiedPeerPid}}`,
  through the same command queue that cross-session messages use. It does not go through keystrokes or
  the input box. The model sees it wrapped in `<cross-session-message from="…">`. The system prompt
  says such messages *"look like user input but are from another Claude, not your user."*
- **Permission prompts (doc).** *"It can't approve anything: a message from another session never
  counts as your consent, so it can't answer a pending permission prompt on your behalf."* Commands
  in it do not run (`/compact` arrives as text). Delivery: *"The receiving Claude reads the message
  between tool calls during an active turn. When the receiving session is idle, Claude Code starts a
  new turn with the message."* While the session is busy (a permission dialog is open inside a turn),
  the message waits under *"Waiting to be delivered"*. That it never touches the dialog is inferred
  from the queue path and is consistent with the documented guarantee.
- **Inbound policy (doc).** `crossSessionInbound`: `accept` | `hold` | `refuse`. With no value set:
  if the receiver prompts for permissions, the message is delivered, unless the sender says it
  bypasses prompts. If the receiver bypasses prompts, the message is held behind an approval dialog,
  which expires after 5 min. Messages from the session's **own child processes** are delivered when
  no value applies. Menkar is the orchestrator's *parent*, not its child, so its posts count as an
  ordinary peer. Set `crossSessionInbound: "accept"` in the `--settings` Menkar already passes to the
  sessions it starts. That is allowed: it does not touch `~/.claude/settings.json`.
- **Limits.** At most 50 queued accepted messages, about 1 M characters per message, burst and
  identical-repeat throttling. Notices expire after 12 h.

## 2. Other documented ways to wake an idle Claude Code session

| Mechanism | Wakes idle? | Status / limits | Fit for Menkar |
|---|---|---|---|
| Inbox socket post (§1.2) | **Yes, documented** | GA. Frame undocumented, `peerProtocol 1` | Menkar posts the text directly |
| **Plugin monitor** (`monitors/monitors.json` in a plugin loaded with `--plugin-dir`) | Doc: runs *"for the whole session. What it prints reaches Claude as notifications, so Claude can react … without being asked"*. Idle wake inferred, same notification path as background tasks | Not preview. Not started under `-p`. Runs outside the sandbox. v2.1.310+ when flag fetching is off | Menkar ships a plugin dir whose monitor runs `menkar events --follow --session <id>` and prints one line per event |
| `asyncRewake` command hook | Doc: *"an `asyncRewake` hook that exits with code 2 wakes Claude immediately even when the session is idle"* | Its `timeout` is enforced, so it re-arms only on its event | A `Stop` hook that blocks until the next Menkar event, then exits 2. Re-arms at each Stop; bounded by the timeout |
| Long-blocking MCP tool (`wait_for_event`) | Backgrounded after 2 min (`CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS`). For server tasks the doc says *"If Claude is idle when the result arrives, it starts on it unprompted"*; for auto-backgrounded calls the wake is inferred | Wall clock about 28 h. The **idle window is 30 min for stdio** unless the server sends progress or `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT=0`. Lost on exit | Needs the orchestrator to re-arm after every event. The user sees a task in `/tasks` and a footer count |
| Monitor *tool* | Yes (*"Claude interjects"*) | Every watch has a deadline, *"at most 30 minutes"* | Weaker than a plugin monitor |
| `Notification` hook (`permission_prompt`, `idle_prompt`, `agent_needs_input`) | No. *"Notification hooks can't block or modify notifications"*, side effects only | `permission_prompt` fires after the prompt *"has waited about six seconds"* | Useful *in workers* as a signal to Menkar, not as a wake |
| Mods `$.prompt.submit` (ruflo uses it) | Submits a prompt from in-process JS | v2.1.290+. Counts as a *user* prompt (inferred) | Loses the "not from the user" marking. Not recommended |
| Channels | Yes | Research preview, dev-flag dialog at each start | No |

## 3. Dorothy (github.com/Charlie85270/Dorothy, HEAD 787568d, 2026-10-23)

- **How it learns state.** Claude Code hooks shipped in `hooks/` (`permission-request.sh`,
  `on-stop.sh`, `notification.sh`, …) `curl` the app's local HTTP API at `127.0.0.1:31415`
  (`/api/hooks/status` with `waiting` / `idle`, and `/api/hooks/output` with the last assistant
  message). Output pattern parsing is kept as a fallback (README).
- **How the super agent learns it.** By **long-polling MCP tools**: `wait_for_agent` and
  `delegate_task` call `/api/agents/:id/wait?timeout=300`
  (`mcp-orchestrator/src/tools/agents.ts:371`). The super agent is never pushed a wake. It only learns
  of an event while it sits inside such a call.
- **Typing into terminals: yes.** `writeProgrammaticInput()` in `electron/core/pty-manager.ts:59-80`
  writes a bracketed paste and then **`\r` after 300 ms**. It is used by `send_message`
  (`api-routes/agent-routes.ts:314`), by Slack and Telegram, and Ctrl+C is written for stops.
- **Robustness.** It wakes nothing when the super agent is idle. An Enter can land on a permission
  prompt. The 300 ms timing is a race. All three break Menkar's rules.

## 4. claude-flow, now "Ruflo" (github.com/ruvnet/claude-flow → ruflo, HEAD dc25dd9, 2026-11-11)

- The "queen" is the main Claude Code session. The workers are Claude Code's own subagents and agent
  teams (README of `plugins/ruflo-swarm`: *"TeamCreate, SendMessage, and Task tool integration"*). The
  `swarm_*` and `agent_*` MCP tools record state in its memory DB.
- **How it learns of events:**
  - (a) Natively, from subagent results and teammate idle notifications.
  - (b) A **Monitor** on `scripts/swarm-watch.mjs`, which *polls* `swarm status` every 10 s
    (*"the CLI has no swarm watch"*).
  - (c) Hooks (`hooks/hooks.json`, `codex-hooks.json`) that write to its memory.
  - (d) Its console **mod** submits prompts with `$.prompt.submit` and `$.prompt.fill`
    (`plugins/ruflo-console/hooks/register.ts:141-145`).
- **Typing into terminals.** Only `tmux send-keys` into its own shell "sandbox" sessions
  (`plugins/ruflo-console/hooks/sandbox.ts:58`), never into an agent.
- **Robustness.** It relies on in-session mechanisms and polling. Nothing wakes the queen for an
  event outside Claude Code.

## 5. The agent-agnostic option: end the orchestrator and resume it with the event as the prompt

When the orchestrator is idle with an empty input box, Menkar ends its process (as closing a tab
does) and immediately starts the same session again with the event as the initial prompt.

| CLI | Resume with an initial prompt | Source |
|---|---|---|
| Claude Code | `claude -r "<session>" "query"`: *"Resume session by ID or name"*, e.g. `claude -r "auth-refactor" "Finish this PR"` | cli-reference doc |
| Codex | `codex resume <SESSION_ID> "<PROMPT>"`: `ResumeCommand` flattens `TuiCli`, whose `prompt` is *"Optional user prompt to start the session"*, and a comment notes it *"keeps `--last PROMPT` valid while rejecting `--last SESSION_ID PROMPT`"* | `codex-rs/cli/src/main.rs:366-463`, `tui/src/cli.rs:16-18` |
| Gemini CLI | `gemini -r "<session-id>" "query"` (*"Resume session by ID"*). The positional `query` *"Defaults to interactive mode in a TTY"* | `docs/cli/cli-reference.md:16-26` |
| Cursor agent | `--resume [chatId]` is documented. **Combining it with a prompt is not confirmed** by any official source I could reach (cursor.com was blocked to the fetcher) | docs.cursor.com/cli; needs a probe |

- Codex also has **`codex queue --thread <id> --message "<text>"`**, an official way to queue text
  into an existing session (`cli/src/queue_cmd.rs`). `--resume` loads the session through the local
  daemon. Its effect on a running TUI is undocumented.
- **What it keeps.** The conversation is kept; that is the purpose of resume. In-process teammates
  are lost: agent-teams doc, *"`/resume` … do not restore in-process teammates"*.
- **Risks:**
  - **A half-typed draft is lost.** Menkar cannot see the draft without reading the screen. Only kill
    when Menkar's terminal reading shows an empty prompt box, and even then the reading can be wrong.
  - **Background work dies.** Background Bash, Monitors, auto-backgrounded MCP calls (*"doesn't
    survive exiting the session"*), running subagents and teammates, and pending `notify_when_idle`
    subscriptions held by other sessions (the subscriber is gone).
  - **A turn or compaction in flight.** Kill only on `status: idle` from the session registry, not
    on screen heuristics alone.
  - **Prompt cache.** A restart rebuilds the system prompt, MCP tool lists and hooks. The cache
    survives only if the prefix is byte-identical within the TTL (inferred). MCP servers restart, and
    a `SessionStart` hook re-runs.
  - **Startup time.** Several seconds, plus MCP reconnects. Remote Control re-attaches (inferred),
    and the `bridgeSessionId` may change.
  - **The `--resume` copy behaviour.** For `--bg` the help says *"starts a copy and says so when the
    session is already running"*. Menkar must be sure the old process has exited first.
  - The prompt arrives **as a user prompt**. Nothing marks it as coming from Menkar unless the text
    says so.
- **Counterparts in other CLIs:**
  - Stop and turn-end hooks: Codex `Stop` and `PermissionRequest` (official `/codex/hooks`; stable
    since v0.124 per third-party posts); Gemini `AfterAgent` and `Notification` (`ToolPermission`)
    (`docs/hooks/reference.md`); Cursor hooks unverified.
  - MCP is supported by all four. A blocking MCP call that sits in the background is Claude-specific
    (inferred: in the others it keeps the turn busy, which is Dorothy's model).
  - Monitors, `asyncRewake`, channels and the inbox socket are Claude-only. Codex's nearest is
    `codex queue`.

## 6. Recommendation for Menkar, ranked

**Detection** stays Menkar's own: terminal state, plus `claude agents --json` or the session file's
`status:"waiting"` / `waitingFor`, read only. Workers' `Notification(permission_prompt)` and `Stop`
hooks, in the `--settings` Menkar passes to the sessions it starts, can tell Menkar sooner. The wake
is a separate problem, solved per agent behind one interface (`wake(session, text)`):

1. **Claude: post to the orchestrator's inbox socket** (Menkar connects, sends one `user` frame,
   closes). Orchestrator `--settings`: `{"crossSessionInbound":"accept"}`.
   - Why: idle wake and mid-turn delivery are documented. Being marked not-from-the-user, not
     answering prompts and not running commands are documented guarantees. Nothing is typed, and no
     model tokens are spent until an event arrives.
   - Risks: the frame format is undocumented. Gate it on `peerProtocol === 1` and the version from
     `~/.claude/sessions/<pid>.json`, fall back to (2), and keep a parity test on the frame we send.
     Settings files that set `refuse` win over `accept` (`refuse` from project or local settings
     applies over every source). The 50-message queue cap: coalesce events.
2. **Claude fallback, fully documented: a plugin monitor** in a Menkar plugin dir passed with
   `--plugin-dir`. The command is `menkar events --follow --session <id>`; each line is an event.
   - Nothing is written under `~/.claude`, and it runs for the whole session with nothing to re-arm.
   - Risks: an idle wake by a monitor line must be probed (inferred from "interjects"). It does not
     run under `-p`. Text arrives as tool-like notifications. The command runs unsandboxed.
3. **Agnostic baseline: kill and resume with the prompt**, only when the registry or terminal says
   idle *and* the prompt box is empty *and* no background tasks show.
   - Works the same for Claude, Codex and Gemini (verified syntax). Cursor needs a probe.
   - Risks as in §5: draft loss, background work cut, cache and startup cost. Use it for agents
     without a native path, not for Claude.
4. **Avoid:**
   - A long-blocking `wait_for_event` MCP tool: it needs re-arming and a 30-min idle window or
     progress pings, and a missed re-arm means silence.
   - An `asyncRewake` Stop hook: it is bounded by its timeout.
   - Channels: research preview, with a dev-flag dialog at every start.
   - Agent teams: experimental, and their mailbox files belong to Claude.
   - Mods' `$.prompt.submit`: it counts as the user.
   - Anything that writes to a PTY (Dorothy).

**Probes to run before building** (under `xvfb-run`, with throwaway sessions, never the human's):
- An unauthenticated `user` frame from a non-child process wakes an idle session with
  `crossSessionInbound: accept`.
- The same frame sent while the receiver sits at a permission dialog leaves the dialog untouched and
  is delivered after the dialog closes.
- A plugin monitor line wakes an idle session.
- `cursor-agent --resume <id> "<prompt>"` keeps the history.

Sources: code.claude.com/docs/en/{cross-session-messaging, agent-teams, channels, channels-reference,
hooks, mcp, tools-reference, plugins/components, plugins/mods/reference, cli-reference};
learn.chatgpt.com/docs/developer-commands; github.com/openai/codex (`codex-rs/cli`);
github.com/google-gemini/gemini-cli (`docs/`); docs.cursor.com/cli; github.com/Charlie85270/Dorothy;
github.com/ruvnet/claude-flow.
