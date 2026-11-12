# Plan 31: sessions that renew themselves, start others, and wake their parent (1.70, 1.72, 1.73)

> **Status:** written 2026-11-11 by `set` with the human (1.70, 1.72) and three measured studies
> (`prompts/reports/b2-session-control-research.md`, `b2-wake-probes.md`,
> `research-orchestrator-transport.md`, `research-wake-orchestrator.md`; gitignored, one-shot).
> Ready to execute.
>
> **Exit, when executed:**
> - `docs/session-control.md` (new): the MCP server, the files it shares with main, the four
>   tools, renewing, starting, parents and waking, with "Rejected" below and the measured facts
>   the design rests on. Its row enters `CLAUDE.md`'s subsystem table ("Open it when: Menkar's MCP
>   server, renewing or starting a session from an agent, parents, or waking a session").
> - `docs/context.md`: the `--settings` file gains a Stop hook, a permission rule and
>   `crossSessionInbound` (one paragraph each); `docs/projects.md`: the `parents` key.
> - `docs/NOT_BUILT_YET.md`: waking an agent other than Claude Code (STATUS 2.21 is its trigger),
>   the CLI form of the tools.
> - `plans/00-STATUS.md`: this row leaves §3 (closing note to its history); 1.70 and 1.72 point to
>   `docs/session-control.md`.
> - The rest → `git log`.
>
> Replaces nothing. Does not touch the rule that nothing is typed into a running agent: a message
> through Claude Code's documented cross-session messaging is not typing (1.72).

## Goal

Take the human out of two manual loops. A session renews itself when its task is done (a `/clear`
nobody types); an orchestrator starts its workers in Menkar tabs (no copied `claude -n …`
commands); and a parent session is woken when a worker it started needs it or finishes, so the
human waits for the orchestrator instead of polling.

## What already exists (verified 2026-11-11)

- **`--settings` per Claude session**: `writeSessionSettings` (`src/core/context/settings.ts:111`)
  writes `<config>/claude-settings.json` with the statusline and the SessionStart hooks; the
  statusline runs as `ELECTRON_RUN_AS_NODE=1 <execPath> <script>` (`statuslineCommand`,
  `src/main/context.ts:12`), its script built as its own entry (`electron.vite.config.ts:15`).
- **Records main watches**: the SessionStart hook writes `<cache>/session-starts/<id>.json` with
  the pane (`MENKAR_PANE`, 1.56); `src/main/pane-starts.ts` watches it with `fs.watch` and calls
  `followPaneStart` in `src/main/workspace.ts`.
- **Re-keying a pane's session**: `followNewId`, `followNewIdInLayout`
  (`src/core/projects/rekey.ts`), `followRemoteControl` (`src/core/remote.ts`), earlier
  conversations (`src/core/projects/earlier.ts`, 1.63).
- **Agent commands**: `buildCommand` (`src/core/command.ts:27`): `new` with `--session-id`, `-n`,
  `--remote-control=`; `addDirs` (plan 30); `--settings` last before `&& exit`. Pane env:
  `StartOptions.env` (`src/main/terminal.ts`), `{ [PANE_ENV]: id, MENKAR_FILES }` in
  `startPaneHeld`.
- **Agent state per pane**: `track()` in `src/main/agentstate.ts:111` over `PaneWatcher`
  (`src/core/agentstate/watch.ts`), shown `working | blocked | idle | done`.
- **Hang-up**: closing a tab hangs up the shell and the agent's process group, then the reaper
  (1.48).
- **Measured on Claude Code 2.1.322** (the studies above): `--mcp-config <inline JSON>` adds a
  server to the user's own (no `--strict-mcp-config`), listed under "Built-in MCPs", nothing
  written to `~/.claude`; `mcpServers` in `--settings` is ignored; a stdio server inherits the
  pty's env (`MENKAR_PANE`); `permissions.allow: ["mcp__menkar"]` in `--settings` removes the
  prompt in every mode; a `Stop` hook fires at the turn's end with `MENKAR_PANE` in its env and
  `session_id` on stdin; a JSON-RPC loop of ~40 lines served everything Claude Code sent
  (`server/discover` refused with -32601, `initialize`, `notifications/initialized`, `tools/list`,
  `tools/call`); a post to a session's messaging socket from a non-child process wakes it when
  idle (≈50 ms), leaves a permission card untouched and is delivered after it closes, is held in
  bypass mode unless `crossSessionInbound: "accept"` is set; the frame is one JSON line
  `{"type":"user","message":{"content":"…"},"from":"menkar","msg_id":"…"}`, no reply, no auth line
  on Linux; `~/.claude/sessions/<pid>.json` holds `sessionId`, `messagingSocketPath`,
  `peerProtocol: 1`, and `status: waiting` / `waitingFor: "permission prompt"` at a card.

