# Research: Cursor's terminal agent (`cursor-agent`) in Menkar (decision 1.127)

Date: 2026-11-14. Written by `cursor` (the future Cursor consultant) for `set`. Research before any
plan: nothing here is decided. Its sections mirror `codex.md`, so the two compare point by point.

## Sources and how each fact is marked

- **Installed binary**: `cursor-agent 2026.11.13-eacade1`, `~/.local/bin/cursor-agent` and
  `~/.local/bin/agent`, both symlinks to
  `~/.local/share/cursor-agent/versions/2026.11.13-eacade1/cursor-agent`. That file is a bash
  wrapper that runs a bundled `node` on `index.js`.
- **Cursor's source is not public.** The bundle is minified JavaScript that can be read with `rg`
  (`index.js`, `1212.index.js`, `4107.index.js`, `7923.index.js`, `8080.index.js`). "read, bundle
  `<file>`" means a string or function found there. Minified names change with every release, so
  a fact read there is re-checked against a new version before a plan relies on it.
- **agent-deck** (github.com/asheshgoplani/agent-deck, MIT, shallow clone `9fa44b5`, 2026-11-14).
  Read as documentation, never copied.
- **Markers**: **read** means read in the bundle, docs or agent-deck, with the source. **measured**
  means run, with the command and version. **inferred** means not verified. Every *inferred* fact
  is a probe to run before a plan relies on it.

## 0. What changes the picture

1. **Cursor has no inbound channel into a running session.** There is no queue, inbox, socket or
   server mode a session can be sent a message through (read; §2). A headless turn into the open
   chat (`-p --resume <id>`) runs, but the TUI never sees it, and **the TUI's next turn rewrites
   the transcript without it** (measured, §2). For an idle Cursor session, 2.21 keeps only its
   first two answers: end and resume, or type.
2. **`--resume <chatId> "<prompt>"` works.** It resumes with the history and runs the prompt as
   the first turn (measured). `cursor-agent create-chat` prints a new chat id, so **Menkar can
   choose a session's id before starting it**, as `--session-id` does for Claude (measured).
3. **`--plugin-dir` exists and takes a Claude-style plugin.** It carries MCP servers, hooks and
   skills for one run, with no write into `~/.cursor` (measured). It even accepts
   `.claude-plugin/plugin.json` as the manifest (read). This is Cursor's counterpart of
   `--mcp-config` + `--settings` + `--plugin-dir` together.
4. **The `stop` hook gives the tokens of every turn**: `input_tokens, output_tokens,
   cache_read_tokens, cache_write_tokens` (measured). The transcript has **no tokens, no model and
   no timestamps** besides a minute-precision `<timestamp>` in each user message (measured). Usage
   for Cursor would come from the hook, not from the transcript.
5. **Hooks need no trust and see the pty's environment** (`MENKAR_PANE` included). **MCP servers do
   not see it**: like Codex, they get only `HOME, LOGNAME, PATH, SHELL, TERM, USER` plus the
   config's `env` (measured).
6. **But a plugin's turn hooks (`beforeSubmitPrompt`, `stop`, `afterAgentResponse`) fire only if
   the user's `~/.cursor/hooks.json` or the project's `.cursor/hooks.json` has a hook for the same
   event** (measured, item 12). Per run, with no file written, Menkar gets no turn-end signal,
   no tokens and no `followup_message`. Point 4's Usage and §2's wake need one consented entry in
   the user's `~/.cursor/hooks.json`.

## Measured on cursor-agent 2026.11.13-eacade1 (2026-11-14, a throwaway home, the human's login)

Setup:
- **Home:** `HOME` pointed at a throwaway folder in the scratchpad, holding a copy of the human's
  `~/.config/cursor/auth.json`. The whole home, the copy included, was deleted afterwards.
- **Session:** the TUI ran in a private tmux server (`tmux -L cprobe`), 140×45, in a scratch git
  repository. The repository held an `AGENTS.md`, a `CLAUDE.md`, `sub/AGENTS.md` and
  `.cursor/rules/probe.mdc` (`alwaysApply: true`), each with its own marker word.
