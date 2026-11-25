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

## Claude Code — validated at 2.1.332 (2026-11-25), owner: `claude-cli`

| What | State | Where it is described |
|---|---|---|
| Start and resume: `--session-id`, `-n`, `--model`, `--resume`, `--fork-session`, `--remote-control`; the first prompt before `--add-dir`/`--mcp-config` (both swallow later words) | measured 2.1.322; the swallowing fixed upstream in 2.1.326 (read, changelog) | `docs/session-control.md`, `docs/window.md` |
| `--add-dir` stops every start at a trust dialog whose default is "No, exit"; the files folder goes as `permissions.additionalDirectories` in `--settings` instead | measured 2.1.332 (probes: `add-dir.mjs`) | `docs/project-files.md` |
| `--settings`: statusline, SessionStart and Stop hooks, `permissions.allow: ["mcp__menkar"]`, `crossSessionInbound: "accept"` | measured 2.1.322 | `docs/context.md` |
| `--mcp-config` inline adds Menkar's server beside the user's; `mcpServers` in `--settings` is ignored; the server inherits the pty's env | measured 2.1.322 | `docs/session-control.md` |
| `--plugin-dir` loads the skills plugin as `menkar:<folder>`, no trust prompt | measured 2.1.322 | `docs/session-control.md` |
| The team block by `--append-system-prompt-file`: in the first request's system prompt, read once at start, kept on `--resume` until a compaction unless `--system-prompt-snapshot off`; a missing file exits at once | first request and missing file measured 2.1.332 (`team-block.mjs`); resume and snapshot measured 2.1.325 | `docs/session-control.md` |
| The state screens: the permission card ("Do you want to proceed?"), auto mode's consecutive-block card with its 2-minute countdown (after which Claude Code blocks the call itself and the turn ends), the footer's background pills | cards measured 2.1.332 (`permission.mjs`), the countdown's expiry 2.1.326; the shell's and monitor's "N … still running" measured 2.1.329 (by hand), a scheduled task shows none; pills read 2.1.323 | `docs/agent-state.md` |
| Waking: a post to the registry's messaging socket wakes an idle session, leaves a permission card untouched, is held in bypass mode without `crossSessionInbound: "accept"`; identical repeats are dropped | idle wake and transcript record measured 2.1.332 (`wake.mjs`); the card and bypass cases 2.1.322 | `docs/session-control.md` |
| The orchestrator's prompt hook: a `UserPromptSubmit` hook in `--settings` whose `additionalContext` reaches the model on the next prompt of any kind (typed, from the command line, a wake, a peer's message) and is recorded as a `hook_additional_context` attachment, nothing on screen; built-in commands (`/clear`, `/compact`, `/model`, `/rename`) do not run it; whole up to 10,000 characters; run under `/bin/sh -c` | Menkar's real hook measured 2.1.332 (`prompt-hook.mjs`); the cases and the size 2.1.327 | `docs/context.md` |
| A peer message's turn (a `[Menkar]` post or a `SendMessage`) gets no attachments: a resumed session's plugin skills and deferred tools are listed only after that turn's first tool call, while the Skill tool and `ToolSearch select:` find them by name before it; a prompt turn lists them at once. A post that reaches a session resumed with a prompt before that prompt is sent runs first, and the prompt follows as the next turn | measured 2.1.332 (`peer-turn.mjs`); the order by hand 2.1.330, 3 of 3 | `docs/session-control.md` |
| `SendMessage` between sessions: the child's transcript records `to` as typed and `toolUseResult {success, message, display, msg_id}`; the receiver's record carries `origin.kind: "peer"` | read 2.1.325 (own transcript) | `docs/session-control.md` |
| Transcripts: `~/.claude/projects/<cwd>/<id>.jsonl`; the registry `~/.claude/sessions/<pid>.json` | measured 2.1.322; registry shape read 2.1.319 | `docs/sessions.md` |
| Project skills load from the start folder and every parent (outside git too), the nearest wins | measured 2.1.325 | — |
| A turn that ends with no visible text gets a reminder that starts another turn | read 2.1.325 (binary) | `docs/NOT_BUILT_YET.md` |

