# Four agents compared: Claude Code, Codex, Cursor, OpenCode

Date: 2026-11-14. Edited by `codex` for `set`, from `plans/ideas/research/codex.md`, `cursor.md`
and `opencode.md`, plus Claude Code's column. Each column was reviewed by its agent's consultant.
It is research for the multi-agent design (decisions 1.127, 1.129, 1.133). Nothing here is
decided.

**The criterion (1.134):**
- A project with one agent is the norm. Mixed projects are supported, but are not the common
  case.
- Menkar unifies a mechanism **only where no single agent's experience or cost gets worse than its
  native way**. A Claude-only user loses nothing in speed, tokens or behaviour.

**How to read the cells:**
- Each cell names the native way. Its source is the per-agent file's section (`codex §2`,
  `cursor M4` = cursor.md's "Measured" item 4, `oc M13` = opencode.md's), or, for Claude Code,
  `docs/session-control.md` (`sc`), `docs/context.md` (`ctx`) and `claude-cli`'s column (`cc`).
- **m** = measured, **r** = read, **i** = inferred.
- Versions: Claude Code 2.1.322 (measured) and 2.1.325 (read), codex-cli 0.169.0, cursor-agent 2026.11.13-eacade1,
  opencode 2.3.0.

## 1. The matrix

### 1.1 Sessions

| Mechanism | Claude Code | Codex | Cursor | OpenCode |
|---|---|---|---|---|
| **Start with a first prompt** | positional prompt, via `"$(cat …)"` before `--add-dir`/`--mcp-config`, which swallow later words (m, cc 1) | positional `[PROMPT]` (m, codex M1) | positional prompt (m, cursor setup and M2); typed text stays in the box (m, cursor M9) | `--prompt` on the TUI, submitted when ready (m, oc M12); the TUI has no `--model`/`--agent`/`--title` |
| **Choosing the id** | `--session-id <uuid>` (m, in use) | none: the id is learned afterwards from `notify`'s `thread-id`, keeping the one whose rollout exists; the first `notify` can be the ephemeral title thread's (m, codex M13) | `create-chat` prints an id; `--resume <id> "<prompt>"` starts it (m, cursor M2) | `POST /api/session {id}` before the TUI (m, oc M6) |
| **Resume with a first prompt** | `-r <id|name> "<prompt>"` (r, cc 1); fork is `--resume <src> --fork-session --session-id <new>` (in use) | `codex resume <id> "<prompt>"` keeps the history (m, codex M8) | `--resume <id> "<prompt>"` keeps the history (m, cursor M3) | `-s <id> --prompt "<text>"` (r, oc §1.1; m on a session created through the API, oc M12) |
| **Model per session** | `--model` (m, sc) | `-m` (m, codex §1.1) | `--model`; the plan may refuse it (m, cursor setup) | no TUI flag; `session.create {model}` (m, oc §1.1) |
| **A name at start** | `-n <name>`; `/rename`; a SessionStart or UserPromptSubmit hook's `sessionTitle` (r, cc 2) | **none at start**; `/rename`, or `thread/name/set` from a separate `codex app-server` (m: writes `session_index.jsonl` and `threads.name`; **an open TUI does not see it**); sometimes a generated name (m, codex M9, M15) | **none**; a generated `title` in `meta.json`, named once from the first message; `/rename <name>`, typed in the TUI, writes `meta.json` `title` and `store.db`'s `name`; a positional `"/rename X"` is not a command and goes to the model; no flag (m, cursor M19) | `session.create {title}` (m, oc M6); a titled session gets no generated title (m, oc M12); `/rename`, `PATCH` (m), the agent's own `session_rename` tool (r) |
| **Folder trust prompt** | yes, on the first interactive start in a folder; `-p` skips it; no extra prompt for `--mcp-config`/`--plugin-dir` in a trusted folder (r/m, cc 12) | yes; `-c` cannot skip it; accepting writes `config.toml` (m, codex M4) | yes; accepting writes `.workspace-trusted`; `--trust` unmeasured in the TUI (m, cursor M1) | none (m, oc §1.1) |

### 1.2 Transcripts and Usage