## The design

### Decided by the human (1.70, 1.72)

1. Menkar's own MCP server, `menkar`, given to every Claude session Menkar starts through
   `--mcp-config` (inline JSON); its tools need no permission (`mcp__menkar` allowed in Menkar's
   `--settings`). Nothing written under `~/.claude`.
2. **`renew`**: once the caller's turn is over, Menkar hangs it up and starts a fresh session in
   the same tab with the same name and an optional first prompt; the old one becomes its earlier
   conversation; group, leader mark, hidden flag and Remote Control follow, as after a `/clear`.
   A session renews only itself.
3. **`start_session`**: a new Claude session in the caller's project, its tab right after the
   caller's, **not selected**; name, an optional prompt (from a file), Remote Control, an existing
   group.
4. **Files, no socket, no port** between the MCP process and main: request and response pairs, a
   snapshot of the project's sessions, a file saying Menkar is alive; `fs.watch` plus a 1 s check.
5. **Waking**: Menkar posts events to the parent through Claude Code's documented cross-session
   messaging; `crossSessionInbound: "accept"` in Menkar's `--settings`. One `wake(session, text)`
   per agent; only Claude Code's is built here.

### Decided by `set` within those (technical, 2026-11-11)

6. **Three tools, not two**: `renew { prompt? }`, `start_session { name, prompt?, prompt_file?,
   remote_control?, group? }`, and `list_sessions {}` (the caller's project: name, id, shown
   state, context %, parent, whether it has a tab) — the published snapshot of decision 4 is what
   it reads, and an orchestrator without it would have to ask each worker.
6b. **A fourth tool, `last_reply { name }`** (1.73): the last reply of a session of the
    caller's project, read from its transcript in main (read only, from the file's end, never the
    whole file of tens of MB; at most 20,000 characters, cut with a note). A worker's report is its
    last message, written once; the orchestrator reads it here instead of a report file.
7. **The server process** is a new built entry, `src/core/control/server.ts` (like the statusline:
   no Electron, no DOM), run as `ELECTRON_RUN_AS_NODE=1 <execPath> <script>`; a hand-written
   newline-delimited JSON-RPC loop, no `@modelcontextprotocol/sdk` (18 runtime dependencies for
   four tools). Errors come back as `{ content: [{type:"text", text}], isError: true }` with our
   own English sentence. It reads its pane from `MENKAR_PANE` and refuses every call without one.
8. **The files**, under `<cache>/control/` (resolved through the paths module):
   - `alive.json` — main's pid and start time, written at start and removed at quit; the server
     answers "Menkar is not running" when it is missing or its pid is gone.
   - `requests/<id>.json` → `responses/<id>.json` — each written to a temporary name and renamed;
     the server waits up to 10 s for its response (`ok` with a short result, or a refusal sentence)
     and deletes it. Main, on every `fs.watch` event **and** every 1 s, lists `requests/`, handles
     each one once (by id), writes its response and deletes the request. A request older than
     60 s is dropped with a log line (Menkar was closed).
   - `snapshot/<project id>.json` — written by main, debounced 250 ms, whenever a session of the
     project changes state, context, tab or membership.
   - `turn-ends/<pane>.json` — written by the Stop hook (decision 9).
9. **The turn's end** comes from a `Stop` hook in Menkar's `--settings`, the statusline script with
   the argument `turn-end`, writing `turn-ends/<pane>.json` (`session_id`, `at`). A `renew` waits
   for it; if none comes within 10 minutes, the shown state turning `idle` or `done` after the
   request is the fallback. The record is not trusted for its pane alone: its `session_id` must be
   the pane's.
10. **Renewing** reuses the follow of a `/clear`: a new id chosen by main, the hang-up of 1.48,
    then `claude --session-id <new> -n <name> [--remote-control=<name>] [<prompt>]` in the same
    pane, then `followNewId` + `followNewIdInLayout` + `followRemoteControl` + the earlier
    conversation, exactly as `followPaneStart` does for `source: "clear"`. Starting the command
    first and re-keying second would race the SessionStart record: re-key first, then start.