**Not checked on any version:** macOS and Windows; an untrusted start folder; the real auto-mode
classifier's own cards (only a stand-in's "block" answers).

## Codex — validated at 0.169.0 (2026-11-25), owner: `codex`

| What | State | Where it is described |
|---|---|---|
| Per-session settings by `-c` (`notify`, `mcp_servers.menkar.*`, `features.code_mode.direct_only_tool_namespaces`, `developer_instructions`), with nothing written to `~/.codex`. Any `-c` runs the TUI embedded, not through the shared daemon. Inline text is passed as a TOML string (`JSON.stringify`); a badly quoted value is silently taken as a string | measured 0.169.0 (items 5, 6; task 162) | `docs/agents.md` |
| The first prompt is positional after `--`: a long prompt with backticks arrives byte-exact. `codex resume <uuid> … "<prompt>"` keeps the history | measured 0.169.0 (items 8, 26; task 167's real run) | `docs/agents.md` |
| `--add-dir <files folder>`: a command writing there runs with no approval card under the default for a trusted folder (`workspace-write`, `on-request`). A trust prompt is shown for an untrusted start folder, and `-c projects."<dir>".trust_level` does not skip it; accepting it is Codex's own write to the user's config | add-dir measured 0.169.0 (item 29); the trust prompt measured 0.169.0 (item 4) | `docs/project-files.md` |
| Menkar's MCP server by `-c`: it loads with no prompt. `default_tools_approval_mode="approve"` runs its tools with no card. The server gets only `HOME, LOGNAME, PATH, SHELL, USER, LANG, LC_ALL, TERM, TMPDIR, TZ`, plus `env` and the names in `env_vars` (an unset name is skipped) | measured 0.169.0 (item 6; task 162) | `docs/session-control.md` |
| Menkar's tools reach the model directly, with full schemas from the first request, through `features.code_mode.direct_only_tool_namespaces=["mcp__menkar"]`. Without it, every catalog model defers them behind code mode's `exec`. The spelling without `features.` is ignored, with a startup warning | measured 0.169.0 (item 26; task 167's real run: 25 tools, direct calls) | `docs/session-control.md` |
| The team block by `-c developer_instructions`: the first item of the second developer message, byte-exact, at 5.5 KB with no cut. It replaces the user's own value, so Menkar joins the two. A resume keeps the block recorded at the thread's start. **A compaction rebuilds it from the running process's `-c`**, so every resume passes it again | measured 0.169.0 (item 26, manual and automatic compaction; task 167) | `docs/session-control.md` |
| Waking by `codex queue --disable plugins --thread <uuid> --message <text>`, with no `-c`. It covers an idle TUI (about 4 s), a mid-turn one (as the next turn), an approval card (left untouched; the message runs after the approved turn) and a stopped TUI (the message is kept and runs at resume). A thread with no rollout yet and an unknown uuid get the same refusal. The text arrives byte-exact. **With the shared daemon running, any override (`--disable` included) is refused**, so the plain call must be used | measured 0.169.0 (items 1–3, 12, 24; task 167's real run); the fallback with a running daemon is not exercised by Menkar's code | `docs/session-control.md` |
| The turn's end by `-c notify=[…]`: it fires about 1 s after each turn, with `thread-id`. On a first turn, a title thread with no rollout may fire too | measured 0.169.0 (items 7, 13, 21; task 167's turn-ends record) | `docs/agent-state.md` |
| Naming by `codex app-server --disable plugins`, then `thread/name/set`: accepted once the rollout exists, within about 0.2 s. **With Menkar's MCP mounted, the TUI generates no title** (its title thread fails to start). This is decision 1.196's premise. A `/rename` and a generated name are stored the same way. Names are not unique, and `codex resume <name>` refuses duplicates | measured 0.169.0 (items 15, 25, 27; task 167: exactly Menkar's name per thread) | `docs/sessions.md` |
| Without `--disable plugins`, `codex app-server` and `codex queue` sync the plugin marketplace: `git ls-remote https://github.com/openai/plugins.git`, plus a left-behind `.tmp/git-*` | measured 0.169.0 (items 24, 25); the TUI's own startup sync remains, a topic for the human | — |
| Rollouts: `sessions/YYYY/MM/DD/rollout-<local start>-<uuid>.jsonl`, created at the first user message. Ids are UUIDv7 minted at the thread's creation. A fork carries `forked_from_id`. The process holds the rollout open, and holds both after `/new`. A thread untouched for a week is zstd-compressed | measured 0.169.0 (items 9, 10, 18–20); zstd read 0.169.0 | `docs/sessions.md` |
| The state screens and title: the Braille spinner title while working; `[ ! ]`/`[ . ] Action Required` every 1.0 s at an approval card, with no plain title between; the bare name when idle. A turn reads as one unbroken working span through tools, streaming and a compaction. A ~0.1 s spinner shows at start while MCP servers initialize. An immediate Enter after typed text is swallowed | measured 0.169.0 (items 16, 22, 23, 28) | `docs/agent-state.md` |
| The context reading: `token_count.info.last_token_usage.total_tokens` over `model_context_window`, both less 12,000. 100,000 of 258,400 reads 36% used, matching `/status`'s "64% left" | measured 0.169.0 (item 29) | `docs/usage.md` |
| Usage: one `token_usage_record` per response, `{thread_id, turn_id, session_id, root_turn_id, response_id, usage:{input_tokens, cached_input_tokens, …}}` | measured 0.169.0 (item 29, the stand-in's counts) | `docs/usage.md` |
| Skills: read by absolute path through `exec_command`, outside the cwd, with no approval card | measured 0.169.0 (items 26, 27; task 167) | `docs/session-control.md` |
| The environment a shell command gets: `CODEX_CI`, `CODEX_THREAD_ID`, `CODEX_TOOL_CALL_ID`, `CODEX_SESSION_ID`, `CODEX_VERSION`, `CODEX_PERMISSION_PROFILE`, `CODEX_SANDBOX_NETWORK_DISABLED`, `CODEX_APPLY_PATCH_PRESERVE_LINE_ENDINGS`, `NO_COLOR`, `PAGER`; Menkar drops the `CODEX_*` ones above from what it hands on (`src/core/agents/codex/env.ts`) | measured 0.169.0 (item 29); the network-proxy and plugin variables read 0.169.0 | `docs/agents.md` |
| The version word: `codex --version` prints `codex-cli 0.169.0`, so the version is the second word (the descriptor's `versionWord`) | measured 0.169.0 | `docs/agent-versions.md` |

Decision 1.196 (Menkar names every Codex session it starts with a name) rests on `codex`'s
research file item 27 (2026-11-20, task 167): a Codex TUI with Menkar's MCP server mounted
generates no title. Re-measured on each Codex upgrade.

**Not checked on any version:**
- macOS and Windows: the daemon socket, `codex queue`, zstd;
- Menkar's queue fallback while the user's shared daemon runs;
- an apply-patch card, a network approval and an MCP elicitation, as screens;
- a real model's reasoning items during a turn (the stand-in sends none);
- what the MCP status-line provider tool receives.

How to repeat:
- Use a throwaway `CODEX_HOME` under `/tmp` whose `config.toml` names the stand-in provider,
  `model = "gpt-6.1-sol"` and the work folder as trusted (`scripts/agent-probes/codex/README.md`).
- Run `responses-standin.mjs` with a script for each check.
- Drive the real `codex` in a private `tmux -L`, or under Menkar's real-check e2e as in task 167.
- Stop every process by PID after checking that its `/proc/<pid>/environ` names that home.
- Never use the human's `~/.codex`, login or daemon.

## Cursor — no row yet, owner: its consultant

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