- **Stubs:** a scratch plugin passed with `--plugin-dir`, holding
  `.cursor-plugin/plugin.json`, `.mcp.json` (a stdio MCP stub that logged its environment and
  calls), `hooks/hooks.json` (a script logging each event's stdin and environment), a skill and a
  rule.
- **Models:**
  - `gemini-3.8-flash-low` (the model first named for this research) is listed by
    `cursor-agent models` but refused: "Error: Model unavailable on Free. Free includes Grok 4.7,
    Grok 4.6, and Auto with fixed settings. Switch to an included model to continue."
  - `grok-4.7-low` (approved next by the human) was refused with the same error. On Free, "fixed
    settings" seems to rule out every effort variant.
  - The turns ran on **`--model auto`**, approved by the human. There were 6 short turns: 5 in the
    TUI and 1 headless.
  - A refused turn still writes the transcript line `{"type":"turn_ended","status":"error",
    "error":"Model unavailable on Free …"}`.
- **Untouched:** the human's `~/.cursor`, `~/.config/cursor` and their running `cursor-agent`
  (PID 808162). `~/.cursor/cli-config.json` kept its 10:28 mtime, which is before the first probe.
  Every probe process was checked in `/proc/<pid>/environ` for the throwaway `HOME` and stopped.
  None is left. The probe's socket folder `/tmp/.cursor/<slug>` and its three stale
  `/tmp/cursor-askpass-*.sock` were removed; the human's one (10:26) was left alone.

The start command was `HOME=<tmp> MENKAR_PANE=probe-pane cursor-agent --model auto --plugin-dir
<plugin> --resume <id from create-chat> "<prompt>"`, run in the repository.

1. **Workspace trust:** the first run in a folder shows "⚠ Workspace Trust Required … Do you trust
   the contents of this directory? … [a] Trust this workspace / [q] Quit". Accepting it wrote
   `~/.cursor/projects/<slug>/.workspace-trusted` (`{trustedAt, workspacePath}`) and `repo.json`.
   Later runs in that folder did not ask.
2. **`create-chat` + `--resume <id> "<prompt>"`:**
   - `cursor-agent create-chat` printed a UUID and wrote nothing to disk.
   - Starting with `--resume <that id> "<prompt>"` ran the prompt as the first turn of a chat with
     that id. Its transcript and `chats/` folder carry the id.
3. **Resuming with a prompt keeps the history.** After the TUI was ended, `--resume <id> "Without
   tools: what did probe_ping return earlier in this chat?"` answered `PING-GOLF pane=none`, a
   value from the earlier turn.
4. **The plugin's MCP server loaded with no server prompt**, under the name
   `plugin-plugin-probe`. Its environment was `FROM_CFG, HOME, LOGNAME,
   NODE_DISABLE_COMPILE_CACHE, PATH, SHELL, TERM, USER`: **`MENKAR_PANE` did not reach it**, and
   the `env` entry of `.mcp.json` did. Each call to its tool showed an approval card
   (item 8).
5. **Hooks from `--plugin-dir` and from the project's `.cursor/hooks.json` ran with no trust
   prompt.**
   - Fired: `sessionStart` (the first run only, not on `--resume`), `beforeSubmitPrompt`,
     `beforeMCPExecution`, `afterAgentResponse`, `stop` and `sessionEnd` (on Ctrl+D).
   - **One run fired only `beforeMCPExecution`.** Its three turns gave no `beforeSubmitPrompt`
     and no `stop`. After a restart every event fired, for the plugin's and the project's hooks
     alike. The cause is unknown (see "Still unknown").
6. **Hook payloads** (stdin, JSON):
   - Every event: `conversation_id`, `generation_id`, `model`, `session_id` (equal to the chat
     id), `hook_event_name`, `cursor_version`, `workspace_roots`, `user_email` and
     `transcript_path`. `transcript_path` is null at `sessionStart`.
   - `stop`: `status` (`completed`), `loop_count`, `input_tokens`, `output_tokens`,
     `cache_read_tokens` and `cache_write_tokens`. One turn: 11652 / 45 / 11520 / 0.
   - `afterAgentResponse`: `text`, which is **the turn's final reply**, and the same token fields.
   - `beforeMCPExecution`: `tool_name`, `tool_input`, `mcp_server_name` and `command`.
   - `model` was `default` under `auto`, and `gemini-3.8-flash-low` at a `sessionStart` with an
     explicit model.
7. **Hook environment:** the pty's whole environment, `MENKAR_PANE` included, plus what §1.7
   lists.
8. **Screens (agent-state):**
   - Working: "`⠠⠛ Thinking  45 tokens`".
   - Shell approval: "`Run this command?`", "`Not in allowlist: env, grep, sort`", "`→ Run (once)
     (y)`", "`Add Shell(env), … to allowlist? (tab)`", "`Run Everything (shift+tab)`" and "`Skip &
     tell the agent what to do instead (esc or n)`". The tool line above them read "`$ <command>
     Waiting for approval...`".
   - MCP approval: "`Run this MCP tool?`", "`→ Run (once) (y)`", "`Allowlist MCP Tool (tab)`",
     "`Reject & propose changes (p)`" and "`Skip (esc or n)`".
   - Idle: "`→ Add a follow-up`", then a footer with the model and the context used ("`Auto ·
     4.4%`"), then the cwd and git branch.
   - Error: "`Error: Model unavailable on Free`" and its explanation, in the conversation.
9. **Typing is fragile even in a probe.** Text sent with `tmux send-keys -l` and then Enter ran as
   a turn, but **stayed in the input box** ("`→ <the sent text>`"). One more typed character was
   appended to it. The box showed "Add a follow-up" (empty) only after a positional prompt or a
   restart.
10. **A headless turn into the open chat is lost:**
    - `cursor-agent -p --resume <id> "Reply exactly: WAKE-HOTEL"` ran with the TUI open on the
      same chat. It returned `WAKE-HOTEL`, and its lines were appended to the transcript.
    - The TUI showed nothing of it.
    - Asked next in the TUI "did you ever reply WAKE-HOTEL in this chat?", the model said "no".
    - **The transcript was rewritten without the headless turn's lines.**
11. **Files a session writes** under the throwaway home:
    - `~/.cursor/projects/<slug>/`:
      - `agent-transcripts/<id>/<id>.jsonl`;
      - `.workspace-trusted` and `repo.json`;
      - `worker.log`, the log of a per-workspace worker. It indexes the workspace (merkle sync to
        Cursor's server) and starts `npx --yes typescript-language-server`, which wrote into
        `~/.npm`.
    - `~/.cursor/chats/<md5 of the cwd>/<id>/`:
      - `meta.json`: `{schemaVersion, createdAtMs, hasConversation, title, updatedAtMs, cwd}`, with
        a **generated title** ("Marker Word Probe");
      - `store.db`: SQLite with tables `meta` and `blobs`. `meta` holds hex JSON with `agentId`,
        `name`, `mode`, `lastUsedModel` and a `blobEncryptionKey`, and the blobs are
        content-addressed.
    - `~/.cursor/cli-config.json`, `agent-cli-state.json`, `statsig-cache.json`,
      `ai-tracking/ai-code-tracking.db`, and **`~/.cursor/skills-cursor/`** (22 built-in skills
      synced at start).
    - The worker's socket is `/tmp/.cursor/<slug>/worker.sock` when the projects path is longer
      than 83 characters (read, bundle `index.js`). Measured here because the scratchpad path is
      long.

## Second round, measured on cursor-agent 2026.11.13-eacade1 (2026-11-14, 11:17–11:30)

Same conditions as the first round: a throwaway `HOME` with a copy of `auth.json`, deleted
afterwards; `--model auto`; a private tmux server; 14 short turns over 10 runs (A–J), mostly
`--resume <id> "Say OK …"` on one chat; every process checked by its `HOME` and stopped. The human's
`~/.cursor` was not touched: `cli-config.json` keeps its 10:28 mtime, and there is no
`~/.cursor/hooks.json`.

12. **A plugin's turn hooks run only when Cursor's own config has a hook for the same event.**
    `beforeSubmitPrompt`, `stop` and `afterAgentResponse` from `--plugin-dir` fire only if the same
    event also has a hook in the project's `.cursor/hooks.json` or the user's `~/.cursor/hooks.json`.
    The condition is per event.
    - A (plugin only, a new chat, 2 turns): only `sessionStart` and `sessionEnd` fired.
    - B (plugin only, `--resume`): nothing fired.
    - C (plugin + a project `hooks.json` with only `stop`): the project's `stop` and **the
      plugin's `stop`** fired; the plugin's `beforeSubmitPrompt` and `afterAgentResponse` did not.
    - D (plugin + a user `~/.cursor/hooks.json` with only `stop`): both `stop`s fired.
    - E (plugin + a Claude-format `Stop` in `~/.claude/settings.json`): nothing fired.
    - F (plugin only again, after C–E): nothing fired, so this is not a cache.

    This explains the first round. Its third run had only the plugin's hooks; its fourth had a
    project `hooks.json` with the same events.
    - `beforeMCPExecution` from a plugin fired alone.
    - `sessionStart` runs only for a new chat, never on `--resume` (read, bundle `1212.index.js`:
      the call is guarded by `!ct`, the chat to resume).
    - `sessionEnd` fired in A, C, D and E but not in B; the condition is unknown.
    - The client's own check (`hasHooksForStep`, bundle `4107.index.js`) counts plugin hooks. The
      turn hooks are requested by Cursor's server (`ExecuteHookRequest`), which seems to learn of
      user and project hooks only (inferred from the runs).
13. **`followup_message` from a `stop` hook starts a new turn in the interactive TUI** (run G).
    - The plugin's `stop` returned `{"followup_message":"[Menkar] probe event: reply exactly
      FOLLOW-INDIA."}`, enabled by a no-op project `stop`.
    - 2.4 s after the first `stop`, the model answered it: `stop` ran at 11:25:34.08 and the next
      `stop` at 11:25:36.53.
    - **The TUI shows it as an ordinary user message**, with the text as sent. The transcript
      holds it as a `<user_query>`, with nothing marking it as not typed.
    - The second `stop` had `loop_count: 1`. Only **one `turn_ended`** was written for both
      exchanges.
    - Each hook entry takes `loop_limit` (a positive integer, or null for none) and `timeout` in
      seconds (read, bundle `index.js`). The default limit was not found.
14. **A `stop` hook that waits does not hold the session** (runs G2 and G3, a 15 s `sleep` before
    answering).
    - During the wait the screen looked idle: the reply shown, the box, the footer, no spinner.
    - A message the human typed and sent during the wait **ran as its own turn at once**.
    - The late `followup_message` was then **delivered twice**: two `[Menkar] …` user messages
      and two replies.
    - So `followup_message` is usable only when the hook answers at once, from an event already
      waiting.
15. **"Allowlist MCP Tool (tab)" writes the user's `~/.cursor/cli-config.json`**, adding
    `"Mcp(plugin-plugin-probe:probe_ping)"` to `permissions.allow` (run H). Nothing else changed
    besides Cursor's own data and its skills manifest.
16. **The MCP server's name follows the plugin folder's basename, not the manifest's `name`:**
    `plugin-<folder basename>-<server key in .mcp.json>`.
    - I: the same plugin copied to another path with the same basename `plugin`, and the manifest
      renamed to `othername`. Cursor named it `plugin-plugin-probe`, and the allowlist from H
      applied: no card.
    - J: the same plugin with basename `menkar-x`. Cursor named it `plugin-menkar-x-probe` and
      showed the card.
    - So per-pane plugin folders that share one basename (`…/<pane>/menkar`) share one allowlist
      entry.

## Third round, measured on cursor-agent 2026.11.13-eacade1 (2026-11-14, 11:38–11:46)

Same conditions as before: a throwaway `HOME` with the copy of `auth.json` deleted afterwards,
`--model auto`, and 9 short turns. A no-op `stop` in the scratch repository's `.cursor/hooks.json`
made the plugin's `stop` and its tokens available (item 12).

17. **`--approve-mcps` does not remove the per-call card.**
    - Command: `cursor-agent --model auto --plugin-dir <plugin> --approve-mcps "Call the probe_ping
      MCP tool once…"`.
    - "Run this MCP tool?" was shown as without the flag.
    - It wrote no approval: `permissions.allow` stayed `["Shell(ls)"]`, and no `mcp-approvals.json`
      appeared.
    - So per run, nothing narrower than `--force` removes the card.
18. **MCP tools are deferred, not sent with their schemas.** The model reaches them through
    `GetDynamicTools {namespace, toolName}` and then `CallDynamicTool` (transcript, first round).
    The cost of listing them, from the `stop` hook's `input_tokens`, on a new chat with the same
    first prompt "Say OK.":

    | Plugin | `input_tokens` |
    |---|---|
    | none | 10015 |
    | 1 tool | 10038 (+23) |
    | 18 tools, 14,874 bytes of schemas | 10140 (+125) |
    | none, again | 10015 |

    - `cache_read_tokens` was 3968 in every run.
    - So the listing costs about 6–7 tokens per tool, not the schemas, which would be about
      3.7k tokens.
    - **Using** a tool costs a `GetDynamicTools` round trip first (one model step).
19. **`/rename <name>` writes both `meta.json`'s `title` and the `name` in `store.db`'s meta**
    (measured: "Probe Ping MCP" became "Probe Renamed Kilo" in both). It is a TUI slash command
    (read, bundle `1212.index.js`: "Usage: /rename <name>").
    - **Nothing outside sets a title:**
      - no CLI flag (`--help`);
      - a positional prompt `"/rename Probe Lima"` is **not** run as a command. It reached the model,
        which searched for a `cursor-app-control.rename_chat` tool for a whole turn and reported it
        unavailable.
      - The chat's generated title still came out "Probe Lima": the auto-namer names a chat from
        its first message (read: the name is generated once, and only while none is set).
    - The only other writers are typing `/rename` or editing Cursor's files, which are against
      Menkar's rules.
20. **Text typed while an approval card is open goes to the card.** In my own probe, `/rename …`
    and Enter sent at a card that was still open **approved the tool call** ("Run (once)"). This is
    the case the rule against typing exists for.
21. **A hidden ACP server mode exists:** `cursor-agent acp`, "Start the Cursor Agent as an ACP
    (Agent Client Protocol) server". It is hidden from `--help` (read, bundle `index.js`; its
    session sets `name` and sends `session_info_update`, `178.index.js`). It is a stdio protocol
    for a client such as an editor, not an inbound channel into a TUI. It could carry a future
    Cursor chat tab, as `codex app-server` could for Codex (inferred, not run).

## 1. The five facts

### 1.1 Starting and resuming

- **Start:** `cursor-agent [options] [prompt...]`; `prompt` is "Initial prompt for the agent"
  (measured, `--help`).
  - Flags: `--model`, `--mode plan|ask`, `--plan`, `-f/--force` (alias `--yolo`),
    `--auto-review`, `--sandbox enabled|disabled`, `--approve-mcps`, `--trust`, `--workspace`,
    `--add-dir` (repeatable), `--plugin-dir` (repeatable), `-w/--worktree`, `-p/--print`,
    `--output-format text|json|stream-json` (measured, `--help`).
- **No name at start.** No flag names a session (measured, `--help`).
  - Cursor generates a title. It is stored as `title` in `~/.cursor/chats/<md5(cwd)>/<id>/meta.json`
    and as `name` in that chat's `store.db` (measured).
  - A built-in skill `rename-chat` is synced into `~/.cursor/skills-cursor/` (measured). Whether
    a rename writes the same `title` field is **unknown**.
  - Menkar shows no Cursor name today (`docs/sessions.md`: "Cursor has no Claude names"). It could
    read `meta.json`'s `title` read-only.
- **Choosing the id:** `cursor-agent create-chat` prints a new id, and `--resume <id> "<prompt>"`
  starts that chat with the prompt (measured). That is Menkar's `--session-id` for Cursor, with no
  need to find the id afterwards.
- **Resume:** `--resume [chatId]` resumes a chat; with a positional prompt it runs that prompt as
  the first turn and keeps the history (measured). `--continue` takes the previous session, and
  `ls` / `resume` are pickers (measured, `--help`). **This settles `NOT_BUILT_YET.md`'s
  "unconfirmed".**
- **The first prompt by argument, never typed.** A typed message stayed in the box after it was
  sent (measured, item 9). The positional prompt left the box empty.
- **Workspace trust:** the first TUI run in a folder asks. Accepting it is Cursor's own write of
  `~/.cursor/projects/<slug>/.workspace-trusted`, started by the human (measured).
  - agent-deck avoids the prompt by **writing that file itself** (read,
    `internal/session/cursor_trust.go`, `PreAcceptCursorTrust`). Menkar must not do that.
  - `--trust` ("Trust the current workspace without prompting") is used by Menkar's chat with
    `-p`. Whether it skips the prompt in the TUI, and whether it writes `.workspace-trusted`, is
    **unmeasured**.
- **Exit:** Ctrl+D on an empty box ends the TUI and fires `sessionEnd` (measured).
- **Persistent sessions:** `persist list|attach|stop` keeps a chat alive in Cursor's own tmux
  server (`-L` from `CURSOR_AGENT_TMUX_SERVER_NAME`) across terminal disconnects (read, bundle
  `index.js`). A headless resume of such a chat is refused: "Chat … is still running in persistent
  session …". This is not a channel, and Menkar has no use for it.

### 1.2 Transcripts

- **Where:** `~/.cursor/projects/<slug>/agent-transcripts/<id>/<id>.jsonl` (measured).
  - The slug is the cwd with every non-alphanumeric character turned into `-`, runs collapsed and
    the ends trimmed (read, bundle `workspace-paths.js`: `replace(/[^a-zA-Z0-9]/g,"-")`). Menkar's
    `cursorCwd` rebuilds it against the filesystem.
  - The root is **`$CURSOR_DATA_DIR`, else `~/.cursor`** (read, bundle `index.js`). Menkar's
    `paths.cursorProjects` is fixed at `~/.cursor/projects`. A user who sets `CURSOR_DATA_DIR`
    would see no Cursor sessions.
- **Format** (measured; read in bundle `7923.index.js`):
  - `{"role":"user"|"assistant","message":{"content":[{type:"text",text}|{type:"tool_use",name,input}]}}`;
  - and `{"type":"turn_ended","status":"success"|"error"|"aborted","error"?}` at each turn's end.
  - A user text is `<timestamp>Saturday, Nov 14, 2026, 10:36 AM (UTC-3)</timestamp>\n<user_query>…
    </user_query>`. Menkar's `cursorUserText` strips only the `<user_query>` tags, so **the
    timestamp prefix reaches the preview**. That is worth checking against a real list row.
  - System messages are not written. Thinking text goes into the `text` block. MCP calls appear as
    `CallDynamicTool` with `namespace` and `toolName`.
- **Not append-only:** the TUI rewrote the file from its own state, dropping a headless turn's
  lines (measured, item 10).
- **What Menkar needs, by consumer:**
  - **Session list:** the cwd (from the slug, or `meta.json`'s `cwd`, which is exact), the id
    (the folder), the times (file mtime; `meta.json` `createdAtMs`/`updatedAtMs`), and the name
    (`meta.json` `title`). Today Menkar reads only the transcript. Reading `meta.json` read-only is
    allowed under "read, never rewritten".
  - **`last_reply`:** the last `assistant` text before the last `turn_ended`, or `afterAgentResponse`
    `text` from a hook (measured).
  - **Usage's time and tokens per turn:**
    - **Not in the transcript.** It has no per-line time, no tokens and no model (measured).
    - **From hooks:** `beforeSubmitPrompt` → `stop` gives the turn's start and end, as times
      Menkar records when the hook runs. `stop` gives `input_tokens, output_tokens,
      cache_read_tokens, cache_write_tokens` and `status` (measured). `model` is the requested one
      (`default` under `auto`), not the model that served the turn.
    - `store.db` holds the chat in encrypted, content-addressed blobs. It is not a source.
    - Headless `-p --output-format json|stream-json` ends with a `result` record carrying
      `duration_ms` and `usage` (measured). That is for Menkar's chat tabs, not for terminals.
    - Cost: none anywhere (inferred). Under Free/Auto it may not apply.
  - **The classifier's input:** the user text (with the `<timestamp>` and `<user_query>` wrappers
    stripped), the final reply, and the tool calls from `tool_use` blocks.
- **Menkar writes nothing there.**

### 1.3 Running state in the terminal

- **Working:** a Braille spinner, a gerund and a token count, "`⠠⠛ Thinking  45 tokens`"
  (measured). Menkar's `CURSOR_SPINNER` (`src/core/agentstate/detect.ts`) matches it. agent-deck
  also uses "ctrl+c to interrupt", "esc to interrupt" and "thinking" (read,
  `internal/tmux/patterns.go:246`).
- **Approval:** the strings of item 8. Menkar's rule set covers both cards ("run this command?" with
  "run (once) (y)"; "skip (esc or n)") (read, `detect.ts:77-90`).
