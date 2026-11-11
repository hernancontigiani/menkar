# Plan 31: sessions that renew themselves and start others (1.70)

> **Status:** stub, taken 2026-11-11 by `set`; being designed with the human. Not executable yet.

## Why

The human is the manual step in two loops: after a task a specialist distills its skill and the
human runs `/clear` in its tab; the orchestrator writes a launch prompt and the human copies
`claude -n <name> --remote-control <name> "$(cat prompts/…)"` into a terminal. Both are low risk
and can be done by the sessions themselves through Menkar, without typing into any agent.

## Decided (1.70)

- Menkar's own MCP server, given to the sessions it starts the way `--settings` is; a CLI over the
  same core (`menkar session renew`, `menkar session start`).
- `renew`: once the caller's turn is over, Menkar hangs up that agent as closing a tab does and
  starts a fresh one in the same tab, same name, an optional first prompt; the old session becomes
  its earlier conversation (1.63). A session renews only itself.
- `start_session`: a new session in a Menkar tab — name, project, prompt from a file, Remote
  Control, group.
- No confirmation by the human: low risk.

## Decided with the human (2026-11-11)

- **Any session Menkar started may start others, always in its own project.**
- **The new tab opens in the project's window right after the caller's tab, without taking the
  focus.**
- **`renew` keeps everything a followed `/clear` keeps** (1.56, 1.63): project place, group, leader
  mark, Remote Control.

## To find in the code and in Claude Code before writing it

- How an MCP server is handed to a session without touching `~/.claude` (`--mcp-config`, or an
  `mcpServers` entry in the `--settings` file) and how it identifies the calling pane
  (`MENKAR_PANE`, 1.56).
- How main learns a turn is over (the agent state already says idle / done).
- The distill-then-clear skill (Menkar's `skills/`) calls `renew` at its end.