| Mechanism | Claude Code | Codex | Cursor | OpenCode |
|---|---|---|---|---|
| **Where** | `~/.claude/projects/<cwd>/<id>.jsonl`; **deleted after `cleanupPeriodDays`** (default 30) (r, cc 3) | `~/.codex/sessions/Y/M/D/rollout-*.jsonl`; `.zst` after 7 days; index `state_5.sqlite` (m, codex §1.2) | `~/.cursor/projects/<slug>/agent-transcripts/<id>/<id>.jsonl`; **rewritten**, not append-only (m, cursor §1.2) | SQLite `opencode.db` (`session_v2`, `session_message`), WAL; read-only works while written (m, oc §1.2); parts inline in `session_message.data.content`, `session_part` empty (m, oc M20) |
| **Turn boundaries** | user message to the next (in use, `src/core/usage/`) | `task_started` / `task_complete` (m, codex M10) | `turn_ended` in the transcript; `beforeSubmitPrompt` / `stop` hooks for times (m, cursor §1.2), the hooks only with a same-event entry in the user's or the project's `hooks.json` (m, cursor M12) | `idle` message per execution; **one idle can close several user messages** (m, oc M16) |
| **Time per turn** | transcript timestamps (in use) | `task_complete.started_at/completed_at/duration_ms` (m, codex M10) | **not in the transcript** (only a minute-precision `<timestamp>` inside each user text); from when the `beforeSubmitPrompt` and `stop` hooks run (m, cursor §1.2), which needs that same entry (m, cursor M12) | per model step: `assistant.time{created, firstToken, streamed, completed}` (m, oc M20); a turn sums its steps (i) |
| **Tokens per turn** | transcript `usage` (in use) | `token_count.info.last_token_usage` (m) | **only from hooks** (`stop`, `afterAgentResponse`: input, output, cache read, cache write), and **only if the user's `~/.cursor/hooks.json` or the project's `.cursor/hooks.json` has the same event**; otherwise no tokens at all. `model` is `default` under `auto`, so a turn's model is unknown (m, cursor M6, M12) | per step, `assistant.tokens` (m); summed per turn (i) |
| **Cost** | exact, from the statusline's `cost.total_cost_usd`, appended to `usage.jsonl` (ctx; cc 3) | none in data; Menkar's price table (i) | none (i) | **`cost` in USD in the data** (m, oc M20) |
| **Last reply** | transcript tail (`last_reply`, sc) | `task_complete.last_agent_message` (m) | last assistant text before `turn_ended`, or `afterAgentResponse.text` (m) | the last `assistant` text before `idle` (m for the rows, oc M20; i for walking back past tool-call steps) |

### 1.3 State, wake and messages

