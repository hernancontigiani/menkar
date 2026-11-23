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

## The pattern: a kit of strategies per agent, chosen once

> Left on 2026-11-20: Codex has a waker, `codex queue` (plan 39 P1b.3, task 164).
  fork, no Remote Control, no team block, no waker, no inbox; Codex has none of those either, and
  no MCP mount, chat or trash yet.

## Codex: starting it

> Left on 2026-11-20: Codex has a waker, `codex queue` (plan 39 P1b.3, task 164).
(2026-11-20). It has no team block, fork, chat, trash, Remote Control, waker or inbox: each is
`null` in its kit, and the renderer offers none of them for a Codex session.

## Messaging, and the tools each caller is listed

> Left on 2026-11-20: `send_message` is answered through the target's Waker (plan 39 P1b.3, task 164).
- **Not built yet on this branch:** `send_message`'s call is answered as an unknown tool until
  its waking through the target's Waker exists.

## Codex: starting it

> Left on 2026-11-20: Codex's `DeclaredWrites` hold what `codex queue` writes (plan 39 P1b.4, task 165).
- **Its `DeclaredWrites` are empty**: no call Menkar makes has Codex write into its own data (no
  name at start, no queued message yet).

## Codex: waking

> Left on 2026-11-20: the waker runs `codex queue --disable plugins`, plain only on the daemon's refusal (plan 39 P1b.4, task 165).
- **Never with a `-c`:** with Codex's shared daemon running, a queue that would run its own
  embedded server is refused.

## Codex: starting it

> Left on 2026-11-20: Codex has a team block, delivered by `-c developer_instructions`, recorded per session (plan 39 P1b.5, task 166).
(2026-11-20). It has no team block, fork, chat, trash, Remote Control or inbox: each is `null` in
its kit, and the renderer offers none of them for a Codex session.
  mcp_servers.menkar.…] [-- "<prompt>"]`, and `codex resume [--add-dir …] [-c notify=[…]] [-c
  mcp_servers.menkar.…] <id> [-- "<prompt>"]`. Options go after `resume`;
  `default_tools_approval_mode="approve"`, so Menkar's tools run with no approval card. Codex gives

## The pattern: a kit of strategies per agent, chosen once

> Left on 2026-11-20: the caps gained `tools` (⇔ `kit.mcp`) and the descriptor `teamLimits`, `firstPrompt` and `versionWord` (plan 39 P1b.6).
  variants), in `src/core/agents/<id>/descriptor.ts`, gathered by `src/core/agents/descriptors.ts`,
  (and a non-empty `chat` list), `namedAtStart` ⇔ `kit.namer.atStart(…) !== null`.

## Codex: naming

> Left on 2026-11-21: every Codex session Menkar starts with a name is named, New's too (decision 1.196, task 168).
Decision 1.195 (the human, 2026-11-20, amending D5), measured by `codex` on codex-cli 0.169.0.
- **Which sessions:** only the Codex sessions `start_session` starts (workers, consultants), which
  the team addresses by name, and a renew of one of them, whose new thread is named the same.
  Each named session is kept in `state.json`'s `agent_named` (`docs/sessions.md`), so a renew
  after a restart still names. A session the human opens from New keeps Codex's own title, and a
  name on a session Menkar did not start is never touched.

## Codex as the orchestrator

> Left on 2026-11-21: the card's orchestrator is named under decision 1.196 (task 168).
- **Named as the human typed it** (`set`, 2026-11-20, reading 1.195: a name the human typed is the
  human's): through the same namer as `start_session`'s Codex sessions, once its thread exists,
  with the same `agent_named` mark, so a renew keeps it.

## Agents — how the code is organised

> Left on 2026-11-21: OpenCode joins (plan 39, P2.7, task 196).
Menkar runs more than one coding agent: Claude Code, Cursor and Codex. What differs per agent is
kept in one place per agent, so a change to one agent cannot break another and shared code never

## OpenCode: its state

> Left on 2026-11-23: the screen is read whole and the question card is blocked (task 201).
- **The screen** (`state.ts`, from v2.3.0's TUI): blocked is the permission card (its heading and
  its choices) in the last 12 lines; working is "esc interrupt" in the footer's last line only, so
  a reply that quotes it is not a turn. The tab strip's spinner also turns while a message only
  waits in the inbox, so it is not read. A form card (`form.created`, OpenCode's question tool) is
  not read as blocked (`docs/NOT_BUILT_YET.md`).
