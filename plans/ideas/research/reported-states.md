# Reported states and notification noise — a survey (2026-11-12)

> Asked by the human for plan 35. Web survey by a subagent of `set`; primary sources unless marked
> *[secondary]*. Not verified further. Kept so the plan's "Rejected" section can cite it.

## Findings, by tool

- **Claude Code agent view** (`claude agents`): Working, Needs input, Idle, Completed, Failed,
  Stopped; `--json` gives `waitingFor` (`permission prompt`, `input needed`, `sandbox request`,
  `worker request`, `dialog open`). A session that "ended its turn by asking you a question" counts
  as waiting; how it is detected is not documented. Notifies only while agent view is open, only for
  needs-input / finished / failed. Tab title "2 awaiting input".
- **Claude Code agent teams**: teammates working/idle; tasks pending/in progress/completed/blocked
  by dependencies; idle notices to the lead; `TeammateIdle`, `TaskCompleted` hooks; teammates'
  permission prompts surface in the lead. Only the lead talks to the human; idle rows collapse.
- **Claude Code hooks**: `Notification` types `permission_prompt` (~6 s), `idle_prompt` (~60 s
  after the turn, if the human has not typed), `elicitation_dialog`, `agent_needs_input`,
  `agent_completed`; `Stop` receives `last_assistant_message`.
- **agent-deck** (MIT): Running, Waiting, Idle, Error from pane polling plus hooks; a transition
  notifier nudges the parent session when a child changes; per-session mute; a "conductor" answers
  routine questions and pushes only `NEED:`/`[urgent]` lines, `[info]` to a digest.
- **Claude Squad** (AGPL-3.0): pane hash plus prompt strings; no "needs the human" item found.
- **Dorothy** (MIT): output patterns; MCP `wait_for_agent` polls until completion/error/waiting.
- **Octogent** (MIT): Claude hooks post state and idle events to its API.
- **Backlog.md** (MIT): the agent sets task status explicitly through CLI or MCP.
- **Codex CLI**: `notify` command; hooks `Stop`, `PermissionRequest`; notifications filterable by
  type, `unfocused` by default.
- **Ask-human MCP servers** (human-in-the-loop, ask-human-mcp, mcp-clarify…): a blocking tool call
  that waits for the human's answer.
- Not confirmed: Conductor, Vibe Kanban's detection, Gemini's notification types, Mission Control.

## Takeaways for Menkar

1. "Waiting on a question in prose" is a gap for every screen-reading tool; an explicit report by
   the agent is the reliable route.
2. A **non-blocking** status tool (`set_waiting {on: "human" | <session>, question}`) beats a
   blocking ask-human tool: a blocking call keeps the turn open and the screen reads "working".
3. Clear the state on the app's own evidence (the human types in that tab, the awaited session's
   turn ends, a new turn starts), with an expiry.
4. The `Stop` hook's `last_assistant_message` could flag a turn ending in a question without the
   agent's help, but cannot tell for whom: a fallback at most.
5. "Waiting on another session" goes to the orchestrator, shown quietly, not as "needs you".
6. To cut noise: only the lead notifies, with tiers; a per-session mute; notify only when away.
7. Count and collapse rather than alert: a running count of what waits on the human.

## Sources

code.claude.com docs (agent-view, agent-teams, cross-session-messaging, hooks, tools-reference,
mcp); GitHub READMEs of asheshgoplani/agent-deck, Charlie85270/Dorothy, hesamsheikh/octogent,
BloopAI/vibe-kanban, stravu/crystal, MrLesk/Backlog.md; smtg-ai/claude-squad source; geminicli.com
hooks; Codex config reference; mcpservers.org and lobehub.com for ask-human servers.