| Mechanism | Claude Code | Codex | Cursor | OpenCode |
|---|---|---|---|---|
| **Running state without the screen** | Stop hook ~50 ms after the turn (m); registry `status` idle/busy/waiting + `waitingFor` (m; a monitor makes it read busy); Notification hook `permission_prompt` after ~6 s (r) (cc 4) | `-c notify` at turn end, ~1 s; no start signal (m, codex M7) | plugin hooks `beforeSubmitPrompt`/`stop`, no trust, but **only if Cursor's own `hooks.json` (user or project) has the same event**; per run alone, only `sessionStart` (new chats only), `sessionEnd` and `beforeMCPExecution` (m, cursor M12); `stop` comes in the same ms as `afterAgentResponse` (m, cursor M5) | server events `session.execution.*`, `permission.asked` (m, oc M21); also `session_v2.time_busy > time_idle` (m, oc M17); no hook, trust or write |
| **Screen strings** | in use (`detect.ts`); the footer's pills read from the binary, not yet a real screen (cc 4) | "• Working (5s • esc to interrupt)", "• Starting MCP servers (…esc to interrupt)"; "Would you like to run the following command?" … "Press enter to confirm or esc to cancel"; idle "› Ask Codex to do anything" + "Worked for Ns"; **the composer stays visible while working**; trust "Trust this folder?" (m, codex M16) | "Thinking N tokens"; "Run this command?"; "→ Add a follow-up" (m, cursor M8); the trust prompt "Workspace Trust Required … [a] Trust this workspace" (m, cursor M1) | "⬝⬝⬝⬝⬝⬝⬝⬝ esc interrupt"; "△ Permission required" (m, oc M14, M17); "Ask anything…" (r); the tab's spinner also turns while a message only waits in the inbox (m, oc M8) |
| **Waking an idle session** | post to the messaging socket: **~50 ms** (m); socket and auth documented, frame not (`peerProtocol 1`); `crossSessionInbound:"accept"` in `--settings` (cc 5) | **`codex queue`**: ~5 s embedded, ~8 s through the daemon; ≤10 s polling (m, codex M1, M12) | **no channel**: end and `--resume <id> "<event>"`, a restart of a few seconds plus re-indexing (m, not timed); headless `-p --resume` is lost (m, cursor §2). A working session: `stop`'s `followup_message` starts a new turn ~2.4 s after `stop` (m, cursor M13), only with a `stop` entry in the user's or project's `hooks.json`; a `stop` hook that waits leaves the session idle and typable, and its late answer was delivered twice (m, cursor M14) | **`POST …/prompt {delivery:"queue"}`** on Menkar's server: ~50 ms (m, oc M13) |
| **Behind a pending permission** | held, card untouched, delivered when it closes (m; only Esc was tested); never approves (r) (cc 5) | held 25 s, ran right after approval (m, codex M2) | `followup_message` is returned at the turn's `stop`, after the card closes (i); end-and-resume must wait for idle, because ending at a card drops it (i) | held 25 s, ran 1.6 s after approval (m, oc M14) |
| **A half-typed draft** | kept (i): the message goes through the command queue, not the input box (binary, wake-orchestrator §1.2); not measured with a draft | kept (m, codex M3) | lost on end-and-resume (i); kept by `followup_message` (i) | kept (m, oc M15) |
| **Marked as not from the user** | yes, two shapes: `SendMessage` arrives as `<cross-session-message from=… from-name=…>` (observed, 2.1.325); a Menkar socket post as "Another Claude session sent a message: …" plus the not-your-user note, with no tag and no sender name (m, wake-probes §1) | no: a user message (m) | no: both the resume prompt and `followup_message` show, and are stored, as an ordinary user message (`<user_query>`) (m, cursor M3, M13) | no: a user message; a `synthetic` post exists, unprobed (r) |
| **Messaging another session by name** | `SendMessage`, native, on the same socket (not timed; ~50 ms is a Menkar post's figure); drained at the receiver's next tool round, or a new turn if idle (r); by name, `notify_when_idle`, verified sender, reply-by-`from`, delivery feedback, other machines through Remote Control; **reaches only Claude Code sessions** (r, cc 6) | none (r) | none (r) | none; its native child sessions (`session.create {parentID}`) report to the parent's inbox, but they are hidden subagent sessions, not tabs (r/i, oc §2) |

### 1.4 Menkar's MCP, skills, instructions

| Mechanism | Claude Code | Codex | Cursor | OpenCode |
|---|---|---|---|---|
| **How passed per session** | `--mcp-config` inline, added to the user's servers (m); tools are deferred, so one ToolSearch step (m); ~0.06 s start, ~17 MB RSS per session (m, cc 7) | `-c mcp_servers.menkar.*`, which makes the TUI run embedded (m, codex M5–6); **tools deferred**: an 18-tool server added 7 input tokens per request, only its name (m, codex M14) | `--plugin-dir` with `.mcp.json` (m, cursor M4); a folder per pane is a proposal (i); Cursor started the server twice per session (m), and whether both stay alive is unknown; per-pane folders must share one basename (e.g. `…/<pane>/menkar`) so that one allowlist entry covers every pane (m, cursor M16); tools are deferred: the model reaches them through `GetDynamicTools`, then `CallDynamicTool`, one extra step at first use (m, cursor M18) | `OPENCODE_CONFIG_CONTENT` on **Menkar's own `opencode serve`**, one extra long-lived process per Menkar (m, oc M10); TUIs start with `--server <url>` and `OPENCODE_PASSWORD` (m, oc M8) |
| **Does the pty's env reach the server** | **yes** (`MENKAR_PANE`) (m, sc) | **no**; `env={…}` in the config does (m, codex M6) | **no**; `.mcp.json` `env` does (m, cursor M4) | **no**; the server's whole env does, including its password (m, oc M10); the pty's env does reach the session's shell commands (r, oc §1.6) |
| **Caller identity** | `MENKAR_PANE` | `MENKAR_PANE` in `env` | `MENKAR_PANE` in a per-pane `.mcp.json` | `_meta["ai.opencode/sessionID"]` on each call (m, oc M18, M27); a session made by `/new` calls with an id nothing ties to its pane, so Menkar binds it with a per-pane proxy (m, oc M29) |
| **Approval card for Menkar's tools** | none with `permissions.allow` in `--settings` (m, ctx) | none with `default_tools_approval_mode="approve"` (m, codex M6) | **a card at every call**; nothing per run narrower than `--force` (m; `--approve-mcps` does **not** remove it and writes no approval, cursor M17); "Allowlist MCP Tool" writes `Mcp(<server>:<tool>)` into `permissions.allow` of the user's `~/.cursor/cli-config.json`; the server is named `plugin-<folder basename>-<.mcp.json key>`, not after the manifest's `name` (m, cursor M15–M16) | none with `permission {"menkar_*":"allow"}` (m, oc M18); needs `codemode:false` to see the tools at all, and then **every request grows by the 18 tools' definitions: +9,782 bytes, ~2.4–2.8k tokens** at 3.5–4 bytes per token (m, oc M32–M33; tokens estimated, no tokenizer); Code Mode instead adds ~3.7 KB (~1k tokens) to the system prompt, but the tools are callable only as JavaScript inside `execute`; OpenCode re-lists on `notifications/tools/list_changed` within 11 ms, and the next model request has the new list (m, oc M34); without the `allow` rule unprobed |
| **Skills per session** | `--plugin-dir` as `menkar:<name>` (m); descriptions ~1,670 characters (m), ~420 tokens per turn (i), cached; bodies 5–13 KB, ~1.2–3.3k tokens (i), once, re-attached after compaction (r, cc 8) | **none**: no flag or `-c` adds a skills folder (r, codex §4) | `--plugin-dir`; may take Menkar's plugin as it is (m for `skills/`; r that `.claude-plugin/plugin.json` is accepted; i that Menkar's plugin loads as it is) | config key `skills` (m with v1's `{paths:[dir]}`, oc M19; the `[dir]` form r) |
| **Project instructions** | `CLAUDE.md`, `.claude/CLAUDE.md`, `CLAUDE.local.md` (cwd and above; subfolders on demand), `@`-imports (4 hops), `.claude/rules`; **`AGENTS.md` only when no `CLAUDE.md`, `.claude/CLAUDE.md` or `CLAUDE.local.md` exists in the cwd or above** (2.1.277+); `.claude/rules` loads either way; `@AGENTS.md` in `CLAUDE.md` loads it once (r, cc 9) | `AGENTS.md` root→cwd, 32 KiB; `project_doc_fallback_filenames` can name `CLAUDE.md` (r, codex §5) | `AGENTS.md`, `CLAUDE.md` (behind a "third-party" setting, on by default) and `.cursor/rules/*.mdc`; measured in the cwd, read up to `/`; 100 KB each (r); no `.claude/rules` | **`AGENTS.md` only**, no size limit; `instructions: [file]` per run, the file's size in every request (m, oc §5) |
| **Status line / context** | Menkar's own statusline in `--settings`, chaining the user's; stdin has context, cost and rate limits (r/m, cc 10) | built-in only; context from `token_count` (r) | footer `Auto · 4.4%`; a command status line only in the user's `cli-config.json` (footer m; status line r, cursor §1.4) | no external status line (r); TUI footer "1.0K (1%)" (m, oc M12); `GET /api/session/<id>/context` (route m, fields unprobed); TUI plugins only (r) |
| **Remote mode** | **Remote Control**, per session (`--remote-control[=name]`); needs claude.ai auth (r, cc 11) | daemon-wide, experimental; not for embedded sessions (r, codex §1.5) | none for a local session (r) | server-wide `opencode pair` (r) |
| **Writes to the user's config** | none by Menkar except what the human accepts in the integrations menu (statusline, `cleanupPeriodDays`) (ctx); Claude itself writes `pluginUsage`/`skillUsage` in `~/.claude.json` (m, sc) | none by Menkar; trust by the human (m); each `codex queue` wake writes one `queue_1.sqlite` row, deleted on delivery (m, codex M17) | none by Menkar; trust by the human; allowlisting from the card writes `~/.cursor/cli-config.json` (m); Menkar's turn hooks would need an entry in `~/.cursor/hooks.json` (m, cursor M12; D13) | none to config by Menkar (m); but Menkar's API calls make OpenCode write `opencode.db`: the session row with its id and title, and each wake's inbox row, of the same nature as `codex queue`'s SQLite queue (m, oc M6, M7) |

## 2. Per mechanism: unify through Menkar, or keep native

The layers named below:
- **adapter**: a per-agent module in `src/core/` behind one interface (`AGENT_COMMANDS` grown into
  an agent entry);
- **server**: Menkar's MCP server, one program, reached by each agent its own way;
- **tool**: a new MCP tool.

| Mechanism | Recommendation | Reason against 1.134 | Claude-only user |
|---|---|---|---|
| Start, resume, first prompt, model | **Keep native**, behind an adapter (`buildCommand` per agent) | Each agent has a native first prompt; one interface, four command lines | Unchanged |
| Choosing the id | **Keep native**; Codex binds the id from `notify` (rollout must exist) | Three agents let Menkar choose; Codex cannot, and needs no workaround | Unchanged |
| Naming | **Keep native**: Menkar shows the agent's own name or title, and sets one at start only where the agent's start does (`-n`, `session.create {title}`) | The rule "the name is the one the agent has" holds per agent; see decision D5 for Codex and Cursor | Unchanged |
| Transcripts and Usage | **Unify the model, keep the readers native**: one reader per agent in `src/core/`, all feeding `src/core/usage/` | Each format is different, and Usage must stay one definition (CLAUDE.md); D9 picks OpenCode's "turn" | Unchanged: the Claude reader stays as it is |
| Running state | **Keep native** per agent: the screen plus the agent's own signal | No signal is common; each is free or near free. Cursor's is free only with the consented `hooks.json` entry (D13) | Unchanged |
| Waking (Menkar → session) | **Unify the interface `wake(session, text)` (it exists, 1.72); keep each transport native**: socket, `codex queue`, inbox post, end-and-resume | Each agent's channel is its fastest; nothing common is as fast as Claude's socket | Unchanged |
| A session messaging another by name | **Bridge, do not replace** (1.129): Claude keeps `SendMessage`; Menkar adds a `send_message` tool, routed through `wake`, for the sessions that need it (D3) | `SendMessage` is ~50 ms with a verified sender, `notify_when_idle` and delivery feedback; a Menkar route adds a file hop (fs.watch plus a ≤1 s poll; 10 s is the timeout) plus the 3 s wake batch if it rides the batcher and loses all of that (cc 13) | Nothing, if the tool is not listed in Claude-only projects (D3) |
| Menkar's MCP server | **Unify the server; keep the transport native** per agent (`--mcp-config`, `-c`, `--plugin-dir`, `OPENCODE_CONFIG_CONTENT`) | One program and one set of tools; how it is mounted cannot be common | Unchanged |
| Caller identity | **Server accepts two ways**: `MENKAR_PANE` (Claude, Codex, Cursor), or OpenCode's `_meta` session id mapped to a pane through a per-pane proxy (D14) | Only OpenCode's MCP server is one process per folder on one server, shared by its sessions, with the server's env (m, oc M10). So Menkar's `opencode serve` must carry **no** `MENKAR_PANE`, or every OpenCode call would pass as that pane (i). A session Menkar did not create (the human's `/new`, or a click on another tab of OpenCode's shared tab list) has an id Menkar never mapped, and **the event stream cannot bind it**: `session.created`/`session.viewed` name no client, and the TUI's environment is kept only in the server's memory (m, oc M26–M28). **A per-pane proxy binds it exactly**: each OpenCode pane gets its own loopback port forwarding to the one server, and the pane's `POST /api/session/<id>/view` and `…/prompt` name its current session (m, oc M29), with no extra process. A server per pane also works (`MENKAR_PANE` in its env), at ~270 MB per tab (m, oc M30) | Unchanged |
| Approval for Menkar's tools | **Keep native** per agent; Cursor is D7 | Three agents allow it per run. For Cursor, a per-pane folder must keep **one folder basename** for every pane, because Cursor names the server `plugin-<folder name>-<server>` (m); otherwise an allowlisted tool would match only one pane (i) | Unchanged |
| Skills | **Keep native** where per-session exists (Claude and Cursor: `--plugin-dir`; OpenCode: `skills`); **serve through the MCP server only for Codex** (`load_skill`, or `developer_instructions`) | For Claude, an MCP `load_skill` would save ~420 cached tokens per turn, but costs a ToolSearch hop per load and loses the description trigger, `/menkar:<name>` and the re-attachment after compaction (cc 13) | Unchanged, *if* the skills' text stays as it is for Claude (D10) |
| Project instructions | **Keep native**; for this repository, D11 | Each agent reads its own file; per-session pointers (`project_doc_fallback_filenames`, `instructions`) exist for Codex and OpenCode | Unchanged |
| Status line and context | **Keep native**: Claude's statusline; Codex's `token_count`; Cursor's `stop` tokens (only with the D13 entry), which give a context percentage only with a per-model window, unknown under `auto`; OpenCode's API | Claude's reading is the richest (cost included), and the others cannot match it | Unchanged |
| Remote mode | **Keep native**; only Claude declares one (an agent-entry field) | Others are daemon- or server-wide, or absent | Unchanged |
| Trust prompts | **Keep native**: the human answers on the agent's own screen; Menkar never pre-writes the trust file (agent-deck does) | A write to the agent's data is the human's (CLAUDE.md); state detection must show these prompts as waiting (Cursor's matches no rule today, `cursor §1.3`) | Unchanged |
| Environment for children | **Unify the mechanism** (`withoutSessionEnv`), **extend the list** per agent (`codex §1.7`, `cursor §1.7`, `oc §1.7`) | A list costs nothing at run time | Unchanged |

