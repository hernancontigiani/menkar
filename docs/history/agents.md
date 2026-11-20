# History of `docs/agents.md`

## The pattern: a kit of strategies per agent, chosen once

> Left on 2026-11-18: the orchestrator's inbox joins the concerns (decision 1.178, plan 42).
  (`Waker`), the settings file and chat tabs (`ChatStrategy`). An interface enters with the first
  fork, no Remote Control, no team block, no waker.

## Agents — how the code is organised

> Left on 2026-11-20: Codex joins (plan 39, P1a).
Menkar runs more than one coding agent (Claude Code and Cursor today). What differs per agent is

## The pattern: a kit of strategies per agent, chosen once

> Left on 2026-11-20: Codex joins (plan 39, P1a); the interfaces P1a added are listed.
  (`Launcher`, `McpMount`, `Namer`, `EnvRules`), the team block's delivery (`TeamDelivery`,
  `MainTeamDelivery`), the sessions (`SessionCatalog`), the state read from the screen
  (`StateRules`), ids (`SessionIds`, `PaneFollow`), `Fork`, Remote Control (`Remote`), waking
  (`Waker`), the orchestrator's inbox file and its delivery read back from the transcript
  (`PromptInbox`, `MainAgentKit.inbox`; decision 1.178), the settings file and chat tabs
  (`ChatStrategy`). An interface enters with the first
  fork, no Remote Control, no team block, no waker, no inbox.

## Codex: starting it

> Left on 2026-11-20: Codex mounts Menkar's MCP server (plan 39, P1b.2).
(2026-11-20). It has no MCP mount, team block, fork, chat, trash, Remote Control, waker or inbox:
each is `null` in its kit, and the renderer offers none of them for a Codex session.
- **The command**: `codex [-m <model>] [--add-dir <files>] [-c notify=[…]] [-- "<prompt>"]`, and
  `codex resume [--add-dir …] [-c notify=[…]] <id> [-- "<prompt>"]`. Options go after `resume`;

## Codex: binding a tab to its thread

> Left on 2026-11-20: the real check through Menkar's build adds its numbers (plan 39, P1a.7).
ends; elsewhere than Linux it binds when the first turn ends.

## Messaging, and the tools each caller is listed

> Left on 2026-11-20: main starts the agent `start_session` names (plan 39, P1b.2).
  its waking through the target's Waker exists, and main ignores `start_session`'s `agent` until
  it starts another agent's session.