- **The trust prompt** ("Workspace Trust Required … [a] Trust this workspace") matches no blocked
  rule, so it would show as idle (inferred from the regexes). It is a prompt the human must
  answer.
- **Idle:** "`→ Add a follow-up`" and the footer "`<model> · <n>%`" (measured). agent-deck's
  prompt patterns are "How can I help", `^\s*›\s`, "Ask questions", "Plan mode" and "Switch modes"
  (read, `patterns.go`), from older versions.
- **Signals that need no screen reading** (measured, item 5): `stop` at each turn's end with its
  status and tokens; `beforeSubmitPrompt` at the start; `afterAgentResponse` with the reply text.
  - A `preToolUse` / `beforeShellExecution` / `beforeMCPExecution` hook **can answer allow or deny**
    (read, bundle `4107.index.js`). Menkar must never do that.
  - The full hook list: `sessionStart`, `sessionEnd`, `beforeSubmitPrompt`, `stop`,
    `afterAgentResponse`, `afterAgentThought`, `preToolUse`, `postToolUse`, `postToolUseFailure`,
    `beforeShellExecution`, `afterShellExecution`, `beforeMCPExecution`, `afterMCPExecution`,
    `beforeReadFile`, `afterFileEdit`, `preCompact`, `subagentStart` and `subagentStop` (read).
  - agent-deck drives Cursor's status from hooks first, and falls back to the screen when a hook
    sample is stale (read, `internal/session/hook_status_tools.go`).

