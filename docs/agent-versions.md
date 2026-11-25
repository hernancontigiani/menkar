# The coding agents' versions Menkar is validated with

Decision 1.179 (the human, 2026-11-17). One row per agent:
- the last version validated, and its date;
- what was measured, each item marked with the version it was **last measured** on;
- how to repeat the checks.

Each agent's consultant session owns its row. A newer version than the row's is not known to work;
an item marked with an older version than the row's was not re-checked on the row's version.

Marks:
- **measured** means run with the real CLI in a throwaway home against a stand-in API, never the
  human's;
- **read** means read in the docs, the changelog or the binary, not run.

**What the user sees** (1.179, part 2, amended by 1.187 on 2026-11-19): Settings › About lists
each agent's installed and validated version, and says when the installed one is newer by a patch;
a banner under the header says when the installed one is below Menkar's floor (red) or newer than
validated by a minor or major version (amber), until Hide for that version.
A row's version here is the descriptor's `versions.validated`
(`src/core/agents/<id>/descriptor.ts`), and a test keeps the two equal: a new row is a new release
of Menkar.

## Claude Code — validated at 2.1.330 (2026-11-21), owner: `claude-cli`

| What | State | Where it is described |
|---|---|---|
| Start and resume: `--session-id`, `-n`, `--model`, `--resume`, `--fork-session`, `--remote-control`; the first prompt before `--add-dir`/`--mcp-config` (both swallow later words) | measured 2.1.322; the swallowing fixed upstream in 2.1.326 (read, changelog) | `docs/session-control.md`, `docs/window.md` |
| `--add-dir` stops every start at a trust dialog whose default is "No, exit"; the files folder goes as `permissions.additionalDirectories` in `--settings` instead | measured 2.1.330 (probes: `add-dir.mjs`) | `docs/project-files.md` |
| `--settings`: statusline, SessionStart and Stop hooks, `permissions.allow: ["mcp__menkar"]`, `crossSessionInbound: "accept"` | measured 2.1.322 | `docs/context.md` |
| `--mcp-config` inline adds Menkar's server beside the user's; `mcpServers` in `--settings` is ignored; the server inherits the pty's env | measured 2.1.322 | `docs/session-control.md` |
| `--plugin-dir` loads the skills plugin as `menkar:<folder>`, no trust prompt | measured 2.1.322 | `docs/session-control.md` |
| The team block by `--append-system-prompt-file`: in the first request's system prompt, read once at start, kept on `--resume` until a compaction unless `--system-prompt-snapshot off`; a missing file exits at once | first request and missing file measured 2.1.330 (`team-block.mjs`); resume and snapshot measured 2.1.325 | `docs/session-control.md` |
| The state screens: the permission card ("Do you want to proceed?"), auto mode's consecutive-block card with its 2-minute countdown (after which Claude Code blocks the call itself and the turn ends), the footer's background pills | cards measured 2.1.330 (`permission.mjs`), the countdown's expiry 2.1.326; the shell's and monitor's "N … still running" measured 2.1.329 (by hand), a scheduled task shows none; pills read 2.1.323 | `docs/agent-state.md` |
| Waking: a post to the registry's messaging socket wakes an idle session, leaves a permission card untouched, is held in bypass mode without `crossSessionInbound: "accept"`; identical repeats are dropped | idle wake and transcript record measured 2.1.330 (`wake.mjs`); the card and bypass cases 2.1.322 | `docs/session-control.md` |
| The orchestrator's prompt hook: a `UserPromptSubmit` hook in `--settings` whose `additionalContext` reaches the model on the next prompt of any kind (typed, from the command line, a wake, a peer's message) and is recorded as a `hook_additional_context` attachment, nothing on screen; built-in commands (`/clear`, `/compact`, `/model`, `/rename`) do not run it; whole up to 10,000 characters; run under `/bin/sh -c` | Menkar's real hook measured 2.1.330 (`prompt-hook.mjs`); the cases and the size 2.1.327 | `docs/context.md` |
| A peer message's turn (a `[Menkar]` post or a `SendMessage`) gets no attachments: a resumed session's plugin skills and deferred tools are listed only after that turn's first tool call, while the Skill tool and `ToolSearch select:` find them by name before it; a prompt turn lists them at once. A post that reaches a session resumed with a prompt before that prompt is sent runs first, and the prompt follows as the next turn | measured 2.1.330 (`peer-turn.mjs`; the order by hand, 3 of 3) | `docs/session-control.md` |
| `SendMessage` between sessions: the child's transcript records `to` as typed and `toolUseResult {success, message, display, msg_id}`; the receiver's record carries `origin.kind: "peer"` | read 2.1.325 (own transcript) | `docs/session-control.md` |
| Transcripts: `~/.claude/projects/<cwd>/<id>.jsonl`; the registry `~/.claude/sessions/<pid>.json` | measured 2.1.322; registry shape read 2.1.319 | `docs/sessions.md` |
| Project skills load from the start folder and every parent (outside git too), the nearest wins | measured 2.1.325 | — |
| A turn that ends with no visible text gets a reminder that starts another turn | read 2.1.325 (binary) | `docs/NOT_BUILT_YET.md` |