11. **Prompts on the command line** go as `"$(cat '<file>')"`: main copies the prompt (text, or the
    `prompt_file` — absolute, a regular file, at most 100 KiB, UTF-8, read in main) into
    `<cache>/control/prompts/<id>.md` and the command reads it. Never interpolated, so no quoting
    of the prompt itself. `buildCommand` gains `promptFile?: string`, Claude only, placed before
    `--settings`. The copies are deleted after 24 h.
12. **Parents**: a session started by `start_session` records its starter as its parent, in
    `projects.json` on the project (`parents: { <child id>: <parent id> }`, written only when not
    empty, read leniently, ids not members dropped, re-keyed by `followNewId` like `earlier`). A
    renew of the parent re-keys it; a child removed (1.66) leaves it.
13. **What wakes a parent**: a child's shown state entering `blocked` → "‹name› is waiting at a
    permission prompt"; leaving `working` for `idle` or `done` → "‹name› finished its turn". Per
    child, debounced 3 s; several pending events go in one message. Never a child's own posts
    (those already go by `SendMessage`). The parent must be a Claude session with a tab; else the
    event is logged and dropped.
14. **The post**: main finds the parent's process in `~/.claude/sessions/*.json` by `sessionId`
    (read only), requires `peerProtocol === 1` (else: log once per session, no post), connects to
    its `messagingSocketPath`, writes the frame of the facts above with `from: "menkar"`, a fresh
    `msg_id` and the content `"[Menkar] <events>"`, and closes. Nothing is read back. Async, never
    on the UI path. The post connects to a socket Claude Code publishes for exactly this; no file
    under `~/.claude` is written.
15. **`crossSessionInbound: "accept"`** goes in the `--settings` of every Claude session Menkar
    starts. Its cost, measured: in bypass mode a post from any local process is delivered without
    the hold card. Acceptable: only the user's own processes can reach the socket, and a post can
    never answer a permission prompt.
16. **The tab of a started session** opens after the caller's tab in the window that holds the
    project; the window's selected tab does not change; the new session is a member of the
    caller's project (and of `group` when it names an existing one; an unknown group is refused).
    A `name` already used by a session with a tab in the project is refused.

17. **A session is addressed by its name, never by its id** (the human, 2026-11-11: a renew or a
    `/clear` gives a session a new id, and a message sent to the old id is lost). The tools take
    and return names: `last_reply { name }`, `list_sessions` lists names first (the id only as
    information), `start_session` returns the name. The parent of a child is recorded by id but
    re-keyed on every follow (decision 12), so a wake reaches the renewed parent. A name is unique
    among the project's sessions with a tab (decision 16), which is what makes it a handle. The
    skills (next plan) tell agents to message each other by name.

### Rejected, and why

- **A Unix socket or named pipe owned by main** (study A): needed only for a synchronous answer;
  no operation needs one under a second, and files reuse the session-starts pattern.
- **A loopback HTTP port** (study B): the only option that opens a port; no precedent for agent
  control in agent-deck or Backlog.md.
- **SQLite for the shared state**: it cannot tell another process that something changed
  (agent-deck polls every 2 s for that), and a second SQLite file amends the rule that the app's
  state is JSON.
- **Typing into the parent's terminal** to wake it (agent-deck's `session send`, Dorothy): against
  the rule; for agents without a message channel it is STATUS 2.21, open.
- **A long-blocking `wait_for_event` tool**: the orchestrator shows as working, the human's own
  messages queue behind it, and after 2 minutes Claude Code backgrounds the call.
- **A plugin monitor** as the wake (measured to work): a running monitor makes the session report
  `shell` / `busy` while idle, hiding the very state Menkar reads, and outlives a killed agent.
- **`@modelcontextprotocol/sdk`**: 18 runtime dependencies for four tools.
- **`--strict-mcp-config`**: would drop the user's own MCP servers from Menkar's sessions.

## Tests that hold the decisions (written before the code, in the block that names them)