### 1.4 Status line and context reading

- **Built in:** the footer shows the context used ("`Auto · 4.4%`", measured).
- **A command status line exists, like Claude Code's** (read, bundle `index.js`, `1212.index.js`):
  - Config: `statusLine: {type:"command", command, padding?, updateIntervalMs?, timeoutMs?}` in
    `cli-config.json`.
  - Its stdin is JSON with `session_id`, `transcript_path`, `cwd`, `model{id, display_name}`,
    `workspace{current_dir, project_dir}`, `version`, `context_window{total_input_tokens,
    total_output_tokens, context_window_size, used_percentage, remaining_percentage,
    current_usage}`, and `session_name` when named.
- **But it lives only in the user's `cli-config.json`.** The config folder is
  `$CURSOR_CONFIG_DIR`, else `$XDG_CONFIG_HOME/cursor`, else `~/.cursor` (read). The project-level
  `.cursor/cli.json` takes only `permissions` (read). No flag sets it per run.
  - So a per-session status line means either the integrations menu writing the user's
    `cli-config.json` (consent, as for Claude's `~/.claude/settings.json`), or starting Cursor with
    `CURSOR_CONFIG_DIR` pointed at a folder of Menkar's. The second moves **all** of Cursor's
    config for that session: permissions, the global `mcp.json`, the model choice.
- **Context for Menkar without a status line:** the `stop` hook's `input_tokens` against a context
  size Menkar would have to know per model (inferred). `cache_read_tokens` is part of input (to
  check).

### 1.5 Remote mode

- Nothing like Claude Code's Remote Control for a running local session (read, `--help` and the
  bundle). What exists:
  - `worker` runs a self-hosted *cloud agent* worker that executes cloud agents' tool calls on this
    machine. It is a different product.
  - `persist` survives terminal disconnects, through tmux.
  - The TUI has a "transfer to cloud" action (`onTransferToCloud`, read), which moves the chat to
    Cursor's cloud.
