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

## Claude Code — validated at 2.1.329 (2026-11-20), owner: `claude-cli`

| What | State | Where it is described |
|---|---|---|
| Start and resume: `--session-id`, `-n`, `--model`, `--resume`, `--fork-session`, `--remote-control`; the first prompt before `--add-dir`/`--mcp-config` (both swallow later words) | measured 2.1.322; the swallowing fixed upstream in 2.1.326 (read, changelog) | `docs/session-control.md`, `docs/window.md` |
| `--add-dir` stops every start at a trust dialog whose default is "No, exit"; the files folder goes as `permissions.additionalDirectories` in `--settings` instead | measured 2.1.329 (probes: `add-dir.mjs`) | `docs/project-files.md` |
| `--settings`: statusline, SessionStart and Stop hooks, `permissions.allow: ["mcp__menkar"]`, `crossSessionInbound: "accept"` | measured 2.1.322 | `docs/context.md` |
| `--mcp-config` inline adds Menkar's server beside the user's; `mcpServers` in `--settings` is ignored; the server inherits the pty's env | measured 2.1.322 | `docs/session-control.md` |
| `--plugin-dir` loads the skills plugin as `menkar:<folder>`, no trust prompt | measured 2.1.322 | `docs/session-control.md` |
| The team block by `--append-system-prompt-file`: in the first request's system prompt, read once at start, kept on `--resume` until a compaction unless `--system-prompt-snapshot off`; a missing file exits at once | first request and missing file measured 2.1.329 (`team-block.mjs`); resume and snapshot measured 2.1.325 | `docs/session-control.md` |
| The state screens: the permission card ("Do you want to proceed?"), auto mode's consecutive-block card with its 2-minute countdown (after which Claude Code blocks the call itself and the turn ends), the footer's background pills | cards measured 2.1.329 (`permission.mjs`), the countdown's expiry 2.1.326; the shell's and monitor's "N … still running" measured 2.1.329 (by hand), a scheduled task shows none; pills read 2.1.323 | `docs/agent-state.md` |
| Waking: a post to the registry's messaging socket wakes an idle session, leaves a permission card untouched, is held in bypass mode without `crossSessionInbound: "accept"`; identical repeats are dropped | idle wake and transcript record measured 2.1.329 (`wake.mjs`); the card and bypass cases 2.1.322 | `docs/session-control.md` |
| The orchestrator's prompt hook: a `UserPromptSubmit` hook in `--settings` whose `additionalContext` reaches the model on the next prompt of any kind (typed, from the command line, a wake, a peer's message) and is recorded as a `hook_additional_context` attachment, nothing on screen; built-in commands (`/clear`, `/compact`, `/model`, `/rename`) do not run it; whole up to 10,000 characters; run under `/bin/sh -c` | Menkar's real hook measured 2.1.329 (`prompt-hook.mjs`); the cases and the size 2.1.327 | `docs/context.md` |
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

## OpenCode — no row yet, owner: its consultant

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