| Decision | Test | Case → expected |
|---|---|---|
| 7 protocol | `tests/core/control/server.test.ts` | `server/discover` → -32601; `initialize` echoes the protocol version, `capabilities.tools`; `tools/list` names exactly `renew`, `start_session`, `list_sessions`, `last_reply`; no `MENKAR_PANE` → every call `isError` with our sentence |
| 8 files | same | a call writes a request by rename (never a partial file), waits for its response, deletes it; no `alive.json` → "Menkar is not running" at once; a response after 10 s → timeout sentence |
| 8 main side | `tests/core/control/requests.test.ts` | a request is handled once even when seen by the event and the 1 s pass; a 61 s old request is dropped; a malformed one gets a refusal response |
| 11 prompt | `tests/core/command.test.ts` | `promptFile: "/c/p 1.md"` → `"$(cat '/c/p 1.md')"` before `--settings`; Cursor → none; `tests/core/control/prompt.test.ts`: a relative path, a folder, 100 KiB + 1, NUL bytes → refused |
| 12 parents | `tests/core/projects/parents.test.ts` | round trip; a file without the key unchanged; a non-member dropped; `followNewId` moves a parent key and a parent value; a removed child leaves |
| 13 events | `tests/core/control/events.test.ts` | working→blocked → one "waiting at a permission prompt"; working→done → "finished its turn"; two events within 3 s → one message; idle→idle → none; no parent → none |
| 14 frame | `tests/core/control/post.test.ts` | the exact line `{"type":"user","message":{"content":"[Menkar] …"},"from":"menkar","msg_id":"<id>"}\n` (parity with the measured frame); `peerProtocol: 2` → no post; a temp Unix socket server receives exactly one line and the client closes |
| 1, 9, 15 settings | `tests/core/context/settings.test.ts` | the file holds `permissions.allow` with `mcp__menkar`, a `Stop` hook running the statusline with `turn-end`, `crossSessionInbound: "accept"`, and still the statusline and SessionStart hooks |
| 2, 10 renew | `e2e/session-control.spec.ts` (new) | the stand-in claude, told `RENEW`, writes a request as the server would, then its Stop record: the pane's shell gets a new command with a new `--session-id` and the same `-n`; the old id is an earlier conversation; one row; Remote Control followed |
| 3, 16 start | same | a `start_session` request from tab A → a tab right after A, A still selected, the command has `-n`, `--session-id`, the `"$(cat …)"` prompt; the new session is a member (and in the named group); an unknown group or a taken name → a refusal response, no tab |
| 6 list | same | `list_sessions` (via the request files) lists the project's sessions with their shown state and parent |
| 6b last reply | `tests/core/control/lastreply.test.ts` | a transcript whose last assistant entries are text, a tool call, then text → the last text; 30,000 characters → 20,000 and the note; a session of another project → refused; the file's bytes and mtime unchanged |
| 13, 14 wake | same | with a temp HOME whose `sessions/<pid>.json` points at a test socket: a child started by A turns blocked → the socket receives one frame naming it |

## Out of scope

- The skills that use these tools (`menkar-orchestrator`, `menkar-worker`, `menkar-distill`,
  1.71): the next plan, so they name tools that exist.
- Waking or controlling Codex, Gemini or Cursor sessions (2.21).
- The CLI form (`menkar session …`) of 1.70: deferred to `docs/NOT_BUILT_YET.md` with its trigger
  "a session without MCP, or the human, needs to renew or start a session"; the request files
  already make it a thin writer.
- A board, topics or inboxes beyond the wake message (Idea 2).
- Stopping or messaging other sessions through Menkar (agents already message each other).
- Windows and macOS (plan 27): named pipes, `sessions/<pid>.json` paths.

## Do not touch

- The user's `~/.claude`: read `sessions/*.json` only; no file written there.
- `buildCommand`'s existing order and quoting; `--settings` stays last before `&& exit`.
- The `/clear` and `/resume` follow (1.56, 1.57, 1.63): `renew` calls it, never copies it.
- The rule that nothing is typed into a running agent: no code here writes to an agent's pty
  except the command line into its own shell before the agent starts, as today.

## Execution blocks

### Block 1 — core: protocol, files, prompt, parents, events, frame