- Menkar's agent entry should declare **no remote mode for Cursor** (inferred).

### 1.6 Per-session configuration, and what reaches which process

There is no daemon or embedded split as in Codex. Each `cursor-agent` is its own process with a
per-workspace worker child (measured, `pstree`). What can be given **for one run without writing
the user's files**:

| Need | Per run | Measured |
|---|---|---|
| MCP server | `--plugin-dir` with `.mcp.json` | yes; no server prompt, one card per tool call |
| Hooks (turn end, reply text, tokens) | `--plugin-dir` with `hooks/hooks.json` | no trust prompt; **but the turn hooks run only if the user's or the project's `hooks.json` has the same event** (item 12) |
| Skills | `--plugin-dir` with `skills/<name>/SKILL.md` | yes (the model found and read it) |
| Rules | `--plugin-dir` with `rules/*.mdc` | **no**: an `alwaysApply` plugin rule was not in context |
| Extra folders | `--add-dir` | not measured |
| Status line | none (only `cli-config.json`, or `CURSOR_CONFIG_DIR`) | read |
| Auto-approving Menkar's tools | none narrower than `--force` / `--yolo` | read; the allowlist lives in `cli-config.json` or the project's `.cursor/cli.json` |

### 1.7 Environment variables a running Cursor sets for its children

The `sessionenv.ts` counterpart, so that a Menkar started from a terminal inside Cursor does not
hand them on.

