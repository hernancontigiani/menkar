# Ideas — what agent-deck does, and what Menkar could take

> **Status: notes, not a plan.** Written 2026-11-11 by `set` from agent-deck's README (read through
> the web, two passes; **its code was not opened**, and the README's last ~22,000 characters were
> not read). Nothing here is decided. Read the sources before relying on a detail.

## Sources

- Repository: https://github.com/asheshgoplani/agent-deck (Go, Bubble Tea TUI; the official one —
  several forks and skill directories mirror it with differing versions)
- Go package docs: https://pkg.go.dev/github.com/asheshgoplani/agent-deck
- Its skill, in the repository: `skills/agent-deck/` (`references/cli-reference.md`,
  `references/tui-reference.md`); the repository also has `.claude-plugin/` and `.claude/`.
- The author's article: https://dev.to/asheshgoplani/how-to-manage-multiple-claude-code-gemini-and-codex-sessions-in-one-terminal-1dci

## What it is

A terminal session manager for Claude Code, Codex, Gemini, OpenCode and others, run on tmux:
projects and groups of sessions, an MCP manager (with a socket pool sharing MCP server processes
across sessions), a skills manager, and **conductors**. The closest existing tool to Menkar's
direction; Menkar differs in being a desktop app that reads states from the terminal and never types
into an agent.

## Skills

- **A pool is the only source**: `$XDG_CONFIG_HOME/agent-deck/skills/pool` (default
  `~/.config/agent-deck/skills/pool`; an older path `~/.agent-deck/skills/pool` appears in some
  docs). The README does not say how skills enter the pool.
- **Attached per project**: `s` on a Claude session opens the Skills Manager; the available list is
  the pool only, "to keep attach/detach deterministic". Applying records the project's skills in
  `.agent-deck/skills.toml` and "materializes" them into the project's `.claude/skills` — **copy or
  link is not said**. CLI: `agent-deck skill attach my-proj docs --source pool --restart`.
- **Its own skills**: `agent-deck` (how to drive agent-deck) and `watcher-creator`, installed with
  `agent-deck watcher install-skill watcher-creator`; directories elsewhere list a plugin route
  (`/plugin marketplace add asheshgoplani/agent-deck`) and a curl of `SKILL.md` into
  `~/.claude/skills/agent-deck/`.
- No global (user-level) scope for skills in the README; MCP servers have a LOCAL/GLOBAL toggle.

## Orchestration: conductors

- "Conductors are persistent agent sessions that monitor and orchestrate all your other sessions":
  they watch for sessions that need help, answer when confident, escalate to the human otherwise.
- `agent-deck conductor setup ops --description "Ops monitor"`; each conductor has a directory with
  `meta.json`, `state.json`, `task-log.md` and an identity file (`CLAUDE.md` or `AGENTS.md`).
- **Signals in**: a notifier daemon nudges the parent when a child goes running → waiting, error or
  idle; a heartbeat every 15 minutes; optional Telegram, Slack, Discord, Mattermost bridges;
  **standing orders** (`ORDERS.md`) wake a conductor only when a watched command's output changes,
  the cheap check run every minute.
- **Signals out (it types into sessions)**: `agent-deck session send my-proj --message-file task.md`
  sends a prompt; `agent-deck session ref my-proj reviewer` types a reference without sending;
  queueing uses Claude's native queue where available, "terminal keys" otherwise. A conductor's
  `clear_on_compact` sends a `/clear` itself.
- **Sessions from the CLI**: `agent-deck -p work launch . -t "child-task" -c claude -m "Do task"`,
  `--parent <id>` (inherited by default inside a conductor through `AGENT_DECK_SESSION_ID`,
  `--no-parent` to opt out); `agent-deck session fork my-proj` (each tool's native fork);
  `agent-deck session restart <name>`. No command to clear a session's context.
- No MCP server of its own for agents to call.

## What Menkar could take (set's reading, 2026-11-11, nothing decided)

- **A pool and attach-by-link.** The user's own skills repository (the human's `agent-skills`) is
  the pool; attaching a skill to a project or to the user level is a **link** (a junction on
  Windows), never a copy, so a specialist's distilled edits land in the repository. A per-project
  record of what is attached, like `skills.toml`, but in Menkar's own data, not the repository.
- **Menkar's own skills ship with Menkar** (the orchestrator's role, a worker's, distill-then-clear)
  and enter the pool on the user's request.
- **Conductor ≈ the orchestrator with a leader per group (1.50).** Worth copying: the transition
  nudges (Menkar already knows each pane's state), standing orders that wake only on change, a task
  log per orchestrator. Not copyable as is: **typing into sessions** (`session send`, the proactive
  `/clear`) — Menkar's rule is that nothing is typed into a running agent; any exception is the
  human's decision.
- **Launching sessions from the CLI or a tool** (`launch -t -m --parent`) is what would take the
  human out of copying `claude -n … "$(cat prompts/…)"` commands: see the next topic of discussion
  (2026-11-11) on a Menkar CLI / MCP to start, renew and clear sessions.