**Not checked on any version:** macOS and Windows; an untrusted start folder; the real auto-mode
classifier's own cards (only a stand-in's "block" answers).

## Codex — no row yet, owner: `codex`

Decision 1.196 (Menkar names every Codex session it starts with a name) rests on `codex`'s
research file item 27 (2026-11-20, task 167): a Codex TUI with Menkar's MCP server mounted
generates no title. Re-measured on each Codex upgrade.

## Cursor — validated at 2026.11.13-eacade1 (2026-11-24), owner: `cursor`

Menkar's floor is 2026.11.13, the version `--new-session-id` was measured on by `cursor`
(2026-11-23): below it a new session's id is Cursor's own and it starts without its team block
(`docs/agents.md`, "Cursor: starting a session").

| What | State | Where it is described |
|---|---|---|
| Start and resume: `cursor-agent` (new), `cursor-agent --resume <id>` (history kept); `--resume <id> "<prompt>"` runs the prompt as the first turn; the hidden `--new-session-id <uuid>` makes a new chat with that id, and a later `--resume <uuid>` finds it; `create-chat` prints an id and writes nothing | measured 2026.11.13-eacade1 (task 75; cursor.md M2–M3, §5b) | `docs/agents.md` |
| A resume carries no `--add-dir` and Menkar never passes `--trust` (1.214, 2026-11-24): the `--add-dir` grant is per process, and `--add-dir` on a resume raises a trust box each time, stalling every wake; the team block names the project's files folder instead | measured 2026.11.13-eacade1 (`cursor`, topic 109; built in task 228) | `docs/agents.md` |
| The first run in a folder asks "Workspace Trust Required"; accepting writes `~/.cursor/projects/<slug>/.workspace-trusted` (Cursor's own write, the human's answer) | measured 2026.11.13-eacade1 | `docs/agents.md` |
| Transcripts: `$CURSOR_DATA_DIR` or `~/.cursor`, `projects/<slug>/agent-transcripts/<id>/<id>.jsonl`, `{role, message.content}` lines and `{"type":"turn_ended","status"}`; user text wrapped in `<timestamp>…</timestamp>` and `<user_query>`; no tokens, model or per-line time; the TUI rewrites the file, a tool_use line is flushed only after its card is answered, a Skip leaves no result line and the reason typed is not recorded | measured 2026.11.13-eacade1 (tasks 75, 77) | `docs/sessions.md` |
| The state screens: working (Braille spinner, "Thinking N tokens"), the shell and MCP cards ("Run this command?", "Run this MCP tool?") as blocked, the "Tell the agent what to do instead" box as blocked (its footer says "ctrl+c to stop"; Esc goes back to the card), idle "→ Add a follow-up" with "<model> · <n>%" | measured 2026.11.13-eacade1 (tasks 75, 77; fixtures in `tests/data/agents/cursor/`) | `docs/agent-state.md` |
| Chat tabs: `-p --output-format stream-json --stream-partial-output --trust` with `--mode ask` (refuses to run tools) or `--force` (runs them), `--resume <id>` per message | measured 2026.11.13-eacade1 (task 75) | `docs/chat.md` |
| `--plugin-dir <folder>` loads `.mcp.json`, `hooks/hooks.json` and `skills/` for that run, nothing written to `~/.cursor`, no trust prompt; a plugin's `rules/` do not reach the context | measured 2026.11.13-eacade1 (cursor.md M4–M5, §5b) | `docs/session-control.md` |
| Menkar's MCP server by the plugin: named `plugin-<folder basename>-<key>`; its env is only `HOME LOGNAME PATH SHELL TERM USER` plus `.mcp.json`'s `env` (`MENKAR_PANE` must go there); tools deferred (+125 input tokens for 18 tools); a card at every call; `--approve-mcps` changes nothing; "Allowlist MCP Tool" writes `Mcp(<server>:<tool>)` into `~/.cursor/cli-config.json` `permissions.allow` (D7) | measured 2026.11.13-eacade1 (cursor.md M4, M15–M18) | `docs/session-control.md` |
| A plugin's turn hooks (`beforeSubmitPrompt`, `stop`, `afterAgentResponse`) run only with a same-event entry in `~/.cursor/hooks.json` or the project's `.cursor/hooks.json` (D13); `sessionStart`, `sessionEnd` and `beforeMCPExecution` run without; hooks see the pty's env; `stop` carries status and tokens, `afterAgentResponse` the reply | measured 2026.11.13-eacade1 (cursor.md M12) | `docs/session-control.md`, `docs/usage.md` |
| Waking a working session: `stop`'s `followup_message` starts the next turn about 2.4 s later, as an ordinary user message; a hook that waits leaves the session idle and its late answer was delivered twice. An idle session: end and `--resume <id> "<event>"` | measured 2026.11.13-eacade1 (cursor.md M13–M14, M3) | `docs/session-control.md` |
| The team block as the plugin's `sessionStart` `additional_context`: before the first answer, kept through `/summarize` and `--resume`, frozen at the chat's creation (a changed text is not seen on resume); runs only for a new chat | measured 2026.11.13-eacade1 (cursor.md §5b) | `docs/session-control.md` |
| The user's `~/.cursor/hooks.json` (always that path, also under `CURSOR_CONFIG_DIR`): `command` run through a shell; a missing program (exit 127) or a failing one (exit 1) is skipped with no screen, no delay and no write (`failClosed` false by default); a slow one delays the turn unless the entry's `timeout` (seconds) cuts it; Cursor never rewrites the file | measured 2026.11.13-eacade1 (task 215) | `docs/packaging.md` |
| `cli-config.json` (`$CURSOR_CONFIG_DIR`, else `$XDG_CONFIG_HOME/cursor`, else `~/.cursor`) is rewritten by Cursor at every start: reformatted, keys reordered, unknown keys dropped, `permissions.allow` kept; `Mcp(<server>:*)` allows every tool of a server | measured 2026.11.13-eacade1 (task 215) | `docs/session-control.md` |
| The version word: `cursor-agent --version` prints `2026.11.13-eacade1`, no colour even under `FORCE_COLOR` (word 0) | measured 2026.11.13-eacade1 | `docs/agent-versions.md` |
| Every TUI start runs a background update check 2 s in, unless the hidden `--disable-auto-update` or the `static` channel; an update installs a new `~/.local/share/cursor-agent/versions/<v>/` | read 2026.11.13-eacade1 (bundle); no update seen on this machine 2026-11-14 to 11-23; left native, no hidden flag passed (1.213) | — |