- [ ] Write the core tests above; see them fail.
- [ ] `src/core/control/`: the JSON-RPC loop and the four tools over the request files (`server.ts`
      as a built entry beside the statusline's), the request/response/alive/snapshot file helpers,
      the prompt check, the event debouncer, the frame builder.
- [ ] `promptFile` in `buildCommand`; `parents` in the projects store and in `followNewId`;
      `forgetSession` drops it.
- **Verify:** `npm run ci`.

### Block 2 — main: settings, requests, renew, start, list

- [ ] `--settings`: `permissions.allow`, the `Stop` hook (`turn-end` in the statusline script
      writing `turn-ends/<pane>.json`), `crossSessionInbound`.
- [ ] `--mcp-config` inline for every Claude pane (the server entry, `ELECTRON_RUN_AS_NODE`).
- [ ] `src/main/control.ts`: `alive.json`, the request watcher (`fs.watch` + 1 s), the four
      handlers (`last_reply` reads the transcript from its end through `src/core/sessions/`), the snapshot writer, the turn-end watcher; renew and start through `workspace.ts`
      (re-key first, then start; the tab after the caller's, selection unchanged).
- **Verify:** `npm run ci`; `npm run ui-check` on the new spec's renew, start and list cases.

### Block 3 — waking the parent

- [ ] Hook the event debouncer to `track()`'s transitions (`src/main/agentstate.ts`); the post to
      the parent's socket (read `~/.claude/sessions/*.json`, `peerProtocol === 1`), async, logged.
- [ ] The e2e wake case.
- **Verify:** `npm run ci`; `npm run ui-check` (full).

### Block 4 — a real check, then docs

- [ ] Under `xvfb-run`, with the real `claude` in a throwaway HOME (as the studies did; never the
      human's `~/.claude` or sockets): a session calls `start_session` and `renew` for real through
      the MCP server, and a started child blocking at a permission card wakes its idle parent.
      Write what was seen in the execution log.
- [ ] `docs/session-control.md` (new) with its row in `CLAUDE.md`; `docs/context.md`,
      `docs/projects.md`, `docs/NOT_BUILT_YET.md`.
- [ ] Execution log below.
- **Verify:** `npm run ci`.

## Execution log

Executed by `b2`, 2026-11-11, all four blocks. Every new test was seen red, either before its code
existed or against an injected defect. Gates after the last block: `npm run ci` passes every step
(913 Vitest tests); `npm run ui-check` after block 3 passed 315.

**Deviations:**

- **The prompt goes right after the identity, not just before `--settings`.** `--add-dir` and
  `--mcp-config` take every word up to the next option. Measured on 2.1.322: a prompt after
  `--add-dir` reached the session as one more folder, and the session started with no prompt. Only
  the new words moved: `buildCommand`'s old lines and their tests are unchanged.
- **The server runs with `env: {"ELECTRON_RUN_AS_NODE": "1"}`** in the MCP config, not as a shell
  command. The config is not run through a shell. Measured: with an `env` key the server still
  inherits the pty's environment (`MENKAR_PANE`, `PATH`).
- **Waking waits for quiet:** per parent, the delay restarts with each event, and a child keeps
  only its latest event.
- **A server call that runs out of time takes its request back**, so main never acts after the
  agent was told it failed.
- **The renew's fallback** checks the shown state once `RENEW_FALLBACK_MS` has passed, then every
  few seconds until it is idle or done.
- **The `/clear` follow was moved, not copied.** `followPaneStart`'s clear branch became
  `followClear`, which a renew calls too. The 1.56 and 1.57 e2e cases pass unchanged.
- **`start_session` makes the new session a member at once**, with its parent and group, without
  waiting for the transcript as New does. So `list_sessions` and the wake see it from its first
  turn.
- **The Stop hook's folder is written down twice.** The statusline runs under plain Node in its
  tests and cannot import the control module; a parity test holds the two equal.
- **Six e2e regexes that pin the Claude command line** (`window.spec.ts`, `remote.spec.ts`) gained
  `--mcp-config {…}`. No `expect(` line was removed.

**What the plan did not anticipate:**

- **A claude started from inside a Claude Code session writes no registry entry.** It inherits
  `CLAUDE_CODE_CHILD_SESSION` and the rest of that session's variables, and then writes no
  `~/.claude/sessions/<pid>.json`, so Menkar cannot wake it ("no session" in the log). A Menkar
  started from the desktop does not carry these variables. One started from a terminal inside
  Claude Code would pass them to every pane. Not handled here; it is a decision whether Menkar
  strips `CLAUDE*` variables from its panes' environment.
- **The renewed session's row is missing for a few seconds**, until Claude writes its transcript.
  A followed `/clear` already has the same gap.

**Block 4, the real check:** Menkar under `xvfb-run`, the real `claude` 2.1.322, a throwaway HOME
(manual mode), `XDG_RUNTIME_DIR` a private folder of the test, and a stand-in API. The `CLAUDE*`
variables of the session running the check were removed first. Seen:

1. The parent called `start_session`. A `child` tab opened after it, not selected, and the child's
   Bash command stopped at its permission card (no command ran).
2. The idle parent was woken with "[Menkar] child is waiting at a permission prompt", once
   `WAKE_DELAY_MS` had passed.
3. The parent called `renew`. The fresh session's first request carried "FRESH-START hello" as its
   first prompt.
4. `projects.json` held the fresh id with the old one as its earlier conversation, and the child's
   parent re-keyed to the fresh id. The fresh session's row appeared once its transcript existed.

Every process was stopped and nothing was left running. The human's `~/.claude` and sockets were
never touched.
