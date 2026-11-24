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

## Claude Code — validated at 2.1.331 (2026-11-24), owner: `claude-cli`

| What | State | Where it is described |
|---|---|---|
| Start and resume: `--session-id`, `-n`, `--model`, `--resume`, `--fork-session`, `--remote-control`; the first prompt before `--add-dir`/`--mcp-config` (both swallow later words) | measured 2.1.322; the swallowing fixed upstream in 2.1.326 (read, changelog) | `docs/session-control.md`, `docs/window.md` |
| `--add-dir` stops every start at a trust dialog whose default is "No, exit"; the files folder goes as `permissions.additionalDirectories` in `--settings` instead | measured 2.1.331 (probes: `add-dir.mjs`) | `docs/project-files.md` |
| `--settings`: statusline, SessionStart and Stop hooks, `permissions.allow: ["mcp__menkar"]`, `crossSessionInbound: "accept"` | measured 2.1.322 | `docs/context.md` |
| `--mcp-config` inline adds Menkar's server beside the user's; `mcpServers` in `--settings` is ignored; the server inherits the pty's env | measured 2.1.322 | `docs/session-control.md` |
| `--plugin-dir` loads the skills plugin as `menkar:<folder>`, no trust prompt | measured 2.1.322 | `docs/session-control.md` |
| The team block by `--append-system-prompt-file`: in the first request's system prompt, read once at start, kept on `--resume` until a compaction unless `--system-prompt-snapshot off`; a missing file exits at once | first request and missing file measured 2.1.331 (`team-block.mjs`); resume and snapshot measured 2.1.325 | `docs/session-control.md` |
| The state screens: the permission card ("Do you want to proceed?"), auto mode's consecutive-block card with its 2-minute countdown (after which Claude Code blocks the call itself and the turn ends), the footer's background pills | cards measured 2.1.331 (`permission.mjs`), the countdown's expiry 2.1.326; the shell's and monitor's "N … still running" measured 2.1.329 (by hand), a scheduled task shows none; pills read 2.1.323 | `docs/agent-state.md` |
| Waking: a post to the registry's messaging socket wakes an idle session, leaves a permission card untouched, is held in bypass mode without `crossSessionInbound: "accept"`; identical repeats are dropped | idle wake and transcript record measured 2.1.331 (`wake.mjs`); the card and bypass cases 2.1.322 | `docs/session-control.md` |
| The orchestrator's prompt hook: a `UserPromptSubmit` hook in `--settings` whose `additionalContext` reaches the model on the next prompt of any kind (typed, from the command line, a wake, a peer's message) and is recorded as a `hook_additional_context` attachment, nothing on screen; built-in commands (`/clear`, `/compact`, `/model`, `/rename`) do not run it; whole up to 10,000 characters; run under `/bin/sh -c` | Menkar's real hook measured 2.1.331 (`prompt-hook.mjs`); the cases and the size 2.1.327 | `docs/context.md` |
| A peer message's turn (a `[Menkar]` post or a `SendMessage`) gets no attachments: a resumed session's plugin skills and deferred tools are listed only after that turn's first tool call, while the Skill tool and `ToolSearch select:` find them by name before it; a prompt turn lists them at once. A post that reaches a session resumed with a prompt before that prompt is sent runs first, and the prompt follows as the next turn | measured 2.1.331 (`peer-turn.mjs`); the order by hand 2.1.330, 3 of 3 | `docs/session-control.md` |
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