**The version is a date** (1.213, 2026-11-23): `2026.11.13-eacade1` is compared as it is, as the
numbers 2026, 11, 13 (the hash is dropped). A build from a later month is a minor jump, so the
amber banner shows about once a month; a later build in the same month is a patch; two builds of
one day compare equal.

**Not checked on any version:** a stand-in API: every measured item ran on the human's login
(Free, `--model auto`), not a stand-in, in a throwaway home; a model other than `auto`; macOS.

**Not checked on 2026.11.13-eacade1** (task 226, `cursor`'s real check of 2026-11-24, stopped when
the human's Cursor Free plan ran out of requests; re-checked after the plan resets on 2026-12-14,
task 226):
- **Cursor as the orchestrator**, woken through its waker, and how often it restarts: until it
  passes, the descriptor says `orchestrates: false` and the mode's card does not offer Cursor as
  the orchestrator (1.216);
- a held message going once the box is emptied (the limit screen left the refused prompt in the
  box, a draft);
- `/summarize` on a resumed pane retelling the whole team block (not conclusive);
- `/resume` followed by the tab (not conclusive, as `/new` was not followed then);
- the "Run this MCP tool?" card's screen, for `tests/data/agents/cursor/screens.json` (read as
  blocked, its text not kept);
- `/new` followed by the tab, and the idle wake's restart, after task 227's fixes (the chats found
  under Cursor's config folder; restarts spaced) and task 228's (a resume with no `--add-dir`):
  covered by the stand-in only.

How to repeat: a throwaway `HOME` holding a copy of the human's `~/.config/cursor/auth.json`
(deleted after), the real `cursor-agent` in a private tmux server, a scratch git repository with a
no-op `stop` in its `.cursor/hooks.json` to read tokens, a per-run `--plugin-dir` with a stdio MCP
stub and a logging hook; every process checked by its `HOME` in `/proc/<pid>/environ` and stopped by
PID; `/tmp/.cursor/<slug>/` and `/tmp/cursor-askpass-*.sock` the run made removed. To move into
`scripts/agent-probes/cursor/`.

## OpenCode — validated at 2.3.0 (2026-11-23), owner: `opencode`

| What | State | Where it is described |
|---|---|---|
| Menkar's own server: `opencode serve --stdio --port <p>` with `OPENCODE_PASSWORD` and `OPENCODE_CONFIG_CONTENT`; it exits when its stdin closes (also after a SIGKILL of Menkar) and takes its MCP children with it; the password does not reach them | measured 2.3.0 (real check, task 198) | `docs/agents.md` |
| A session made through the API before its TUI (`POST /api/session {id, title, location, model}`), its first prompt posted, then `opencode --server <proxy> -s <id> <dir>`: the title kept, the prompt sent once, `/new` resending nothing | measured 2.3.0 (task 198) | `docs/agents.md` |
| The per-pane proxy: plain HTTP/1.1 and SSE, the pane's session from `POST /api/rpc/opencode.goal/get`; the pane follows `/new` and the picker | measured 2.3.0 (task 198) | `docs/session-control.md` |
| The screen, read whole (the hidden cursor stays where it last drew): working (`esc interrupt`, `esc again to interrupt`), idle after an interrupt, the permission card and the question card as blocked; a subagent keeps its root working | measured 2.3.0 (task 198, re-check on 492) | `docs/agent-state.md` |
| Waking by `POST …/prompt {delivery:"queue"}`: an idle session at once, behind a permission card untouched, a draft kept | measured 2.3.0 | `docs/session-control.md` |
| Menkar's MCP per folder (`PUT /api/experimental/mcp/<server>`, `codemode:false`): its tools listed directly, no card with `menkar_*: allow`; every session in that folder sees them, mode on or off (1.141) | measured 2.3.0 (task 198) | `docs/session-control.md` |
| The team block as the instruction entry `menkar.team`: in the system prompt before the first answer; a change mid-turn reaches the model at the next step as a `<system-update>`, with no new turn | measured 2.3.0 (task 198) | `docs/session-control.md` |
| Usage from `opencode.db` (read only): a turn per root user message, subagents under their root; the cost and tokens equal OpenCode's `session_v2` | measured 2.3.0 (task 198) | `docs/usage.md` |
| The context reading: the catalog's `limit.context` from the `kv` row; none for a model outside the catalog, while OpenCode's footer uses the user's config | measured 2.3.0 (none shown for a config-only provider); a catalog model not checked with a stand-in | `docs/usage.md` |
| D9: a turn of the session in another server is detected at a resume, and one Menkar line is drawn in the pane, plus a log notice | measured 2.3.0 (task 198) | `docs/agents.md` |
| The version word: `opencode --version` prints `opencode v2.3.0` (in colour under `FORCE_COLOR`); read with `NO_COLOR` as `2.3.0` | measured 2.3.0 (task 198, re-check) | `docs/agent-versions.md` |
| The TUI's own update check opens an "Update available" modal when a newer OpenCode exists (2.4.0 here) | measured 2.3.0; a topic for the human | — |

How to repeat: extract the build's `.deb`; run the real-check specs (`rc/*.spec.ts`: `launchApp`
with `MENKAR_E2E_EXECUTABLE`, the real `opencode` linked into the run's `bin/`, and a stand-in
OpenAI-compatible model declared in the throwaway `opencode.json`) under `xvfb-run`; never the
human's home, service or credentials.

## On a new version of an agent

The agent's consultant:

1. **Reads the changelog** from the row's version to the new one. A line that touches a flag,
   setting, hook, screen or file Menkar uses is a check to run, or a topic.
2. **Runs the checks in a throwaway home** (the agent's folder under `scripts/agent-probes/`): a
   `HOME` (and the agent's config directory) of its own, a stand-in API on 127.0.0.1, a fresh environment with none of the parent
   session's variables, every process stopped by its PID or process group. The human's own home,
   sessions and sockets are never touched.
3. **Updates the row**: the version and date, and each item it re-measured. An item it did not
   re-check keeps its older version.
4. **Brings what is new, deprecated or broken as a topic** through the orchestrator, `set`, with
   the measured case. A regression that blocks sessions goes first.

**Where the checks live** (`set`, 2026-11-17): in the repository, `scripts/agent-probes/<agent>/`,
run by hand and outside `npm run ci`. Claude Code's are `scripts/agent-probes/claude/` (`all.mjs`
runs them; its `README.md` says what each checks and what it leaves behind). A check the row relies
on that has no script yet is run by hand and then added there.