**What a Claude-only user would gain:** nothing they need. The adapters are code that never runs
for them.

**What they could lose, and how it is avoided:**
- `send_message` listed in their sessions, costing listing tokens: hide it (D3).
- Skills rewritten into agent-neutral text that is weaker for Claude: keep Claude's text (D10).
- `wake` or messaging moved off the socket: not proposed.

## 3. Mixed projects

**What works across agents** (every agent's file §3):
- Starting any agent from `start_session`.
- Menkar's tools in every session.
- Waking a parent of any agent: Claude by the socket, Codex by `codex queue`, OpenCode by the
  inbox, Cursor by `followup_message` if it is mid-turn (measured, needs D13), else
  end-and-resume.
- Reading any child's report with `last_reply`, through its agent's reader.

**What breaks or needs a bridge:**
- **`SendMessage` reaches only Claude Code sessions.** A Codex, Cursor or OpenCode session cannot
  be listed or messaged by it, and those agents have no counterpart. "Send the report by name"
  across agents needs `send_message`. A Claude sender to a Claude receiver keeps `SendMessage`.
- **Waking a Cursor parent costs a restart.** It also loses a half-typed draft and any background
  shells. A Cursor session is the weakest orchestrator, and would need the human, or an
  allowlist, at every Menkar tool call (D7). A Cursor worker also waits for the human at each
  Menkar tool call unless allowlisted, so it is a weak unattended worker too. agent-deck forbids OpenCode as a conductor, for its
  own reasons (`oc §3`).
- **OpenCode sessions need Menkar's own `opencode serve` running** (D9). Without it, Menkar can show OpenCode sessions read only, but not start, wake or serve them. OpenCode's tabs are shared by every TUI of the user, so a Menkar pane can switch into another pane's session or the human's (m, oc M31): Menkar binds per pane through its proxy (D14), not per tab.
- **The skills name Claude Code tools** (`SendMessage`, `--plugin-dir`); other agents need their
  own wording (D10).
- **Usage across agents** is comparable in time and tokens. Cost exists only for Claude (the
  statusline) and OpenCode (in the data). Codex needs a price table, or shows no cost. Cursor shows no cost: under `auto` its hooks report `model: default`, so no price table can apply.

**`start_session` and Menkar's CLI:**
- They take **`agent`**, whose **default is the caller's own agent**, as agent-deck does.
- `model` is passed in the agent's own way; `remote_control` is refused for an agent without one.
- `resume_session` takes the agent from the session's record.

**The cost of supporting mixed projects when unused:**
- No run-time cost: adapters run only for their agent, and `send_message` is not listed (D3).
- Code and tests per agent.
- One more field on `start_session`, whose default keeps one-agent projects as they are.

## 4. Decisions for the human (merged, each with one recommendation)

**D1. Waking an agent without Claude's socket (2.21), per agent.**
- Options: native channels (Codex `codex queue`, OpenCode the inbox post); typing into the
  terminal; end-and-resume.
- **Recommended: the native channels.** For Cursor: `stop`'s `followup_message` for a working
  session, end-and-resume for an idle one. `followup_message` is measured to work, but needs D13; without it, every Cursor wake is
  end-and-resume. Measured in Cursor: text plus Enter, sent while an approval card was open,
  **approved the tool call** (cursor M20). Typing stays plan B for Cursor only, if the restart
  cost proves too high.
- Nothing is typed for Codex or OpenCode, and both are measured to keep drafts and approvals.

**D2. Messaging by name: replace or bridge (1.129).**
- Options: one `send_message` path for every agent; or Claude keeps `SendMessage` and the tool
  serves the others.
- **Recommended: bridge.** Replacing costs Claude `notify_when_idle`, reach to Claude sessions Menkar did not start, speed, a tool round trip and the native
  sender marking.

**D3. When `send_message` (and `load_skill`) are listed.**
- Options: always; only in sessions of a non-Claude agent; only in projects that have more than
  one agent.
- **Recommended: listed only when the project has a non-Claude agent.** The reason is behaviour, not tokens: an MCP tool is deferred, so listing it costs only its name per turn (m, cc). But if it is listed, Claude may pick it over the native `SendMessage` and get the slower, unattributed path (i). The server already shapes `tools/list` per caller.
- **What listing a tool costs, per agent:**
  - Claude: only its name (deferred tools).
  - Codex: only the server's name, +7 tokens for all 18 tools (m, codex M14).
  - Cursor: deferred; +23 input tokens for 1 tool, **+125 for 18 tools** carrying 14,874 bytes
    of schemas (≈6–7 tokens per tool), against a repeated baseline of 10,015 (m, cursor M18).
  - OpenCode with `codemode:false`: **the whole definition in every request**, ~2.4–2.8k tokens for
    Menkar's 18 tools (m, oc M32–M33).
  - So shaping `tools/list` per caller saves real tokens for OpenCode. Its `list_changed` support
    lets the server change the list mid-session (m, oc M34).

**D4. `start_session`'s `agent` default.**
- Options: the caller's agent; the project's most-used agent; always Claude.
- **Recommended: the caller's agent.**

**D5. Naming the agents with no start-time name (Codex, Cursor).**
- Options: show the agent's generated title until the human renames it; Menkar calls the agent's
  own rename API at start (Codex `thread/name/set`), which is a write into the agent's data by
  Menkar; a name of Menkar's own (against the rule).
- **Recommended: the generated title until the human renames.** No write by Menkar.
- Measured for Codex (codex M15): `thread/name/set` from a separate app-server works right after the
  first turn. It writes `session_index.jsonl` and `threads.name`, but **the open TUI keeps
  showing its old name**. So naming a Codex session from Menkar is possible, but the human would
  see two names until the TUI restarts. That is one more reason for the recommendation.
- Cursor: there is no outside way to set the title, only the human's typed `/rename`, which writes
  `meta.json`. A positional `/rename` is sent to the model, not run (m, cursor M19).
- OpenCode's `session.create {title}` names the session in the call that creates it, as
  `claude -n` does at start. Codex's `thread/name/set` is a second call, on a session that
  already exists.
  - Both are Menkar's calls into the agent's own API that make the agent write its data; the only
    difference is creation versus rename.
  - Recommended: use OpenCode's, since the create call is needed anyway to choose the id. The
    human should see that the line is drawn there.
- `start_session`'s `<project>-tN` name then holds for Claude and OpenCode only. For Codex and
  Cursor, Menkar keys the task by the session id. Cursor's id is known before start
  (`create-chat`), so only Codex needs a design point.

**D6. Codex's turn-end signal.**
- Options: `-c notify` per session, which replaces the user's own `notify` while it runs; a
  `Stop` hook by `-c`, which needs `/hooks` trust once (a write by the human) or
  `--dangerously-bypass-hook-trust`; the screen only.
- **Recommended: `-c notify`**, stated in the integrations page, with the screen as the fallback.

**D7. Cursor's approval card at every Menkar tool call.**
- Options: accept it; the human allowlists from the card once (Cursor writes `~/.cursor/cli-config.json` `permissions.allow`; one entry covers every pane if Menkar's per-pane folders share a basename); the
  project's `.cursor/cli.json`; `--force`.
- **Recommended: accept it, and let the human allowlist once from the card.** `--force` approves
  everything.
- Cost of "accept it": every Cursor worker blocks at its first Menkar tool call until the human
  answers.

**D8. Cursor's status line.**
- Options: none (Menkar reads tokens from the `stop` hook); an integrations-menu entry writing
  `cli-config.json`; a `CURSOR_CONFIG_DIR` of Menkar's.
- **Recommended: none.** Then Cursor's context percentage shows only in Cursor's own footer, not
  in Menkar.

**D9. OpenCode needs Menkar's own `opencode serve`.**
- Options: Menkar runs one (loopback, its own password, stopped with Menkar); use the user's
  shared service, where per-run config cannot reach a session (only `PUT /api/experimental/mcp/<server>` could add Menkar's MCP there: per folder, for every session of the user in that folder, until the service restarts, a change to the user's running agent; r, oc §4); no OpenCode in the orchestration mode.
- **Recommended: Menkar's own server.** Cost: one long-lived `opencode serve` per Menkar, about 270 MB resident after a few turns (m, oc M30), started with the first OpenCode tab.
- **One session in two servers runs two turns at once** (m, oc M22–M25):
  - Menkar's server and the human's service share `opencode.db` without error.
  - A queued post to one server does not wait for a turn running on the other.
  - Each TUI shows only its own server's activity.
  - The history interleaves by write order, so a reply can land after a later exchange.
  - `integrity_check` stays `ok`, and `time_busy` is last-writer-wins.
  - OpenCode's tab list is shared by every TUI of the user
    (`$XDG_STATE_HOME/opencode/latest/tui/tabs.json`, m, oc M31). The human's own TUI lists
    Menkar's sessions, and one click opens a running one.
  - Options: accept it as the human's choice, as for a Claude session resumed twice; warn when the
    database shows the session busy (`time_busy > time_idle`) with no Menkar turn; refuse to
    start or wake it then.
  - **Recommended: warn**, without refusing. Whether the busy check is reliable across servers is
    unprobed.
- Also decided with it: OpenCode's "turn" for Usage. **Recommended: one per user message**, as
  for Claude, so that counts compare. A steered or queued message that arrives during an
  execution starts a new turn at its own `user` row. The execution's `idle` outcome
  (`failed`/`interrupted`) belongs to its last turn only (m for the rows, oc M16, M20; i for the
  rule).

**D10. The skills' text across agents.**
- Options: one agent-neutral text for all; Claude's text unchanged plus a short per-agent note
  served to the others; a variant per agent.
- **Recommended: Claude's text unchanged, plus per-agent notes** for the tools Claude has and
  the others lack.

**D11. This repository's `CLAUDE.md` and `AGENTS.md`.**
- Claude Code reads `AGENTS.md` only when no `CLAUDE.md` exists, and a `CLAUDE.md` holding
  `@AGENTS.md` loads it once (cc 9). Codex and OpenCode read only `AGENTS.md`, and Cursor reads
  both.
- Options: move the text to `AGENTS.md`, with `CLAUDE.md` as `@AGENTS.md`; keep `CLAUDE.md` and give
  Menkar's own Codex and OpenCode sessions a per-session pointer (Codex
  `project_doc_fallback_filenames`, OpenCode `instructions`); duplicate the text.
- **Recommended: move it to `AGENTS.md` with `CLAUDE.md` = `@AGENTS.md`.** Claude reads the same
  text at the same token cost (r, unmeasured; the import is expanded in place under every `instructionFiles` value), and the other three read it natively. After the move, `/memory` in a fresh session should list `AGENTS.md` once, through `CLAUDE.md`. `.claude/rules/` keeps
  loading for Claude only, so Codex and OpenCode miss `ts-tests.md`.
- **For users' projects:** Menkar adds no pointer by default. A per-session pointer is a later
  option, if a user with only `CLAUDE.md` asks for it.

**D12. Codex's and Cursor's environment tuning**, handed on by a Menkar started from their shell
tool. Codex: `NO_COLOR`, `TERM=dumb`, `PAGER=cat`. Cursor: `NO_COLOR=1`, `TERM=dumb`,
`GIT_EDITOR=true`, `GIT_CONFIG_COUNT/KEY_0/VALUE_0` = `core.quotePath false`, and no `PAGER`
(measured).
- Options: strip them; keep them.
- **Recommended: keep the display ones** (they look like the user's own), and strip the identity
  variables.
- Cursor's injected `GIT_CONFIG_*` and `GIT_EDITOR=true` are plainly Cursor's, not the user's:
  weigh stripping them with the identity set. An inherited `CURSOR_ASKPASS_SOCKET` would point a
  child's git credential prompts at the parent's socket.

**D13. Cursor's turn hooks need an entry in the user's `~/.cursor/hooks.json`.**
- A per-run plugin's `stop`, `beforeSubmitPrompt` and `afterAgentResponse` do not run without a
  same-event entry in the user's or the project's `hooks.json` (m, cursor M12).
- Options:
  - an integrations-menu item adding Menkar's hook to `~/.cursor/hooks.json`: consented,
    removable, and telling panes apart by `MENKAR_PANE`, which the hooks see;
  - the project's `.cursor/hooks.json`, which is the user's repository;
  - none, leaving Cursor with the screen and the transcript only: no turn-end signal, no tokens
    for Usage, no `followup_message`.
- **Recommended: the integrations-menu item.** Without it, Cursor's Usage has no tokens and its
  wake is always a restart.

**D14. Binding an OpenCode pane's caller after `/new`.**
- Options: a per-pane proxy in Menkar's main process (exact, no extra process; m, oc M29); a server
  per pane (~270 MB each; m, oc M30); refuse calls from unmapped ids with Menkar's own sentence.
- **Recommended: the per-pane proxy.** Menkar's list then follows the pane to its new session, as
  it does after a `/clear` for Claude.

## 5. Still unknown

| Unknown | Blocks |
|---|---|
| ~~Cursor: why one of two successful runs fired no `stop` / `beforeSubmitPrompt`~~ **Resolved**: plugin turn hooks need a same-event entry in Cursor's own `hooks.json` (cursor M12; D13) | — |
| Cursor: why `sessionEnd` fires in some runs and not others; whether a project `.claude/settings.json` hook counts | build |
| Cursor: a hidden `cursor-agent acp` (an Agent Client Protocol stdio server; read, not run) could carry a future Cursor chat tab, like `codex app-server`; it is not a channel into a TUI | nothing |
| ~~Cursor: whether `followup_message` starts a turn in the TUI~~ **Resolved**: yes, ~2.4 s after `stop`, with D13 (cursor M13) | — |
| Cursor: the default `loop_limit`, and the cause of the double delivery after a waiting `stop` hook (cursor M14) | build |
| Cursor: `${env:…}` in a plugin's `.mcp.json` (cursor 3); `--approve-mcps` resolved: no effect on the card (M17) | build (a folder per pane works anyway) |
| Cursor: `--trust` in the TUI (cursor 4) | build |
| ~~Cursor: where "Allowlist MCP Tool" writes, and whether the server's name follows the folder name~~ **Resolved** (cursor M15–M16) | — |
| Cursor: whether the twice-started MCP server is two live processes per session | build |
| ~~Cursor: whether `/rename-chat` writes `meta.json`'s `title`~~ **Resolved**: `/rename` writes it; nothing outside the TUI can (cursor M19) | — |
| ~~OpenCode: one session held by two servers at once (oc 1)~~ **Resolved** (oc M22–M25; D9) | — |
| OpenCode: whether `time_busy > time_idle`, read across servers, is reliable enough to warn or refuse | build (D9's warning) |
| OpenCode: a TUI of another version against Menkar's server (oc 2) | build |
| ~~OpenCode: a session Menkar did not create inside its tab (`/new`), and the caller's identity~~ **Resolved** (oc M26–M29; D14) | — |
| OpenCode: MCP approval without an `allow` rule; a `synthetic` post against a user one (oc 3) | build |
| Codex: what the MCP status-line provider receives (codex unknowns) | nothing (context comes from `token_count`) |
| A real model's behaviour with Menkar's skills and tools in each agent | build (tuning the texts) |
| Windows and macOS for every agent (OpenCode's port moves from 0xC0DE to 0x70DE on Windows, r) | build, per platform (an agent entry is enabled per platform) |