| Variable | Set where | Says |
|---|---|---|
| `CURSOR_AGENT=1` | shell commands (measured) | "I run under Cursor's agent" |
| `CURSOR_CONVERSATION_ID` | shell commands (measured) | the parent chat |
| `CURSOR_REQUEST_ID` | shell commands (measured) | the parent's request |
| `CURSOR_ASKPASS_SOCKET`, `CURSOR_ASKPASS_SECRET` (and `CURSOR_ASKPASS`, read) | shell commands (measured) | the parent's credential prompt relay |
| `AGENT_TRANSCRIPTS` | shell commands (measured) | the parent's transcripts folder |
| `GIT_EDITOR=true`, `GIT_CONFIG_COUNT=1`, `GIT_CONFIG_KEY_0=core.quotePath`, `GIT_CONFIG_VALUE_0=false` | shell commands (measured) | git tuned for the agent |
| `NO_COLOR=1`, `TERM=dumb` | shell commands (measured) | output tuned for the agent; they look like the user's own settings, so stripping them is a decision, as for Codex |
| `CURSOR_INVOKED_AS`, `NODE_COMPILE_CACHE` | the wrapper script, so every child (read, `cursor-agent`; measured) | how Cursor was invoked; Node's cache |
| `CURSOR_RIPGREP_PATH` | every child (measured) | Cursor's `rg` |
| `CURSOR_PROJECT_DIR`, `CLAUDE_PROJECT_DIR`, `CURSOR_PLUGIN_ROOT`, `CLAUDE_PLUGIN_ROOT`, `CURSOR_TRANSCRIPT_PATH`, `CURSOR_VERSION`, `CURSOR_USER_EMAIL` | hooks (measured) | the parent's project, plugin, transcript, version and the user's email |
| `CURSOR_SANDBOX`, `CURSOR_SANDBOX_*` | sandboxed commands (read, names only) | sandboxed |

- `CLAUDE_PROJECT_DIR` and `CLAUDE_PLUGIN_ROOT` are already on Menkar's list.
- **The keys that are configuration and are kept:** `CURSOR_API_KEY`, `CURSOR_API_ENDPOINT`,
  `CURSOR_CONFIG_DIR`, `CURSOR_DATA_DIR`, `CURSOR_AUTH_TOKEN_FILE` (read).
- **The reverse direction:** Cursor started by Menkar must not get Claude Code's variables.
  `withoutSessionEnv` already strips them from every pty. The probe ran without it, and its hooks
  saw `CLAUDE_CODE_CHILD_SESSION` and others, which shows that Cursor passes the pty's
  environment through as it is.
- **The user's email reaches every hook** (`user_email`, `CURSOR_USER_EMAIL`). A Menkar hook must
  not log the payload as it is.

## 2. Messages: waking a Cursor session, and sending and receiving

**No inbound channel (read, bundle; measured where said)**

- No `queue` command, no socket a TUI listens on for input, no server mode the TUI is a client of
  (`--help`; the bundle's `persist`, `worker` and `create-chat` are the only session commands).
- The protobufs name a `StreamLocalAgentMailbox` and "subscription" deliveries. They are RPCs of
  Cursor's server for its automations (read, bundle `index.js`), not a local channel. Whether
  they ever reach a TUI is **unknown**; nothing documents them.
- In the TUI, a message typed while a turn runs is queued (`onSendQueuedNow`, read). That is
  typing.
- `-p --resume <id>` into an open chat **loses the turn** (measured, item 10). It is unusable as
  a wake, and dangerous: it runs tools in the user's folder that the visible session never knows
  about.

**The ways to wake a Cursor session, against the rule that nothing is typed (2.21)**

| Way | Keeps the rule | Notes |
|---|---|---|
| **End and `--resume <id> "<event>"`** | **Yes** | Measured: the history is kept and the event runs as the first turn. Costs as in `wake-orchestrator.md` §5: draft lost, background shells cut, restart time (a few seconds, plus re-indexing). Cursor's only rule-keeping wake for an **idle** session |
| A `stop` hook answering `{"followup_message": "<event>"}` | Yes | **Measured** (items 13–14): a new turn about 2.4 s later, shown as an ordinary user message. **Only at the end of a turn in progress**, and only if the hook answers at once: a waiting hook leaves the session idle and typable, and its late answer was delivered twice. **Needs a `stop` entry in the user's `~/.cursor/hooks.json`** (or the project's), or the plugin's `stop` never runs (item 12) |
| Typing into the pty (agent-deck: tmux send after a prompt check) | **No**, amends the rule | Measured fragility: the sent text stayed in the box |
| Headless `-p --resume` into the open chat | — | Measured: lost on the TUI's next turn |
| A blocking MCP call or a waiting `stop` hook | Yes | Keeps the turn "working" (Dorothy's model); a hook has a timeout (read: `timeoutMs`-style fields; value unknown) |

**Recommendation for 2.21, for the human:** for Cursor, an event for a **working** session waits
for its `stop` hook and goes out as `followup_message`, which keeps the rule and needs no restart.
This needs the user's consent to a `stop` entry in `~/.cursor/hooks.json` (item 12). Without it,
every Cursor wake is end-and-resume.
An event for an **idle** session is end-and-resume, using the chat id Menkar chose with
`create-chat`. Typing stays plan B only if the restart cost proves too high in practice.

## 3. Mixed teams

- **Nothing in the transport stops a Cursor session from taking part next to Claude Code and Codex
  sessions.** Menkar's `wake(session, text)` is per agent (1.72), `last_reply` per agent, and
  Menkar's tools are MCP, which Cursor takes through `--plugin-dir` (§4).
- **What each direction needs:**

| Direction | Wake / report | What Menkar adds |
|---|---|---|
| Claude parent → Cursor child | Menkar sees the child's turn end (`stop` hook, screen) and posts to the Claude parent's socket, as today | the Cursor `stop` hook record; `last_reply` for Cursor (`afterAgentResponse` text, or the transcript) |
| Codex parent → Cursor child | as above, delivered by `codex queue` | — |
| Cursor parent ← any child | `followup_message` if the parent is mid-turn; end-and-resume if idle | the Cursor `wake`; the parent's chat id (known from `create-chat`) |
| Any session → a named session | Claude's `SendMessage` reaches only Claude Code; Cursor has nothing like it | **Menkar's MCP `send_message { name, text }`**, routed through the receiver's `wake`, as `codex.md` proposes |

- **`start_session { agent? }`**, as in `codex.md`: `agent: "cursor"` runs `create-chat`, then
  `cursor-agent --model <model> --plugin-dir <Menkar's> --resume <id> "<prompt>"`.
  - `model` is passed as `--model`. Which models a user's plan allows is Cursor's business: a
    refused model shows as an error in the conversation (measured).
  - `remote_control` is refused for Cursor.
  - **A Cursor child's tool calls show an approval card for every Menkar tool** (§4), so an
    orchestrating Cursor session needs the human, or an allowlist, at each call.

## 4. Menkar's MCP server and skills in a Cursor session

- **MCP per session without touching `~/.cursor`:** a plugin folder passed with `--plugin-dir`,
  holding `.mcp.json` (or `mcp.json`) as `{"mcpServers": {"menkar": {command, args, env}}}`
  (measured). Cursor names the server `plugin-<plugin folder name>-<server>` (measured:
  `plugin-plugin-probe` for a folder named `plugin` and a server named `probe`).
  - **The pty's environment does not reach the server** (measured, item 4). `MENKAR_PANE` must be
    in `env`, and a static plugin file cannot hold a per-pane value. The ways:
    - (a) **a plugin folder per pane in Menkar's own cache directory**, with the pane in
      `.mcp.json`'s `env`. The skills and hooks can be symlinks to Menkar's shipped ones
      (inferred).
    - (b) `${env:MENKAR_PANE}`-style interpolation in `.mcp.json`. Cursor's editor documents
      this, but it is **unverified in the CLI**.
    - (c) the MCP server identifying the caller another way. It is not given the chat id
      (measured: no `CURSOR_*` in its environment).
  - **agent-deck instead writes the project's `.cursor/mcp.json` or the user's
    `~/.cursor/mcp.json`** (read, `internal/session/instance_mcp.go:27,47`). That is not open to
    Menkar.
  - **Approvals:** the server loaded with no prompt, but **every tool call showed "Run this MCP
    tool?"** (measured). The ways around it are all the human's:
    - "Allowlist MCP Tool (tab)" on the card, which writes `Mcp(<server>:<tool>)` into
      `permissions.allow` of their `~/.cursor/cli-config.json` (measured, item 15). The server is
      `plugin-<folder basename>-<key>`, so the per-pane folders must share one basename for one
      entry to cover every pane (measured, item 16);
    - `permissions` in the project's `.cursor/cli.json`, which is their repository;
    - `--force`, which approves everything.

    Whether `--approve-mcps` covers tool calls or only servers is **unmeasured** (its help says
    "approve all MCP servers").
- **Hooks per session:** the same plugin's `hooks/hooks.json` (`{"version":1,"hooks":{"stop":
  [{"command":"…"}]}}`) runs with no trust and with the pty's environment, `MENKAR_PANE`
  included (measured). So **the turn's end can be recorded per pane with no file written**. That
  is better than Codex, where the per-session `notify` replaces the user's own.
  - Plugin hooks and the user's own hooks both run (measured with the project's `.cursor/hooks.json`
    beside the plugin's).
- **Skills:**
  - **Per session:** the plugin's `skills/` (measured).
  - **In folders:** Cursor also reads `.cursor/skills`, `.agents/skills`, `.claude/skills`,
    `.codex/skills` and `.grok/skills` in the workspace, plus `~/.cursor/skills-cursor` (its
    built-ins) (read, bundle `index.js`; `.claude/`, `.codex/` and `.grok/` count as third-party
    and are gated by a setting).
  - **Menkar's existing plugin may load as it is:** Cursor accepts `.claude-plugin/plugin.json` as
    a manifest and discovers `skills/` by default (read, bundle `manifest-parser.js`; inferred,
    not run).
  - The skills' text names Claude Code tools (`SendMessage`, `--plugin-dir`). It would need an
    agent-neutral wording or a Cursor variant (inferred, as for Codex).
- **Rules from a plugin did not reach the context** (measured: the plugin's `alwaysApply` rule's
  marker was missing), so a project-instructions-like text cannot ride on the plugin's rules. A
  skill, or text in the first prompt, can.

## 5. Project instructions (the Cursor side only; `claude-cli` covers Claude Code)

Measured with marker words. Read in bundle `index.js` (`LocalCursorRulesService`,
`loadRulesFromDirAndAncestors`, `cursor-rule-bodies.js`).

- **Read, and in context at start** (measured):
  - `AGENTS.md` in the cwd;
  - **`CLAUDE.md`** in the cwd;
  - `.cursor/rules/*.mdc` with `alwaysApply: true`.
- **Not in context at start:** `sub/AGENTS.md`, below the cwd (measured). Nested `AGENTS.md` and
  `**/.cursor/rules/**/*.mdc` are watched (read). Whether they apply when the agent works in that
  folder is unknown.
- **Upward:** from the cwd to the filesystem root, every folder's `.cursor/rules/`, `AGENTS.md`,
  and `CLAUDE.md` and `CLAUDE.local.md` (read). There is no stop at the git root, unlike Codex.
- **`CLAUDE.md` / `CLAUDE.local.md` are "third-party"** and read only while that setting is on. It
  was on by default here (measured, CLAUDE-BRAVO in context).
- **Size:** each file is cut at **100 KB**, with "[truncated: … only the first 100 KB is
  included]" (read). This repository's `CLAUDE.md` is well under it.
- **Not read:** `.claude/rules/*.md` (this repository's `ts-tests.md`) and `@`-imports (read: not
  in the loaded list; inferred for the imports). The legacy `.cursorrules` is read (read).
- **For the move to `AGENTS.md` (1.127):** Cursor reads either name. If `CLAUDE.md` became
  `@AGENTS.md`, Cursor would read both files and see the text once plus a bare `@AGENTS.md` line
  (inferred). That is harmless, but worth a look.

## 6. agent-deck on Cursor, in short

Read at `9fa44b5`. Cursor is a first-class tool there, launched as `agent` or `cursor agent`.

| Area | agent-deck | Takeable by Menkar |
|---|---|---|
| Command | `agent`, else `cursor agent` (`cursor_command.go`) | yes, as knowledge (Menkar uses `cursor-agent`) |
| Start / resume | the bare command; restart adds **`--continue`** (the folder's last chat, not a given one) (`instance_cmd_build.go:1437`, `instance_restart.go:1457`) | no: `--resume <id>` is exact |
| Workspace trust | writes `~/.cursor/projects/<key>/.workspace-trusted` itself (`cursor_trust.go`) | **no** |
| State | hooks first: `agent-deck hook-handler` installed into **`~/.cursor/hooks.json`** for `sessionStart, sessionEnd, beforeSubmitPrompt, preToolUse, postToolUse, stop` (`cursor_hooks.go`); screen patterns as a fallback (`patterns.go:246`) | events and strings yes; the install **no** (`--plugin-dir` instead) |
| MCP | writes the project's `.cursor/mcp.json` or `~/.cursor/mcp.json` (`instance_mcp.go`) | **no** (`--plugin-dir` instead) |
| Messages | typed through tmux after a Cursor prompt check (`internal/send/ready.go:139`) | **no** (typing) |
| Skills | not specific to Cursor | — |

## What Menkar would need to build

1. **The agent entry for Cursor** in `src/core/agents.ts` declares: no remote mode; enabled on
   Linux; no name at start; resume `--resume <id> [prompt]`; an id chosen by `create-chat`; how to
   wake.
2. **The command builder for Cursor** (today Cursor gets only `--resume`):
   - a new session as `create-chat`, then `--resume <id> "$(cat <prompt file>)"`;
   - `--model`;
   - `--add-dir <files folder>` (unmeasured);
   - `--plugin-dir <a per-pane plugin folder in Menkar's cache>` holding `.mcp.json` (Menkar's
     server, `MENKAR_PANE` and `ELECTRON_RUN_AS_NODE` in `env`), `hooks/hooks.json` (`stop`,
     `beforeSubmitPrompt`, `afterAgentResponse`) and the skills.
3. **A hook program** that records, per pane: the turn's start and end, its status, tokens and final
   text, keyed by `MENKAR_PANE` and the chat id, and **drops `user_email`**. It is the Cursor
   counterpart of the statusline record and the Stop hook.
4. **The Cursor reader, extended:**
   - honor `CURSOR_DATA_DIR`;
   - strip the `<timestamp>` wrapper from user text;
   - take `turn_ended` as the turn boundary;
   - read `meta.json` `title`/`cwd` read-only for the name and the exact cwd;
   - take Usage's time and tokens from the hook records, since the transcript has none.
5. **Agent-state for Cursor:** the hook record first, the screen second. Check the trust prompt and
   the current strings (§1.3) against `detect.ts`.
6. **`wake` for Cursor:** at the `stop` hook as `followup_message` if the session is working; end
   and `--resume <id> "[Menkar] …"` if it is idle. Never `-p --resume` into an open chat.
7. **`start_session { agent? }` and `send_message`**, shared with Codex (`codex.md` §3).
8. **Skills for Cursor sessions** through the plugin folder, with an agent-neutral text.
9. **`sessionenv.ts` for Cursor:** the variables in §1.7.
10. **The enabling hook entry.** For the plugin's `beforeSubmitPrompt`, `stop` and
    `afterAgentResponse` to run, the user's `~/.cursor/hooks.json` needs one entry per event
    (measured, item 12). That entry would be an integrations-menu item, accepted and removable on
    its own, as for `~/.claude/settings.json`. It could then be Menkar's hook itself, telling panes
    apart by `MENKAR_PANE`, which would make the plugin's hooks redundant (inferred).
11. **What stays the human's (topics for `set`):**
    - **whether Menkar may offer a `~/.cursor/hooks.json` entry** through the integrations menu.
      Without it, a Cursor session gives Menkar no turn end, no tokens and no `followup_message`:
      the screen and the transcript only;
    - 2.21 for Cursor: `followup_message` plus end-and-resume, against typing;
    - **Menkar's tools asking for approval at every call** in a Cursor session: accept it,
      allowlist once (their config or the project's `.cursor/cli.json`), or start Cursor sessions
      with `--force`;
    - the status line: none, an integrations-menu entry that writes `cli-config.json`, or a
      `CURSOR_CONFIG_DIR` of Menkar's;
    - the workspace trust prompt on a new folder: it is the human's answer, and Cursor writes it;
    - naming: Cursor has no start-time name. Is a Cursor session named by Cursor's `title` (the
      rule "the name is the one the agent has")?

## Still unknown

Each is asked of `set` first, and runs in a throwaway home.

1. ~~Why a run fired no `stop` / `beforeSubmitPrompt`~~: answered, item 12. Still open: why
   `sessionEnd` fired in some runs and not in B, and whether an entry in the project's
   `.claude/settings.json` (another source Cursor lists) enables it.
2. ~~Whether `followup_message` starts a turn~~: answered, items 13–14. Still open: the default
   `loop_limit`, and the cause of the double delivery after a waiting hook.
3. Whether `.mcp.json` in a plugin expands `${env:MENKAR_PANE}`. (`--approve-mcps`: it does not
   skip the card, item 17. Where the allowlist writes, and the server's name: answered, items
   15–16.)
4. Whether `--trust` skips the TUI's trust prompt, and whether it writes `.workspace-trusted`.
5. `--add-dir` in the TUI.
6. ~~Whether a rename writes `meta.json`'s `title`~~: `/rename` does, and nothing outside the TUI
   sets it (item 19).
7. Whether nested `AGENTS.md` and rules apply when the agent works in that folder.
8. Whether Menkar's own plugin folder (`.claude-plugin/plugin.json`) loads in Cursor as it is.
9. Windows and macOS: paths, the trust file, the worker socket.
10. A model the human's plan serves with explicit settings: the probes ran on `auto` only.
